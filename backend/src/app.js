const express   = require('express');
const cors      = require('cors');
const { errorHandler } = require('./middleware/errorHandler');
const productRoutes    = require('./routes/product.routes');

const app = express();
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Product Pagination API is running" });
});

app.use(cors());
app.use(express.json());
app.use('/api/products', productRoutes);
app.use(errorHandler);

module.exports = app;
