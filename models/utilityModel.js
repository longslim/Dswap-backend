const mongoose = require("mongoose")


const utilitySchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    utilityProvider: {
        type: String,
        required: true
    },
    accountNumber: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "processing", "success", "failed"],
        default: "pending"
    },
    category: {
        type: String,
        enum: [
            "electricity",
            "tv",
            "shopping",
            "transport",
            "embassy",
            "travel"
        ],
        required: true
    },
    reference: {
        type: String,
        unique: true
    },
    receiptUrl: {
        type: String
    },
    settledAt: {
        type: Date
    }
},
    {timestamps: true, toJSON: {getters: true}, toObject: {getters: true}}
)


const utilityModel = mongoose.model("utility", utilitySchema)

module.exports = {utilityModel}