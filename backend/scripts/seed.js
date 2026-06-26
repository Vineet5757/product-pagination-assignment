require('dotenv').config();
const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const { Product, CATEGORIES } = require('../src/models/Product');

// ─── Tuning Constants ─────────────────────────────────────────────────────────
const TOTAL_RECORDS  = 200_000;
const BATCH_SIZE     = 5_000;   // sweet spot: large enough to amortize round-trips,
                                 // small enough to stay within MongoDB's 16 MB BSON limit
                                 // and avoid V8 heap pressure during array construction.
const TOTAL_BATCHES  = Math.ceil(TOTAL_RECORDS / BATCH_SIZE);

// ─── Timestamp Helpers ────────────────────────────────────────────────────────
// Products spread across the last 3 years to simulate real growth data.
const NOW         = Date.now();
const THREE_YEARS = 3 * 365 * 24 * 60 * 60 * 1000;
const RANGE_START = NOW - THREE_YEARS;

function randomPastDate() {
  return new Date(RANGE_START + Math.random() * THREE_YEARS);
}

// ─── Product Factory ──────────────────────────────────────────────────────────
// Called once per document — kept lean to minimise per-item cost.
function buildProduct() {
  const createdAt  = randomPastDate();
  // updatedAt is createdAt or up to 90 days later, whichever is earlier than NOW.
  const maxDelta   = Math.min(90 * 24 * 60 * 60 * 1000, NOW - createdAt.getTime());
  const updatedAt  = new Date(createdAt.getTime() + Math.random() * maxDelta);

  return {
    name      : faker.commerce.productName(),
    category  : CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
    price     : parseFloat(faker.commerce.price({ min: 1, max: 9999, dec: 2 })),
    createdAt,
    updatedAt,
  };
}

// ─── Batch Builder ────────────────────────────────────────────────────────────
// Builds one batch as a plain array of POJOs — no Mongoose overhead per document.
// insertMany() with { ordered: false } lets Mongo parallelise writes internally.
function buildBatch(size) {
  const batch = new Array(size);
  for (let i = 0; i < size; i++) batch[i] = buildProduct();
  return batch;
}

// ─── Progress Renderer ────────────────────────────────────────────────────────
function printProgress(done, total, startTime) {
  const pct     = ((done / total) * 100).toFixed(1);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const rate    = Math.round(done / elapsed);
  process.stdout.write(
    `\r  Inserted: ${done.toLocaleString()} / ${total.toLocaleString()}` +
    `  (${pct}%)  ${rate.toLocaleString()} docs/sec  [${elapsed}s]   `
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 5 });
  console.log('✔  Connected to MongoDB\n');

  // Wipe existing data so re-runs are idempotent.
  await Product.deleteMany({});
  console.log('✔  Cleared existing products\n');

  const startTime  = Date.now();
  let   inserted   = 0;

  for (let b = 0; b < TOTAL_BATCHES; b++) {
    const remaining  = TOTAL_RECORDS - inserted;
    const batchSize  = Math.min(BATCH_SIZE, remaining);
    const docs       = buildBatch(batchSize);

    // ordered: false — Mongo does not stop on a single doc error,
    // and allows the server to reorder writes for throughput.
    // timestamps: false — we are supplying our own timestamps;
    // disabling prevents Mongoose from overwriting them.
    await Product.insertMany(docs, { ordered: false, timestamps: false });

    inserted += batchSize;
    printProgress(inserted, TOTAL_RECORDS, startTime);
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n\n✔  Seeded ${inserted.toLocaleString()} products in ${totalSec}s`);
  console.log(`   Avg throughput: ${Math.round(inserted / totalSec).toLocaleString()} docs/sec\n`);
}

seed()
  .catch((err) => {
    console.error('\n✖  Seed failed:', err.message);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());