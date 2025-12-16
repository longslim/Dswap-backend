const mongoose = require("mongoose")



const userSchema = mongoose.Schema({
    firstname: {
        type: String,
        required: [true, "firstname is required"]
    },
    lastname: {
        type: String,
        required: [true, "lastname is required"]
    },
    email: {
        type: String,
        required: [true, "email is required"],
        unique: true,
        lowercase: true
    },
    dob: {
        type: Date,
        required: function () {
            return !this.isSystem;
          }
    },
    mobileNo: {
        type: String,
        required: function () {
            return !this.isSystem;
          },
        unique: true
    },
    address: {
        type: String,
        required: function () {
            return !this.isSystem;
          }
    },
    ssn: {
        type: String,
        required: function () {
            return !this.isSystem;
          },
        unique: true,
    },
    idType: {
        type: String,
        enum:["Driver License", "State ID"],
        required: function () {
            return !this.isSystem;
          }
    },
    frontId: {
        type: String,
        required: function () {
            return !this.isSystem;
          },
        unique: true
    },
    backId: {
        type: String,
        required: function () {
            return !this.isSystem;
          },
        unique: true
    },
    password: {
        type: String,
        required: function () {
            return !this.isSystem;
          }
    },
    balance: {
        type: Number,
        default: 0
    },
    btcBalance: {
        type: mongoose.Schema.Types.Decimal128,
        default: 0.00000000,
        get: (v) => parseFloat(v.toString()),
        set: (v) => parseFloat(v)
    },
    accountNumber: {
        type: String,
        unique: true
    },
    routingNumber: {
        type: String,
        unique: true
    },
    cardNumber: {
        type: String,
        unique: true,
        
    },
    cvv: {
        type: String,
        unique: true,
        
    },
    expiryDate: {
        type: String,
        
        
    },
    role: {
        type: String,
        enum: ["user", "admin", "system"],
        default: "user"
    },
    cardPin: {
        type: String,
        select: false
    },
    isSystem: {
        type: Boolean,
        default: false
    }

},
    {timestamps: true, toJSON: {getters: true}, toObject: {getters: true}}
)





const signupModel = mongoose.model("user", userSchema)




module.exports= {signupModel}