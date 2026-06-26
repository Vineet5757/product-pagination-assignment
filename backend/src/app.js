const express   = require('express');
const cors      = require('cors');                          // ← ADD
const { errorHandler } = require('./middleware/errorHandler');
const productRoutes    = require('./routes/product.routes');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' })); // ← ADD
app.use(express.json());
app.use('/api/products', productRoutes);
app.use(errorHandler);

module.exports = app;