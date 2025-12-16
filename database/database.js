const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_CONNECTION_URL);
    console.log("✅ Connected to database successfully");
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1); // stop app if DB fails
  }
};

module.exports = { connectDB };
