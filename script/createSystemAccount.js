const { signupModel } = require("../models/signupModel");
const { connectDB } = require("../database/database");
require("dotenv").config();

const createSystemAccount = async () => {
  try {
    // ✅ connect once using your helper
    await connectDB();

    const existing = await signupModel.findOne({ isSystem: true });

    if (existing) {
      console.log("✅ System account already exists");
      console.log("SYSTEM_ACCOUNT_ID:", existing._id.toString());
      process.exit(0);
    }

    const systemUser = await signupModel.create({
      firstname: "Bank",
      lastname: "System",
      email: "system@bank.com",
      accountNumber: "0000000000",
      role: "system",
      isSystem: true,
      balance: 0,
    });

    console.log("✅ System account created");
    console.log("SYSTEM_ACCOUNT_ID:", systemUser._id.toString());

    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to create system account:", err.message);
    process.exit(1);
  }
};

createSystemAccount();
