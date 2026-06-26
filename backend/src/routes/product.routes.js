'use strict';

const express         = require('express');
const { getProducts } = require('../controllers/product.controller');

const router = express.Router();

/**
 * GET /api/products
 *
 * Query params:
 *   limit        {number}  Docs per page            default: 20, max: 100
 *   cursor       {string}  Opaque token (from prev response)
 *   category     {string}  Filter by category
 *   snapshotTime {string}  ISO 8601 — REQUIRED on page 2+, absent on page 1
 *
 * Session contract:
 *   Page 1  →  GET /api/products?limit=20
 *              ← Response includes snapshotTime
 *
 *   Page 2+ →  GET /api/products?limit=20&cursor=<token>&snapshotTime=<iso>
 *              ← Same snapshotTime echoed back
 *
 *   With category:
 *   Page 1  →  GET /api/products?category=Electronics&limit=20
 *   Page 2+ →  GET /api/products?category=Electronics&cursor=<token>&snapshotTime=<iso>
 */
router.get('/', getProducts);

module.exports = router;