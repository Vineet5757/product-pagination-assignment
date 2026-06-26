const connectDB = async () => {
  try {
    console.log('MONGO_URI:', process.env.MONGO_URI); // ← ADD temporarily
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`DB Connection Error: ${err.message}`);
    process.exit(1);
  }
};
