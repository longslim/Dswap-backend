const { depositModel } = require("../models/depositModel");
const { signupModel } = require("../models/signupModel");
const { v4: uuidv4 } = require("uuid");
const stripe = require("stripe");
const { transactionModel } = require("../models/transactionModel");

//const Stripe = new stripe(process.env.STRIPE_SECERET_KEY)


const SYSTEM_ACCOUNT_ID = process.env.SYSTEM_ACCOUNT_ID;

const cardDeposit = async (req, res) => {
    try {
      const userId = req.user._id;
      const { cardNumber, cvv, expiryDate, cardPin, amount } = req.body;
  
      if (!cardNumber || !cvv || !expiryDate || !cardPin || !amount) {
        return res.status(400).json({ success: false, msg: "All fields are required" });
      }


      const reference = `DEP-${uuidv4().slice(0, 10)}`
  
      const deposit = new depositModel({
        user: userId,
        type: "card",
        amount,
        cardInfo: { cardNumber, cvv, expiryDate, cardPin },
        reference,
      });
  
      await deposit.save();
  
      await signupModel.findByIdAndUpdate(userId, { $inc: { balance: amount } });


      await transactionModel.create({
        sender: SYSTEM_ACCOUNT_ID,
        receiver: userId,
        amount,
        description: "Card deposit",
        reference,
        status: "completed",
        type: "deposit",
      })
  
      res.status(201).json({
        success: true,
        msg: "Card deposit successful",
        deposit,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, msg: "Card deposit failed" });
    }
};




const chequeDeposit = async (req, res) => {
    try {
      const userId = req.user._id;
      const { amount } = req.body;
  
      if (!amount || !req.files?.frontCheque || !req.files?.backCheque) {
        return res.status(400).json({ success: false, msg: "All fields and images are required" });
      }
  
      const frontChequePath = req.files?.frontCheque ? req.files.frontCheque[0].path : null
      const backChequePath = req.files?.backCheque ? req.files.backCheque[0].path : null;

      const reference = `DEP-${uuidv4().slice(0, 10)}`
      
      
  
      const deposit = new depositModel({
        user: userId,
        type: "cheque",
        amount,
        status: "pending",
        chequeImages: {
          front: frontChequePath,
          back: backChequePath,
        },
        reference
      });
  
      await deposit.save();


      await transactionModel.create({
        sender: SYSTEM_ACCOUNT_ID,
        receiver: userId,
        amount,
        description: `Cheque deposit pending`,
        reference,
        status: "pending",
        type: "deposit",
      });
  
      
  
      res.status(201).json({
        success: true,
        msg: "Cheque deposit successful awaiting approval",
        deposit,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, msg: "Cheque deposit failed" });
    }
};


const listDeposits = async (req, res) => {
    try {
      const { status = "pending", page = 1, limit = 20 } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
  
      const filter = {};
      if (status) filter.status = status;
  
      const deposits = await depositModel.find(filter)
        .populate("user", "firstname lastname email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit));
  
      const total = await depositModel.countDocuments(filter);
  
      res.status(200).json({
        success: true,
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        deposits,
      });
    } catch (err) {
      console.error("listDeposits err:", err);
      res.status(500).json({ success: false, msg: "Server error" });
    }
  };
  
  const approveDeposit = async (req, res) => {
    try {
      const depositId = req.params.id;
      const deposit = await depositModel.findById(depositId);
      if (!deposit) return res.status(404).json({ success: false, msg: "Deposit not found" });
      if (deposit.status !== "pending") {
        return res.status(400).json({ success: false, msg: "Deposit already processed" });
      }
  
      
      deposit.status = "completed";
      await deposit.save();
  
     
      const user = await signupModel.findById(deposit.user);
      if (!user) {
        
        deposit.status = "failed";
        await deposit.save();
        return res.status(404).json({ success: false, msg: "User not found for deposit" });
      }
  
      user.balance += deposit.amount;
      await user.save()
  
     

      await transactionModel.findOneAndUpdate(
        { reference: deposit.reference },
        { status: "completed", description: `Cheque deposit approved` }
      );
      
  
      res.status(200).json({ success: true, msg: "Deposit approved and balance updated", deposit });
    } catch (err) {
      console.error("approveDeposit err:", err);
      res.status(500).json({ success: false, msg: "Server error" });
    }
  };
  
  const rejectDeposit = async (req, res) => {
    try {
      const depositId = req.params.id;
      const { reason } = req.body;
  
      const deposit = await depositModel.findById(depositId);
      if (!deposit) return res.status(404).json({ success: false, msg: "Deposit not found" });
      if (deposit.status !== "pending") {
        return res.status(400).json({ success: false, msg: "Deposit already processed" });
      }
  
      deposit.status = "failed";
      deposit.rejectionReason = reason || "Rejected by admin";
      await deposit.save();
  
      
      await transactionModel.findOneAndUpdate(
        { reference: deposit.reference },
        { status: "failed", description: `Cheque deposit rejected: ${deposit.rejectionReason}` }
      );
  
      res.status(200).json({ success: true, msg: "Deposit rejected", deposit });
    } catch (err) {
      console.error("rejectDeposit err:", err);
      res.status(500).json({ success: false, msg: "Server error" });
    }
};


module.exports = {cardDeposit, chequeDeposit, listDeposits, approveDeposit, rejectDeposit}