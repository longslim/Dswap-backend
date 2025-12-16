const { payUtility, getUtilityHistory, getUtilityPayments, approveUtilityPayment, rejectUtilityPayment } = require("../controllers/utilityController")
const { verifyUser, verifyAdmin } = require("../middlewares/authUser")





const utilityRouter = require("express").Router()


utilityRouter.post("/pay-utility", verifyUser, payUtility)
utilityRouter.get("/history-utility", verifyUser, getUtilityHistory)
utilityRouter.get("/allPending", verifyUser, verifyAdmin, getUtilityPayments)
utilityRouter.put("/utility-approve/:id", verifyUser, verifyAdmin, approveUtilityPayment)
utilityRouter.put("/utility-reject/:id", verifyUser, verifyAdmin, rejectUtilityPayment)



module.exports = {utilityRouter}