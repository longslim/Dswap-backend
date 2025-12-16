const { signupModel } = require("../models/signupModel")
const { transactionModel } = require("../models/transactionModel")
const { utilityModel } = require("../models/utilityModel")
const bcrypt = require("bcryptjs")



const generateReference = () => {
    return "UTIL-" + Date.now() + "-" + Math.floor(Math.random() * 10000)
}

const SYSTEM_ACCOUNT_ID = process.env.SYSTEM_ACCOUNT_ID;


const payUtility = async (req, res) => {
    try {
      const {utilityProvider, category, accountNumber, amount, cardPin} = req.body
      const userId = req.user._id
      
      if (!utilityProvider || !category || !accountNumber || !amount || !cardPin) {
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        })
      }

      const user = await signupModel.findById(userId).select("+cardPin")
      if(!user)
        return res.status(404).json({success: false, message: "User not found"})


      if (!user.cardPin) {
        return res.status(400).json({
          success: false,
          message: "Transaction PIN not set. Please create a PIN first.",
        });
      }
      
      const validPin = await bcrypt.compare(cardPin, user.cardPin)

      if(!validPin) {
        return res.status(401).json({
            success: false,
            message: "Invalid transaction Pin"
        })
      }


      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount",
        });
      }
      

      if (user.balance < amount) {
        return res.status(400).json({
            success: false,
            message: "Insufficient funds"
        })
      }

      user.balance -=amount
      await user.save()

      const newPayment = await utilityModel.create({
        user: userId,
        utilityProvider,
        category,
        accountNumber,
        amount,
        status: "pending",
        reference: generateReference()
      })


      await transactionModel.create({
        sender: userId,
        receiver: SYSTEM_ACCOUNT_ID ,
        amount: amount,
        type: "utility-payment",
        status: "pending",
        reference: newPayment.reference,
        description: `${utilityProvider} Bill Payment Pending`
    })

      return res.status(201).json({
        success: true,
        message: "Utility payment initiated successfully",
        payment: newPayment
      })
    } catch (err) {
        console.log("Utility payment Error:", err)
        return res.status(500).json({success: false, message: "Server Error"})
    }
}

const getUtilityPayments = async (req, res) => {
    try {
        const pending = await utilityModel
        .find({status: "pending"})
        .populate("user", "firstname lastname email accountNumber")

        return res.json({
            success: true,
            count: pending.length,
            pending
        })
    } catch (err) {
        console.log("Get pending Utility Error:", err)
        return res.status(500).json({success: false, message: "Server Error"})
    }
}



const approveUtilityPayment = async (req, res) => {
   try {
    const {id} = req.params

    const payment = await utilityModel.findById(id)
    if(!payment) 
        return res.status(404).json({success: false, message: "Payment not found"})

    if(payment.status !== "pending") {
        return res.status(400).json({
            success: false,
            message: "Payment already processed"
        })
    }

    payment.status = "success"
    payment.settledAt = new Date()
    await payment.save()

    await transactionModel.findOneAndUpdate(
        { reference: payment.reference },
        { status: "completed", description: `${payment.utilityProvider} Bill Payment successful` }
      );

    return res.json({
        success: true,
        message: "Utility payment approved successfully"
    })
   } catch (err) {
    console.log("Approve Utility Error:", err)
    return res.status(500).json({success: false, message: "Server Error"})
   }
}



const rejectUtilityPayment = async (req, res) => {
    try {
        const {id} = req.params

        const payment = await utilityModel.findById(id)
        if(!payment)
            return res.status(404).json({success: false, message: "Payment not found"})

        if(payment.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Payment already processed"
            })
        }

        const user = await signupModel.findById(payment.user)
        user.balance += payment.amount
        await user.save()

        payment.status = "failed"
        await payment.save()


        await transactionModel.findOneAndUpdate(
            { reference: payment.reference },
            { status: "failed", description: `${payment.utilityProvider} Bill Payment refund` }
          );

        return res.json({
            success: true,
            message: "Payment rejected and fund refunded"
        })
    } catch (err) {
       console.log("Reject Utility Error:", err)
       return res.status(500).json({success: false, message: "Server Error"}) 
    }
}


const getUtilityHistory = async (req, res) => {
    try {
        const userId = req.user._id

        const history = await utilityModel
        .find ({user: userId})
        .sort({createdAt: -1})

        return res.json({
            success: true,
            history
        })
    } catch (err) {
        console.log("Utility History Error:", err)
        return res.status(500).json({success: false, message: "Server Error"})
    }
}





module.exports = {payUtility, getUtilityPayments, approveUtilityPayment, rejectUtilityPayment, getUtilityHistory}