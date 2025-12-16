const { applyForLoan, submitBtcProof, verifyBtcPayment, approveLoan, rejectLoan, sendAdminLoanMessage, getUserLoan, getAllLoans } = require("../controllers/loanController")
const { verifyUser, verifyAdmin } = require("../middlewares/authUser")



const loanRouter = require("express").Router()


loanRouter.get("/loan-status", verifyUser, getUserLoan)
loanRouter.get("/allLoans", verifyUser, verifyAdmin, getAllLoans)
loanRouter.post("/apply", verifyUser, applyForLoan)
loanRouter.post("/:loanId/submit-btc-proof", verifyUser, submitBtcProof)
loanRouter.patch("/:loanId/verify-btc", verifyUser, verifyAdmin, verifyBtcPayment)
loanRouter.patch("/:loanId/approve", verifyUser, verifyAdmin, approveLoan)
loanRouter.patch("/:loanId/reject", verifyUser, verifyAdmin, rejectLoan)
loanRouter.post("/:loanId/send-message", verifyUser, verifyAdmin, sendAdminLoanMessage)


module.exports = {loanRouter}