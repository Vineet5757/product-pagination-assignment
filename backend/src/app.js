const express   = require('express');
const cors      = require('cors');                          // ← ADD
const { errorHandler } = require('./middleware/errorHandler');
const productRoutes    = require('./routes/product.routes');

const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : [
      'https://product-pagination-assignment-2wvu4s733-vinit-gaikwads-projects.vercel.app',
      'http://localhost:5173',
    ];

app.use(cors({
  origin: allowedOrigins,
}));
app.use(express.json());
app.use('/api/products', productRoutes);
app.use(errorHandler);

module.exports = app;
