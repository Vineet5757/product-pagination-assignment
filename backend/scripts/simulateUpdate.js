'use strict';

require('dotenv').config();
const mongoose   = require('mongoose');
const { faker }  = require('@faker-js/faker');
const { Product, CATEGORIES } = require('../src/models/Product');

// ─── Config ───────────────────────────────────────────────────────────────────
const INSERT_INTERVAL_MS = 3_000;   // insert burst every 3 s
const UPDATE_INTERVAL_MS = 4_000;   // update burst every 4 s
const INSERT_BATCH_SIZE  = 15;
const UPDATE_BATCH_SIZE  = 15;

// ─── ANSI helpers ─────────────────────────────────────────────────────────────
const C = {
  green  : s => `\x1b[32m${s}\x1b[0m`,
  yellow : s => `\x1b[33m${s}\x1b[0m`,
  cyan   : s => `\x1b[36m${s}\x1b[0m`,
  red    : s => `\x1b[31m${s}\x1b[0m`,
  bold   : s => `\x1b[1m${s}\x1b[0m`,
  dim    : s => `\x1b[2m${s}\x1b[0m`,
};
const ts = () => C.dim(`[${new Date().toISOString()}]`);

// ─── State ────────────────────────────────────────────────────────────────────
let totalInserted = 0;
let totalUpdated  = 0;
let runtimeSec    = 0;

// ─── Product Factory ──────────────────────────────────────────────────────────
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

// ─── Insert Burst ─────────────────────────────────────────────────────────────
// Inserts brand-new products whose updatedAt = now.
// If a user's snapshotTime < now, these docs land ABOVE the snapshot ceiling
// and are invisible to any active browsing session — by design.
async function runInsert() {
  const docs     = Array.from({ length: INSERT_BATCH_SIZE }, buildProduct);
  const inserted = await Product.insertMany(docs, { ordered: false, timestamps: false });
  totalInserted += inserted.length;

  const preview = inserted.slice(0, 2).map(d => d._id.toString()).join(', ');
  console.log(
    `${ts()} ${C.bold(C.green('INS'))} +${inserted.length}` +
    ` | cumulative: ${C.bold(String(totalInserted))}` +
    ` | ids: ${C.dim(preview)}${inserted.length > 2 ? C.dim(' ...') : ''}`
  );
}

// ─── Update Burst ─────────────────────────────────────────────────────────────
// Picks random existing docs and bumps their updatedAt to now.
// This moves them ABOVE the snapshot ceiling, evicting them from any live session.
// The trade-off is documented: evicted docs are missed until the user refreshes.
async function runUpdate() {
  const sample = await Product.aggregate([
    { $sample : { size : UPDATE_BATCH_SIZE } },
    { $project : { _id  : 1 } },
  ]);
  if (!sample.length) return;

  const ids = sample.map(d => d._id);
  await Product.updateMany(
    { _id: { $in: ids } },
    { $set: { price: parseFloat(faker.commerce.price({ min: 1, max: 9999, dec: 2 })), updatedAt: new Date() } }
  );
  totalUpdated += ids.length;

  const preview = ids.slice(0, 2).map(i => i.toString()).join(', ');
  console.log(
    `${ts()} ${C.bold(C.yellow('UPD'))} ~${ids.length}` +
    ` | cumulative: ${C.bold(String(totalUpdated))}` +
    ` | ids: ${C.dim(preview)}${ids.length > 2 ? C.dim(' ...') : ''}`
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 5 });
  console.log(C.cyan('\n🔌  Connected to MongoDB'));
  console.log(C.bold('\n🔄  simulateUpdates running — Ctrl+C to stop\n'));
  console.log(C.dim(`   Inserting ${INSERT_BATCH_SIZE} docs every ${INSERT_INTERVAL_MS}ms`));
  console.log(C.dim(`   Updating  ${UPDATE_BATCH_SIZE} docs every ${UPDATE_INTERVAL_MS}ms\n`));

  const insertTimer = setInterval(
    () => runInsert().catch(e => console.error(C.red(`\n[insert error] ${e.message}`))),
    INSERT_INTERVAL_MS
  );
  const updateTimer = setInterval(
    () => runUpdate().catch(e => console.error(C.red(`\n[update error] ${e.message}`))),
    UPDATE_INTERVAL_MS
  );
  const statusTimer = setInterval(() => {
    runtimeSec++;
    process.stdout.write(
      `\r  ${C.dim(`⏱  ${runtimeSec}s`)}` +
      `  inserted: ${C.green(String(totalInserted))}` +
      `  updated: ${C.yellow(String(totalUpdated))}   `
    );
  }, 1_000);

  process.on('SIGINT', async () => {
    clearInterval(insertTimer);
    clearInterval(updateTimer);
    clearInterval(statusTimer);
    console.log(C.bold(C.cyan('\n\n━━━ Final Stats ━━━')));
    console.log(`  Inserted : ${C.green(String(totalInserted))}`);
    console.log(`  Updated  : ${C.yellow(String(totalUpdated))}`);
    console.log(`  Runtime  : ${runtimeSec}s\n`);
    await mongoose.disconnect();
    process.exit(0);
  });
}

main().catch(err => {
  console.error(C.red(`Fatal: ${err.message}`));
  process.exit(1);
});