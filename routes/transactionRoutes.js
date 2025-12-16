
const { internalTransfer, getUserTransactions, plaidWebhook, getExternalTransactions, getTransactionById, getReceiverAccountName, externalTransfer, createLinkToken, exchangePublicToken, linkAccount, authorizeTransaction, getAllTransactions } = require("../controllers/transactionController");
const { verifyUser, verifyAdmin } = require("../middlewares/authUser");

const transactionRouter = require("express").Router();


transactionRouter.post("/internal-transfer", verifyUser, internalTransfer);
transactionRouter.get("/transactions", verifyUser, getUserTransactions);
transactionRouter.get("/verify-account/:accountNumber", getReceiverAccountName)
transactionRouter.get("/transactions/:id", verifyUser, getTransactionById)


transactionRouter.post("/external-transfer", verifyUser, externalTransfer)
transactionRouter.post("/create-link-token", createLinkToken)
transactionRouter.post("/exchange-public-token", verifyUser, exchangePublicToken)
transactionRouter.post("/plaid-webhook", plaidWebhook)
transactionRouter.get("/external-transaction", verifyUser, getExternalTransactions)
transactionRouter.get("/linked-accounts", verifyUser, linkAccount)
transactionRouter.get("/admin-transactions", verifyUser, verifyAdmin, getAllTransactions)
transactionRouter.put("/admin-authorize/:transactionId", verifyUser, verifyAdmin, authorizeTransaction)


module.exports = { transactionRouter };
