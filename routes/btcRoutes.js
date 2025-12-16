const verifyZeroHashSignature = require("../middlewares/verifyZeroHashSignature")
const { zeroHashWebhookHandler, createDeposit, requestWithdrawal, processWithdrawal, getPrice, getUserBalance, getBTC_OHLC, buyBtc, adminApprovedWithdrawal, adminRejectWithdrawal, getAdminStats } = require("../controllers/btcController")
const { verifyUser, verifyAdmin } = require("../middlewares/authUser")


const express = require("express")
const bodyParser = require("body-parser")
const btcRouter = require("express").Router()


btcRouter.post("/zerohash-webhook", express.raw({type: "application/json"}), verifyZeroHashSignature, zeroHashWebhookHandler)

btcRouter.post("/create-deposit", verifyUser, createDeposit)
btcRouter.post("/request-withdraw", verifyUser, requestWithdrawal)
btcRouter.post("/withdraw/:transactionId/process", verifyUser, verifyAdmin, processWithdrawal)
btcRouter.get("/price", getPrice)
btcRouter.get("/balances", verifyUser, getUserBalance)
btcRouter.get("/ohlc", getBTC_OHLC)
btcRouter.post("/buy-btc", verifyUser, buyBtc)
btcRouter.post("/admin/withdrawals/:id/approve", verifyUser, verifyAdmin, adminApprovedWithdrawal)
btcRouter.post("/admin/withdrawals/:id/reject", verifyUser, verifyAdmin, adminRejectWithdrawal)
btcRouter.get("/admin-stats", verifyUser, verifyAdmin, getAdminStats)






module.exports = {btcRouter}