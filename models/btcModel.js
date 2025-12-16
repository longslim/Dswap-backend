const mongoose = require("mongoose")


const btcSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    type: {
        type: String,
        enum: ["btc_deposit", "btc_withdrawal"],
        required: true
    },
    btcAmount: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0,
        required: true
    },
    currency: {
        type: String,
        enum: ["USD", "BTC"],
        default: "USD"
    },
    btcAddress: {
        type: String
    },
    txHash: {
        type: String
    },
    referenceId: {
        type: String
    },
    status: {
        type: String,
        enum: ["pending", "confirmed", "failed", "completed", "approved", "rejected"],
        default: "pending"
    },
    metadata: {
        type: Object,
        default: {}
    }

},
    {timestamps: true, toJSON: {getters: true}, toObject: {getters: true}}
)

btcSchema.path("btcAmount").get(v => (v ? parseFloat(v.toString()) : 0))

const ledgerSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    tx: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "btcTransaction"
    },
    asset: {
        type: String,
        required: true
    },
    change: {
        type: mongoose.Schema.Types.Decimal128,
        required: true
    },
    balanceAfter: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0
    },
    kind: {
        type: String,
        enum: ["deposit", "withdrawal", "fee", "adjustment", "reward", "internal"],
        required: true
    },
    metadata: {
        type: Object,
        default: {}
    }
},
    {timestamps: true, toJSON: {getters: true}, toObject: {getters: true}}
)

ledgerSchema.path("change").get(v => (v ? parseFloat(v.toString()) : 0))
ledgerSchema.path("balanceAfter").get(v => (v ? parseFloat(v.toString()) : 0))

const btcModel = mongoose.model("btcTransaction", btcSchema)

const ledgerModel = mongoose.model("ledgerEntry", ledgerSchema)


module.exports = {btcModel, ledgerModel}