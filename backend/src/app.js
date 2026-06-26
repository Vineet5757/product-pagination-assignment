const express   = require('express');
const cors      = require('cors');                          // ← ADD
const { errorHandler } = require('./middleware/errorHandler');
const productRoutes    = require('./routes/product.routes');

const app = express();

app.use(cors({
  origin: 'https://product-pagination-assignment-2wvu4s733-vinit-gaikwads-projects.vercel.app'
}));
app.use(express.json());
app.use('/api/products', productRoutes);
app.use(errorHandler);

module.exports = app;