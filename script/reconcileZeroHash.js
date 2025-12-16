require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');
const { signupModel } = require('../models/signupModel');
const { LedgerEntry } = require('../models/btcModel');
const { getPlatformBalances } = require('../lib/zerohashClient'); // returns platform vault balances
const { Parser } = require('json2csv');

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const users = await signupModel.find({});
  const rows = [];

  for (const u of users) {
    const agg = await LedgerEntry.aggregate([
      { $match: { user: u._id, asset: 'BTC' } },
      { $group: { _id: '$user', total: { $sum: '$change' } } }
    ]);
    const ledgerSum = (agg[0] && agg[0].total) || 0;
    const snapshot = u.btcBalance || 0;
    const delta = Number((snapshot - ledgerSum).toFixed(8));
    if (Math.abs(delta) > (parseFloat(process.env.RECONCILE_TOLERANCE || '0.00000001'))) {
      rows.push({ userId: u._id.toString(), snapshot, ledgerSum, delta });
    }
  }

  // fetch ZeroHash platform balances (adapt parsing to your response)
  let vaultTotal = null;
  try {
    const resp = await getPlatformBalances();
    // resp parsing may vary; try to extract BTC total
    vaultTotal = resp && (resp.total_btc || resp.balances && resp.balances.BTC || JSON.stringify(resp));
  } catch (err) {
    console.error('Error fetching ZeroHash platform balances', err.message || err);
  }

  const csv = new Parser().parse({ data: rows, fields: ['userId', 'snapshot', 'ledgerSum', 'delta'] });
  fs.writeFileSync('reconciliation_report.csv', csv);
  console.log('Wrote reconciliation_report.csv; vault total:', vaultTotal);
  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });