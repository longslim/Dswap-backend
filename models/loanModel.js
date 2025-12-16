const mongoose = require("mongoose")



const loanSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    durationMonths: {
        type: Number,
        default: 10
    },
    status: {
        type: String,
        enum: ["pending", "awaiting-btc", "processing", "approved", "rejected", "completed"],
        default: "pending"
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "admin"
    },
    btcAddress: {
        type: String
    },
    btcPaymentPercent: {
        type: Number,
        default: 10
    },
    btcTxHash: {
        type: String
    },
    btcVerified: {
        type: Boolean,
        default: false
    },
    adminMessage: {
        type: String
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    btcAmountRequired: Number,
    totalRepayable: Number,
    monthlyPayment: Number,
    interestRate: Number,
    nextPaymentDate: Date,
    remainingBalance: Number,
    paymentsMade: Number,
    totalPayments: Number
},
{timestamps: true, toJSON: {getters: true}, toObject: {getters: true}}
)


const loanModel = mongoose.model("loan", loanSchema)

module.exports = {loanModel}