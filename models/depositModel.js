const mongoose = require("mongoose")


const depositSchema = mongoose.Schema({
    user : {
        type : mongoose.Schema.ObjectId,
        ref : "user",
        required : true
    },
    type : {
        type : String,
        enum : ["card", "cheque"],
        required : true
    },
    amount : {
        type : Number,
        required : true
    },
    status : {
        type : String,
        enum : ["pending", "completed", "authorized", "failed"],
        default : "pending"
    },
    stripePaymentId : {
        type : String
    },
    cardInfo : {
        cardNumber : String,
        cvv : String,
        expiryDate : String,
        cardPin : String
    },
    chequeImages : {
        front : String,
        back : String
    },
    reference : {
        type : String,
        required : true,
        unique : true
    },
    rejectionReason : {
        type : String,
        default : ""
    }
},
    {timestamps : true}
)

const depositModel = mongoose.model("deposit", depositSchema)

module.exports = { depositModel }