const mongoose = require('mongoose');

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home & Kitchen',
  'Sports & Outdoors',
  'Books',
  'Beauty & Personal Care',
  'Toys & Games',
  'Automotive',
  'Health & Wellness',
  'Food & Grocery',
];

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Name cannot exceed 200 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: CATEGORIES,
        message: '{VALUE} is not a valid category',
      },
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
  },
  {
    timestamps: true, // auto-manages createdAt and updatedAt
    versionKey: false,
  }
);

// ─── REPLACE previous two index lines with these ──────────────────────────────
// We sort by updatedAt (not createdAt) so indexes must lead with updatedAt.

// INDEX 1 — default feed (no category filter)
// Covers: sort { updatedAt:-1, _id:-1 } on full collection.
// _id as tiebreaker guarantees a fully stable order when two docs share
// the same updatedAt — essential for cursor correctness.
productSchema.index({ updatedAt: -1, _id: -1 });

// INDEX 2 — filtered feed
// Covers: equality on category, then sort { updatedAt:-1, _id:-1 }.
// Prefix rule: equality field (category) must come first so MongoDB can
// satisfy both the filter and the sort from a single index scan.
productSchema.index({ category: 1, updatedAt: -1, _id: -1 });

// ─── WHY NOT skip/limit? ──────────────────────────────────────────────────────
// skip(N) forces MongoDB to scan and discard N documents on every paginated request.
// At 200k records, page 500 with limit 20 = scanning 10,000 docs just to throw them away.
// Cursor-based pagination uses { createdAt, _id } from the last seen item as a
// "bookmark", so every page query hits the index directly — O(log N) regardless
// of page depth. Also immune to insertion/deletion shifting pages.

module.exports = {
  Product: mongoose.model('Product', productSchema),
  CATEGORIES,
};
