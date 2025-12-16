require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const { signupModel } = require("../models/signupModel");
const { ledgerModel } = require("../models/btcModel");
const { fireblocks } = require("../lib/fireblocksClient");
const { Parser } = require("json2csv");

async function reconnect() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

async function fetchFireblocksVaultBalance() {
  const accounts = await fireblocks.getVaultAccounts();
  const btcAcc = accounts.find((a) => a.assets.some((as) => as.id === "BTC"));
  const btcAsset = btcAcc?.assets.find((a) => a.id === "BTC");
  return parseFloat(btcAsset?.total || 0);
}

async function reconcile() {
  await reconnect();
  const users = await signupModel.find({});
  const report = [];

  for (const u of users) {
    const ledgerSumAgg = await ledgerModel.aggregate([
      { $match: { user: u._id, asset: "BTC" } },
      { $group: { _id: "$user", total: { $sum: "$change" } } },
    ]);

    const ledgerSum = (ledgerSumAgg[0] && ledgerSumAgg[0].total) || 0;
    const snapshot = u.btcBalance || 0;
    const delta = Number((snapshot - ledgerSum).toFixed(8));
    if (Math.abs(delta) > 0.00000001) {
      report.push({ userId: u._id.toString(), snapshot, ledgerSum, delta });
    }
  }

  const vaultTotal = await fetchFireblocksVaultBalance();
  console.log("Fireblocks Vault BTC Balance:", vaultTotal);

  const csv = new Parser().parse(report);
  fs.writeFileSync("reconciliation_report.csv", csv);
  console.log("CSV exported: reconciliation_report.csv");

  await mongoose.disconnect();
}

reconcile().catch((err) => {
  console.error(err);
  process.exit(1);
});
