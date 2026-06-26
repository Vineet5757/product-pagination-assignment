'use strict';

const mongoose = require('mongoose');
const { Product } = require('../models/Product');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;
const SNAPSHOT_TTL  = 24 * 60 * 60 * 1000;   // 24 h — reject stale sessions

// ─── Cursor Codec ─────────────────────────────────────────────────────────────
function encodeCursor(doc) {
  const payload = JSON.stringify({
    t : doc.updatedAt.toISOString(),
    i : doc._id.toString(),
  });
  return Buffer.from(payload)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeCursor(token) {
  try {
    const b64       = token.replace(/-/g, '+').replace(/_/g, '/');
    const { t, i }  = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return {
      cursorTime : new Date(t),
      cursorId   : new mongoose.Types.ObjectId(i),
    };
  } catch {
    const err = new Error('Invalid or corrupted pagination cursor');
    err.statusCode = 400;
    throw err;
  }
}

// ─── Snapshot Parser ──────────────────────────────────────────────────────────
// First request  → snapshotTime is absent → we mint `new Date()` as the ceiling.
// All subsequent → client echoes back the same ISO string we returned in page 1.
// This gives every user their own private "view" of the dataset, frozen in time.
function parseSnapshot(raw) {
  if (!raw) return new Date();          // first page — create the snapshot now

  const d = new Date(raw);
  if (isNaN(d.getTime())) {
    const err = new Error('snapshotTime must be a valid ISO 8601 string');
    err.statusCode = 400;
    throw err;
  }

  // Expire stale sessions — prevents users from paginating against a
  // snapshot so old that it no longer reflects any reasonable "current" data.
  if (Date.now() - d.getTime() > SNAPSHOT_TTL) {
    const err = new Error(
      'Browsing session expired (>24 h). Refresh to start a new session.'
    );
    err.statusCode = 410;    // 410 Gone — semantically: this resource is gone
    throw err;
  }

  return d;
}

// ─── Filter Builder ───────────────────────────────────────────────────────────
//
// The filter must satisfy ALL three constraints simultaneously:
//
//   [1] category   = X                (optional equality)
//   [2] updatedAt <= snapshotTime     (snapshot ceiling — the key innovation)
//   [3] position past the cursor      (standard cursor boundary)
//
// Constraint [2] is what "freezes" the dataset.  Any document inserted or
// updated AFTER snapshotTime gets a new updatedAt > snapshotTime and is
// therefore invisible to this browsing session — regardless of how many
// pages the user has already fetched.
//
// MongoDB index used: { category:1, updatedAt:-1, _id:-1 }
// The $and lets the planner apply [2] as an upper-range bound and [3] as
// a lower-range bound on the SAME index scan — O(log N + page) total cost.
//
function buildFilter({ cursor, category, snapshot }) {
  const snapshotCeiling = { updatedAt: { $lte: snapshot } };

  // Cursor boundary — same $or tiebreaker as Part 3
  const cursorFloor = cursor
    ? (() => {
        const { cursorTime, cursorId } = decodeCursor(cursor);
        return {
          $or: [
            { updatedAt: { $lt: cursorTime } },
            { updatedAt: cursorTime, _id: { $lt: cursorId } },
          ],
        };
      })()
    : null;

  const filter = {};
  if (category) filter.category = category;

  if (cursorFloor) {
    // Both bounds must hold: $and merges ceiling + floor into a single range
    filter.$and = [snapshotCeiling, cursorFloor];
  } else {
    // First page — only the ceiling matters
    filter.updatedAt = { $lte: snapshot };
  }

  return filter;
}

// ─── Service ──────────────────────────────────────────────────────────────────
async function listProducts({ cursor, category, limit, snapshotTime }) {
  const safeLimit = Math.min(
    Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );

  const snapshot  = parseSnapshot(snapshotTime);
  const filter    = buildFilter({ cursor, category, snapshot });

  // +1 trick: fetch one extra to detect hasNextPage without an extra COUNT query
  const docs = await Product
    .find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(safeLimit + 1)
    .lean();                  // skip Mongoose hydration — ~40 % faster for reads

  const hasNextPage = docs.length > safeLimit;
  const products    = hasNextPage ? docs.slice(0, safeLimit) : docs;
  const nextCursor  = hasNextPage
    ? encodeCursor(products[products.length - 1])
    : null;

  return {
    products,
    pagination: {
      limit        : safeLimit,
      count        : products.length,
      hasNextPage,
      nextCursor,
      // ↓ Client MUST echo this value in every subsequent request.
      //   Omitting it on page 2+ would mint a new snapshot and restart the session.
      snapshotTime : snapshot.toISOString(),
    },
  };
}

module.exports = { listProducts };