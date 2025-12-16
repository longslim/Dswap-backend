const { cardDeposit, chequeDeposit, listDeposits, approveDeposit, rejectDeposit } = require("../controllers/depositController")
const { verifyUser, verifyAdmin } = require("../middlewares/authUser")
const upload = require("../utilis/upload")

const depositRouter = require("express").Router()



depositRouter.post("/card-deposit", verifyUser, cardDeposit)
depositRouter.post("/cheque-deposit", verifyUser, upload.fields([
    {name: "frontCheque", maxCount: 1},
    {name: "backCheque", maxCount: 1}
]), chequeDeposit)
depositRouter.get("/admin-deposits", verifyUser, verifyAdmin, listDeposits)
depositRouter.patch("/admin-deposits/:id/approve", verifyUser, verifyAdmin, approveDeposit)
depositRouter.patch("/admin-deposits/:id/reject", verifyUser, verifyAdmin, rejectDeposit)



module.exports = { depositRouter }