require('dotenv').config();
const app       = require('./src/app');        // ← ./src/app not ./app
const connectDB = require('./src/config/db');  // ← ./src/config/db

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
