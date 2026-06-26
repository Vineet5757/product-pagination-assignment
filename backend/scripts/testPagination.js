'use strict';

require('dotenv').config();
const mongoose  = require('mongoose');
const axios     = require('axios');
const { faker } = require('@faker-js/faker');
const { Product, CATEGORIES } = require('../src/models/Product');

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE         = process.env.API_BASE || 'http://localhost:5000/api/products';
const PAGE_LIMIT       = 20;
const MAX_PAGES        = 100;        // cap: 100 pages × 20 = 2000 docs (fast demo)
const PAGE_DELAY_MS    = 80;         // simulates realistic user browsing pace
const MUTATION_TICK_MS = 250;        // background mutations every 250 ms
const INSERT_PER_TICK  = 5;
const UPDATE_PER_TICK  = 5;
const TEST_CATEGORY    = null;       // set e.g. 'Electronics' to test filtered run

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const C = {
  green  : s => `\x1b[32m${s}\x1b[0m`,
  yellow : s => `\x1b[33m${s}\x1b[0m`,
  cyan   : s => `\x1b[36m${s}\x1b[0m`,
  red    : s => `\x1b[31m${s}\x1b[0m`,
  bold   : s => `\x1b[1m${s}\x1b[0m`,
  dim    : s => `\x1b[2m${s}\x1b[0m`,
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

function buildProduct() {
  const now = new Date();
  return {
    name      : faker.commerce.productName(),
    category  : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
    price     : parseFloat(faker.commerce.price({ min: 1, max: 9999, dec: 2 })),
    createdAt : now,
    updatedAt : now,
  };
}

// ─── Background Mutator ───────────────────────────────────────────────────────
// Runs in parallel with pagination to simulate live production mutations.
// Tracks every ID it inserts/updates so the verifier can cross-check them.
class BackgroundMutator {
  constructor() {
    this.insertedIds = new Set();  // IDs born after snapshot — must never appear in feed
    this.updatedIds  = new Set();  // IDs mutated after snapshot — evicted from window
    this._timer      = null;
    this._inFlight   = Promise.resolve();
  }

  async _tick() {
    // ── Insert burst ────────────────────────────────────────────────────────
    const docs     = Array.from({ length: INSERT_PER_TICK }, buildProduct);
    const inserted = await Product.insertMany(docs, { ordered: false, timestamps: false });
    inserted.forEach(d => this.insertedIds.add(d._id.toString()));

    // ── Update burst ────────────────────────────────────────────────────────
    const sample = await Product.aggregate([
      { $sample  : { size   : UPDATE_PER_TICK } },
      { $project : { _id    : 1 } },
    ]);
    if (sample.length) {
      const ids = sample.map(d => d._id);
      await Product.updateMany(
        { _id: { $in: ids } },
        { $set: { price: parseFloat(faker.commerce.price()), updatedAt: new Date() } }
      );
      ids.forEach(id => this.updatedIds.add(id.toString()));
    }
  }

  start() {
    this._timer = setInterval(() => {
      this._inFlight = this._tick().catch(() => {});
    }, MUTATION_TICK_MS);
    console.log(
      `  ${C.yellow('⚡')} Mutator started` +
      ` (insert +${INSERT_PER_TICK} / update ~${UPDATE_PER_TICK} every ${MUTATION_TICK_MS}ms)`
    );
  }

  async stop() {
    clearInterval(this._timer);
    await this._inFlight;          // wait for the last in-flight tick to finish
    await sleep(100);              // brief settle for any straggling writes
    console.log(
      `  ${C.yellow('⚡')} Mutator stopped` +
      ` | inserted: ${C.bold(String(this.insertedIds.size))}` +
      ` | updated: ${C.bold(String(this.updatedIds.size))}`
    );
  }
}

// ─── Paginator ────────────────────────────────────────────────────────────────
// Fetches pages sequentially, mimicking a real browser client.
// Returns every _id seen across all pages plus the snapshotTime.
async function paginateAll() {
  const allIds     = [];
  let   cursor     = null;
  let   snapshot   = null;
  let   page       = 0;

  while (true) {
    page++;
    const params = {
      limit : PAGE_LIMIT,
      ...(cursor        && { cursor }),
      ...(snapshot      && { snapshotTime : snapshot }),
      ...(TEST_CATEGORY && { category     : TEST_CATEGORY }),
    };

    let res;
    try {
      res = await axios.get(API_BASE, { params });
    } catch (err) {
      const detail = err.response
        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
        : `Could not reach ${API_BASE} — is the server running?`;
      throw new Error(detail);
    }

    const { products, pagination } = res.data.data;

    // Mint snapshot on page 1 — locked for the rest of this session
    if (!snapshot) {
      snapshot = pagination.snapshotTime;
      console.log(`\n  ${C.cyan('📸')} Snapshot locked: ${C.bold(snapshot)}`);
    }

    allIds.push(...products.map(p => p._id));

    process.stdout.write(
      `\r  Fetching… page ${C.bold(String(page))}` +
      ` | docs so far: ${C.bold(String(allIds.length))}` +
      ` | hasNext: ${pagination.hasNextPage}   `
    );

    if (!pagination.hasNextPage || page >= MAX_PAGES) break;
    cursor = pagination.nextCursor;
    await sleep(PAGE_DELAY_MS);
  }

  const capped = page >= MAX_PAGES;
  console.log(
    `\n  ${C.dim(`Done: ${page} pages, ${allIds.length} docs` +
    (capped ? ` (capped at MAX_PAGES=${MAX_PAGES})` : ''))}`
  );
  return { allIds, snapshot };
}

// ─── Verifications ────────────────────────────────────────────────────────────

// TEST 1 — Duplicate check
// A duplicate means the same _id was returned on more than one page.
// Root cause if this fails: cursor tiebreaker is broken or index is missing.
function checkDuplicates(allIds) {
  const seen  = new Set();
  const dupes = [];
  for (const id of allIds) {
    if (seen.has(id)) dupes.push(id);
    else seen.add(id);
  }
  return { unique: seen.size, total: allIds.length, dupes };
}

// TEST 2 — Insert leak check
// Products inserted AFTER snapshotTime have updatedAt > snapshotTime.
// The ceiling filter { updatedAt: { $lte: snapshotTime } } must exclude them.
// If any appear in results, the snapshot filter has a bug.
function checkInsertLeaks(allIds, mutator) {
  const seenSet = new Set(allIds);
  return [...mutator.insertedIds].filter(id => seenSet.has(id));
}

// ANALYSIS — Update eviction accounting
// Products updated after snapshotTime have updatedAt > snapshotTime and are
// evicted from the snapshot window.  If the user had already fetched them
// (they appear in allIds), that is CORRECT — they were seen before eviction.
// If they are NOT in allIds, they were evicted before being fetched — this is
// the documented trade-off, not a bug.
function analyseUpdates(allIds, mutator) {
  const seenSet = new Set(allIds);
  const seenBeforeEviction    = [...mutator.updatedIds].filter(id =>  seenSet.has(id));
  const evictedBeforeFetching = [...mutator.updatedIds].filter(id => !seenSet.has(id));
  return { seenBeforeEviction, evictedBeforeFetching };
}

// DB query — how many docs fall inside the snapshot window
async function countSnapshotWindow(snapshot) {
  return Product.countDocuments({
    updatedAt: { $lte: new Date(snapshot) },
    ...(TEST_CATEGORY && { category: TEST_CATEGORY }),
  });
}

// ─── Reporter ─────────────────────────────────────────────────────────────────
function printReport({ dupResult, insertLeaks, updateAnalysis, allIds, snapshot, mutator, windowSize }) {
  const PASS = label => `  ${C.bold(C.green('✔ PASS'))}  ${label}`;
  const FAIL = label => `  ${C.bold(C.red('✖ FAIL'))}  ${label}`;
  const INFO = label => `  ${C.bold(C.cyan('ℹ INFO'))}  ${C.dim(label)}`;

  const div = () => C.bold(C.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

  console.log('\n' + div());
  console.log(C.bold('  PAGINATION CORRECTNESS REPORT'));
  console.log(div() + '\n');

  // Summary panel
  console.log(`  Snapshot time         : ${C.bold(snapshot)}`);
  console.log(`  Docs in window (DB)   : ${C.bold(String(windowSize))}`);
  console.log(`  Docs fetched (API)    : ${C.bold(String(allIds.length))}`);
  console.log(`  Unique IDs fetched    : ${C.bold(String(dupResult.unique))}`);
  console.log(`  Mutations — inserts   : ${C.yellow(String(mutator.insertedIds.size))}`);
  console.log(`  Mutations — updates   : ${C.yellow(String(mutator.updatedIds.size))}\n`);

  // ── Test 1: No duplicates ──────────────────────────────────────────────────
  if (dupResult.dupes.length === 0) {
    console.log(PASS(`No duplicate products across all pages`));
  } else {
    console.log(FAIL(`${dupResult.dupes.length} duplicate(s) detected`));
    dupResult.dupes.slice(0, 5).forEach(id => console.log(`         ${C.red('→')} ${id}`));
  }

  // ── Test 2: No post-snapshot inserts leaked in ─────────────────────────────
  if (insertLeaks.length === 0) {
    console.log(PASS(`Post-snapshot inserts (${mutator.insertedIds.size}) excluded from feed`));
  } else {
    console.log(FAIL(`${insertLeaks.length} post-snapshot insert(s) leaked into feed`));
    insertLeaks.slice(0, 5).forEach(id => console.log(`         ${C.red('→')} ${id}`));
  }

  // ── Update analysis (informational — trade-off, not a bug) ────────────────
  const { seenBeforeEviction, evictedBeforeFetching } = updateAnalysis;
  console.log(INFO(
    `${seenBeforeEviction.length} updated products were fetched before eviction  (correct)`
  ));
  if (evictedBeforeFetching.length > 0) {
    console.log(INFO(
      `${evictedBeforeFetching.length} updated products evicted before user reached their page  (documented trade-off)`
    ));
  }

  // ── Verdict ───────────────────────────────────────────────────────────────
  const allPassed = dupResult.dupes.length === 0 && insertLeaks.length === 0;

  console.log('\n' + div());
  if (allPassed) {
    console.log(C.bold(C.green('  ✔  ALL TESTS PASSED')));
    console.log(C.dim('     Snapshot pagination is correct under concurrent mutations.'));
  } else {
    console.log(C.bold(C.red('  ✖  TESTS FAILED — see failures above')));
  }
  console.log(div() + '\n');

  return allPassed;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 5 });
  console.log(C.cyan('🔌  Connected to MongoDB'));
  console.log(C.bold('\n🧪  Pagination Correctness Test\n'));
  console.log(C.dim(`  API      : ${API_BASE}`));
  console.log(C.dim(`  Pages    : up to ${MAX_PAGES}  (${MAX_PAGES * PAGE_LIMIT} max docs)`));
  console.log(C.dim(`  Delay    : ${PAGE_DELAY_MS}ms / page`));
  console.log(C.dim(`  Filter   : ${TEST_CATEGORY || 'none'}\n`));

  const mutator = new BackgroundMutator();
  mutator.start();
  await sleep(150);    // brief head-start so mutations begin before page 1 is fetched

  const { allIds, snapshot } = await paginateAll();
  await mutator.stop();

  const dupResult      = checkDuplicates(allIds);
  const insertLeaks    = checkInsertLeaks(allIds, mutator);
  const updateAnalysis = analyseUpdates(allIds, mutator);
  const windowSize     = await countSnapshotWindow(snapshot);

  const passed = printReport({
    dupResult,
    insertLeaks,
    updateAnalysis,
    allIds,
    snapshot,
    mutator,
    windowSize,
  });

  await mongoose.disconnect();
  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error(C.red(`\n✖  Fatal: ${err.message}`));
  process.exit(1);
});