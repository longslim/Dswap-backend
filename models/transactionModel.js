const mongoose = require("mongoose")





const transactionSchema = mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true]
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true]
    },
    amount: {
        type: Number,
        required: [true],
        min:[0, "Amount must be greater than Zero"]
    },
    description: {
        type: String,
        default: "Transfer between users",
    },
    reference: {
        type: String,
        unique: true,
    },
    status: {
        type: String,
        enum: ["success", "failed", "pending", "completed"],
        default: "pending",
        required: [true]
    },
    reason: {
        type: String,
        default: ""
    }
},
    {timestamps: true}
)


transactionSchema.pre("save", function (next) {
    this.updatedAt = new Date()
    next()
})


const externalTransactionSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: [true]
    },
    plaidTransferId: {
        type: String,
        required: [true],
        unique: true
    },
    receiverBankName: {
        type: String,
        required: [true]
    },
    receiverAccountNumber: {
        type: String,
        required: [true]
    },
    receiverRoutingNumber: {
        type: String,
        required: [true]
    },
    amount: {
        type: Number,
        required: [true]
    },
    description: {
        type: String
    },
    status: {
        type: String,
        enum: ["pending", "processing", "failed", "completed", "authorize"],
        default: "pending"
    },
    reference: {
        type: String,
        required: [true]
    },
    webHookEvent: {
        type: Object,
        default: {}
    }
},
    {timestamps: true}
)

const linkedAccountSchema =  mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "signupModel", required: true },
    bankName: String,
    accountName: String,
    mask: String,
    accountType: String,
    plaidAccountId: String,
    access_token: String
  }, { timestamps: true });

const transactionModel = mongoose.model("transaction", transactionSchema)

const externalTransactionModel = mongoose.model("externalTransaction", externalTransactionSchema)

const linkedAccountModel = mongoose.model("linkedAccount", linkedAccountSchema)

module.exports= {transactionModel, externalTransactionModel, linkedAccountModel}