const { signupModel } = require("../models/signupModel");
const { transactionModel, externalTransactionModel, linkedAccountModel } = require("../models/transactionModel");
const { v4: uuidv4 } = require("uuid");
const plaid = require("plaid");

require("dotenv").config()


const internalTransfer = async (req, res) => {
  try {
    const { receiverAccountNumber, amount, description } = req.body
    const senderId = req.user._id

    if (!receiverAccountNumber || !amount) {
      return res.status(400).json({ success: false, message : "All fields required" })    
    }

    const transferAmount = Number(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const sender = await signupModel.findById(senderId)
    const receiver = await signupModel.findOne({ accountNumber: receiverAccountNumber })

    if (!receiver) {
      return res.status(404).json({ success: false, message: "Receiver not found" })
    }

    if (sender.accountNumber === receiver.accountNumber) {
      return res.status(400).json({ success: false, message: "You cannot transfer to yourself" })
    }

    
    const transaction = new transactionModel({
      sender: sender._id,
      receiver: receiver._id,
      amount: transferAmount,
      description,
      reference: uuidv4(),
      status: "pending"
    })

    await transaction.save()

    
    if (sender.balance < transferAmount) {
      transaction.status = "failed"
      transaction.reason = "Insufficient balance"
      await transaction.save()
      return res.status(400).json({ success: false, message: "Insufficient balance" })
    }

   
    sender.balance = Number(sender.balance) - transferAmount
    receiver.balance = Number(receiver.balance) + transferAmount

    await Promise.all([sender.save(), receiver.save()])

    
    transaction.status = "success"
    await transaction.save()


    setTimeout(async () => {
      const checkTx = await transactionModel.findById(transaction._id)
      if (checkTx && checkTx.status === "pending") {
        checkTx.status = "failed"
        checkTx.reason = "Transaction timeout (5 minutes elapsed)"
        await checkTx.save()
      }
    }, 5 * 60 * 1000)

    res.status(200).json({
      success: true,
      msg: "Transfer successful",
      transaction
    })
  } catch (err) {
    console.error(err.message)


    try {
      const fallbackReceiver = req.body.receiverAccountNumber
      ? await signupModel.findOne({accountNumber: req.body.receiverAccountNumber})
      : null
      await transactionModel.create({
        sender: req.user?._id || null,
        receiver: fallbackReceiver?._id || undefined,
        amount: Number(req.body.amount) || 0,
        description: req.body.description || "",
        reference: uuidv4(),
        status: "failed",
        reason: err.message
      })
    } catch (logErr) {
      console.error("Error logging failed transaction:", logErr.message)
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message
    })
  }
}


const getReceiverAccountName = async (req, res) => {
  try {
    const { accountNumber } = req.params;

    
    const user = await signupModel.findOne({ accountNumber }).select("firstname lastname");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        firstname: user.firstname,
        lastname: user.lastname,
      },
    });
  } catch (err) {
    console.error("Error verifying receiver account:", err);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
};



const authorizeTransaction = async (req, res) => {
  const { transactionId } = req.params;
  const { action } = req.body; // action = "authorize" or "decline"

  try {
    const transaction = await transactionModel.findById(transactionId);
    if (!transaction) return res.status(404).json({ message: "Transaction not found" });

    if (transaction.status !== "pending")
      return res.status(400).json({ message: "Transaction already processed" });

    if (action === "authorize") {
      transaction.status = "authorized";
      await transaction.save();

      // optionally, update user balance
      const sender = await userModel.findById(transaction.sender);
      const receiver = await userModel.findById(transaction.receiver);

      if (transaction.type === "transfer") {
        sender.balance -= transaction.amount;
        receiver.balance += transaction.amount;
        await sender.save();
        await receiver.save();
      }

      res.status(200).json({ message: "Transaction authorized successfully" });
    } else if (action === "decline") {
      transaction.status = "declined";
      await transaction.save();
      res.status(200).json({ message: "Transaction declined" });
    } else {
      res.status(400).json({ message: "Invalid action" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error authorizing transaction", error });
  }
};







const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      status,         
      type,           
      startDate,      
      endDate,
      description,       
      page = 1,
      limit = 10
    } = req.query;

    
    const filter = {
      $or: [{ sender: userId }, { receiver: userId }],
    };

    
    if (status) {
      filter.status = status;
    }

   
    if (type === "sent") {
      filter.sender = userId;
    } else if (type === "received") {
      filter.receiver = userId;
    }

    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (description){
      filter.description = description
    }

   
    const skip = (Number(page) - 1) * Number(limit);

    const transactions = await transactionModel
      .find(filter)
      .populate("sender", "firstname lastname accountNumber")
      .populate("receiver", "firstname lastname accountNumber")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));


    const transactionWithType = transactions.map(tx => {
      const type = tx.sender._id.toString() === userId.toString() ? "sent" : "received"
      return {...tx._doc, type}
    })

    const total = await transactionModel.countDocuments(filter);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      count: transactionWithType.length,
      transactions: transactionWithType,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
}


const getAllTransactions = async (req, res) => {
  try {
    const transactions = await transactionModel
      .find()
      .populate("sender", "firstname lastname email")
      .populate("receiver", "firstname lastname email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, transactions });
  } catch (error) {
    console.error("getAllTransactions error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch transactions" });
  }
};


const client = new plaid.PlaidApi(
  new plaid.Configuration({
    basePath: plaid.PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  })
);


const createLinkToken = async (req, res) => {
  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: req.user._id.toString() },
      client_name: "My Bank App",
      products: process.env.PLAID_PRODUCTS.split(","),
      country_codes: process.env.PLAID_COUNTRY_CODES.split(","),
      language: "en",
    });

    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error creating link token" });
  }
};


const exchangePublicToken = async (req, res) => {
  try {
    const { public_token, metadata } = req.body;
    const response = await client.itemPublicTokenExchange({ public_token });

    const access_token = response.data.access_token;

    const accountInfo = metadata.accounts[0];
    const linkedAccount = await linkedAccountModel.create({
      user: req.user._id,
      bankName: metadata.institution.name,
      accountName: accountInfo.name,
      mask: accountInfo.mask,
      accountType: accountInfo.subtype,
      plaidAccountId: accountInfo.id,
      access_token,
    });

    res.json({
      success: true,
      msg: "Account linked successfully",
      linkedAccount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Error linking bank account" });
  }
};


const linkAccount = async (req, res) => {
  try {
    const accounts = await linkedAccountModel.find({ user: req.user._id });
    res.json({ success: true, accounts });
  } catch (err) {
    res.status(500).json({ success: false, msg: "Error fetching accounts" });
  }
}


const externalTransfer = async (req, res) => {
  const { access_token, account_id, amount, description } = req.body;

  try {
    // 1️⃣ Get Account + Numbers
    const authResponse = await client.authGet({ access_token });
    const account = authResponse.data.accounts.find(acc => acc.account_id === account_id);

    if (!account) return res.status(400).json({ msg: "Account not found" });

    // 2️⃣ Get funding source details
    const routing = authResponse.data.numbers.ach[0].routing;
    const accountNum = authResponse.data.numbers.ach[0].account;

    // 3️⃣ Create transfer authorization
    const sender = await signupModel.findById(req.user._id);

    const authorization = await client.transferAuthorizationCreate({
      access_token,
      account_id,
      type: "credit",
      network: "ach",
      amount,
      ach_class: "ppd",
      user: {
        legal_name: `${sender.firstname} ${sender.lastname}`,
        email_address: sender.email,
      },
    });


    // 4️⃣ Create the transfer
    const transfer = await client.transferCreate({
      access_token,
      account_id,
      authorization_id: authorization.data.authorization.id,
      description,
      amount: amount,
    });


    // After transfer is created
      const transaction = new externalTransactionModel({
        user: req.user._id,
        plaidTransferId: transfer.data.transfer.id,
        amount,
        description,
        receiverBankName: account.name || "External Bank",
        receiverAccountNumber: accountNum,
        receiverRoutingNumber: routing,
        status: "processing",
      });

      await transaction.save();


    console.log("✅ Transfer created:", transfer.data.transfer.id);

    res.json({
      success: true,
      msg: `Successfully transferred $${amount} via ACH.`,
      transfer_id: transfer.data.transfer.id,
    });
  } catch (err) {
    console.error("Transfer Error:", err.response?.data || err.message);
    res.status(500).json({
      msg: err.response?.data?.error_message || "Transfer failed.",
    });
  }
};



const plaidWebhook = async (req, res) => {
  try {
    const event = req.body;
    const plaidTransferId = event?.transfer?.id;

    if (!plaidTransferId) {
      return res.status(400).json({ success: false, msg: "Invalid webhook payload" });
    }

    const transaction = await externalTransactionModel.findOne({ plaidTransferId });
    if (!transaction) {
      return res.status(404).json({ success: false, msg: "Transaction not found" });
    }

    
    switch (event.event_type) {
      case "TRANSFER_COMPLETED":
        transaction.status = "completed";
        break;
      case "TRANSFER_FAILED":
        transaction.status = "failed";

        
        const user = await signupModel.findById(transaction.user);
        if (user) {
          user.balance += transaction.amount;
          await user.save();
        }
        break;
      case "TRANSFER_PROCESSING":
        transaction.status = "processing";
        break;
      default:
        transaction.status = "pending";
        break;
    }

    transaction.webhookEvent = event;
    await transaction.save();

    res.status(200).json({ success: true, msg: "Webhook processed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      msg: "Server error handling webhook",
      error: err.message,
    });
  }
};


const getExternalTransactions = async (req, res) => {

  try {
    const userId = req.user._id;

    const transactions = await externalTransactionModel
      .find({ user: userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      success: false,
      msg: "Error fetching transactions",
    });
  }
}


const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await transactionModel
      .findById(id)
      .populate("sender", "firstname lastname accountNumber")
      .populate("receiver", "firstname lastname accountNumber");

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: "Transaction not found",
      });
    }

    res.status(200).json({
      success: true,
      transaction,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


module.exports = { internalTransfer, getUserTransactions, externalTransfer,  authorizeTransaction, getAllTransactions, createLinkToken, exchangePublicToken, plaidWebhook, getExternalTransactions, getTransactionById, getReceiverAccountName, linkAccount };
