const { loanModel } = require("../models/loanModel")
const { transactionModel } = require("../models/transactionModel")
const { sendEmail } = require("../utilis/mail")







const applyForLoan =  async (req, res) => {
    try {
        const userId = req.user._id
        let {amount, durationMonths} = req.body

        amount = Number(amount)
        durationMonths = Number(durationMonths)

        if (!amount || !durationMonths || isNaN(amount) || isNaN(durationMonths)) {
            return res.status(400).json({success: false, message: "All fields are required"})
        }

        const activeLoan = await loanModel.findOne({
           user: userId,
           status: {$in: ["awaiting-btc", "processing", "approved"]} 
        })

        if (activeLoan) {
            return res.status(400).json({
                success: false,
                message: "You already have a pending or active loan"
            })
        }

        const interestRate = 10
        const totalRepayable = Number((amount + (amount * interestRate)/ 100).toFixed(2))
        const monthlyPayment = Number((totalRepayable/durationMonths).toFixed(2))
        const btcAddress = "your-bitcoin-wallet-address-here"
        const btcPaymentPercent = 10
        const btcAmountRequired = (amount * btcPaymentPercent) / 100

        const loan = await loanModel.create({
            user: userId,
            amount,
            durationMonths,
            interestRate,
            totalRepayable,
            monthlyPayment,
            btcAddress,
            btcAmountRequired,
            btcPaymentPercent,
            status: "awaiting-btc",
            remainingBalance: totalRepayable,
            paymentsMade: 0,
            totalPayments: durationMonths,
            nextPaymentDate: new Date(new Date().setMonth(new Date().getMonth() + 1))
        })

        return res.json({
            success: true,
            message: "Loan application received. complete BTC payment to continue",
            loan
        })

    } catch (err) {
       console.log("appForLoan error:", err)
       res.status(500).json({success: false, message: "Server error"}) 
    }
}


const approveLoan = async (req, res) => {
    try {
        const adminId = req.user._id
        const {loanId} = req.params

        const loan = await loanModel.findById(loanId).populate("user")

        if(!loan) {
            return res.status(404).json({success: false, message: "Loan not found"})
        }

        if (!["processing"].includes(loan.status)){
            return res.status(400).json({success: false, message: "Loan not ready for approval"})
        }


        if (!loan.btcTxHash) {
            return res.status(400).json({
              success: false,
              message: "User has not submitted BTC payment proof",
            });
          }
          
          if (!loan.btcVerified) {
            return res.status(400).json({
              success: false,
              message: "BTC payment not verified yet",
            });
          }

        loan.status = "approved"
        loan.approvedBy = adminId

        loan.user.balance += loan.amount
        await loan.user.save()
        await loan.save()


        await transactionModel.create({
            sender: adminId,
            receiver: loan.user._id,
            user: loan.user._id,
            type: "loan-credit",
            amount: loan.amount,
            description: "Loan credited to balance",
            status: "completed"
        })

        return res.json({
            success: true,
            message: "Loan approved and funds credited",
            loan
        })

        
    } catch (err) {
        console.log("approveLoan:", err)
        res.status(500).json({success: false, message: "Server error"})
    }
}



const rejectLoan = async (req, res) => {
    try {
      const adminId = req.user._id;
      const { loanId } = req.params;
  
      const loan = await loanModel.findById(loanId);
  
      if (!loan) {
        return res.status(404).json({ success: false, message: "Loan not found" });
      }
  
      
  
      loan.status = "rejected";
      loan.approvedBy = adminId;
      await loan.save();
  
      res.json({ success: true, message: "Loan rejected" });
    } catch (err) {
      console.log("rejectLoan:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
};



const submitBtcProof = async (req, res) => {
    try {
      const { loanId } = req.params;
      const { txHash } = req.body;
  
      const loan = await loanModel.findById(loanId);
  
      if (!loan) return res.status(404).json({ message: "Loan not found" });
  
      
      loan.btcTxHash = txHash;
      loan.status = "processing";
      await loan.save();
  
      res.json({ success: true, message: "BTC proof submitted. Awaiting admin verification." });
    } catch (error) {
        console.log(err)
        res.status(500).json({ message: "Server error" });
    }
};



const verifyBtcPayment = async (req, res) => {
    try {
      const { loanId } = req.params;
  
      const loan = await loanModel.findById(loanId);
      if (!loan) return res.status(404).json({ message: "Loan not found" });
  
      loan.btcVerified = true;
      await loan.save();
  
      res.json({ success: true, message: "BTC payment verified" });
    } catch (error) {
        console.log(err)
        res.status(500).json({ message: "Server error" });
    }
};



const sendAdminLoanMessage = async (req, res) => {
    try {
      const { loanId } = req.params;
      const { message } = req.body;
  
      const loan = await loanModel.findById(loanId).populate("user");
      if (!loan) return res.status(404).json({ message: "Loan not found" });
  
      loan.adminMessage = message;
      await loan.save();
  
      
      await sendEmail(
        loan.user.email,
        "Update on Your Loan Request",
        `<p>${message}</p>`
      );
  
      loan.emailSent = true;
      await loan.save();
  
      res.json({ success: true, message: "Email sent to user" });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
};



const getUserLoan = async (req, res) => {
    try {
      const userId = req.user._id;
  
      const loan = await loanModel.findOne({ user: userId });
  
      if (!loan) {
        return res.json({ success: true, loan: null });
      }
  
      return res.json({ success: true, loan });
    } catch (err) {
      console.log("getUserLoan:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
};


const getAllLoans = async (req, res) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({
                success: false,
                message: "Unauthorized. Admin access only"
            })
        }

        const loans = await loanModel.find().populate("user", "firstname lastname email accountNumber")

        res.json({
            success: true,
            loans
        })
    } catch (err) {
        console.log("getAllLoans error:", err)
        res.status(500).json({
            success: false,
            message: "Server error"
        })
    }
}

  

module.exports = {applyForLoan, approveLoan, rejectLoan, submitBtcProof, verifyBtcPayment, sendAdminLoanMessage, getUserLoan, getAllLoans}