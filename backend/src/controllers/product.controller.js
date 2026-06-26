'use strict';

const { listProducts } = require('../services/product.service');

const getProducts = async (req, res, next) => {
  try {
    const { cursor, category, limit, snapshotTime } = req.query;

    const result = await listProducts({ cursor, category, limit, snapshotTime });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getProducts };