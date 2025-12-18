const { createDepositAddress, signedRequest } = require('../lib/zerohashClient');
const axios = require('axios');
const mongoose = require('mongoose');
const https = require("https")



const { signupModel } = require('../models/signupModel'); 
const { ledgerModel, btcModel } = require('../models/btcModel');
const { transactionModel } = require('../models/transactionModel'); // optional if you use separate transactionModel



const SYSTEM_ACCOUNT_ID = process.env.SYSTEM_ACCOUNT_ID;


let cachedBTCPrice = null
let lastPriceFetch = 0

async function getBTCPriceUSD() {
  const now = Date.now()

  if(cachedBTCPrice && now - lastPriceFetch < 30000){
    return cachedBTCPrice
  }
  const url = "https://api.coinbase.com/v2/prices/BTC-USD/spot"
  const res = await axios.get(url, {
    timeout: 10000
  });


  const price = Number(res.data.data.amount)

  cachedBTCPrice = price
  lastPriceFetch = now
  

  return price
}

/**
 * Helper: convert mongoose Decimal128 (or number) -> JS Number
 */
function decimalToNumber(val) {
  if (val === undefined || val === null) return 0;
  // If it's a Decimal128 object
  if (typeof val === 'object' && typeof val.toString === 'function') {
    return parseFloat(val.toString());
  }
  return parseFloat(val);
}

/**
 * Helper: produce a Decimal128 from a JS Number, rounding to 8 decimals
 */
function numberToDecimal128(n) {
  // ensure numeric
  const asNum = Number(n) || 0;
  // round to 8 decimals (BTC precision)
  const rounded = asNum.toFixed(8);
  return mongoose.Types.Decimal128.fromString(rounded.toString());
}

/**
 * Create ledger entry and update user's snapshot balance using Decimal128 for BTC.
 * session optional for transaction atomicity.
 */
async function createLedgerAndUpdateUser({ userId, txId = null, asset, change, kind, metadata = {}, session = null }) {
  const user = await signupModel.findById(userId).session(session);
  if (!user) throw new Error('User not found for ledger');

  // create ledger entry (change stored as Number)
  const entry = (await ledgerModel.create([{ user: userId, tx: txId, asset, change: Number(change), kind, metadata }], { session }))[0];

  // update snapshot balance
  if (asset === 'BTC') {
    const current = decimalToNumber(user.btcBalance);
    const newBalance = parseFloat((current + Number(change)).toFixed(8));
    user.btcBalance = numberToDecimal128(newBalance);
  } else if (asset === 'USD') {
    user.balance = (user.balance || 0) + Number(change);
  }

  await user.save({ session });

  // update ledger entry balanceAfter (store as Number)
  const updatedUser = await signupModel.findById(userId).session(session);
  const balanceAfter = asset === 'BTC' ? decimalToNumber(updatedUser.btcBalance) : updatedUser.balance;
  await ledgerModel.findByIdAndUpdate(entry._id, { balanceAfter }, { session });

  return entry;
}

// Create deposit address and per-user reference via Zero Hash
const createDeposit = async (req, res) => {
  try {
    const userId = req.user && (req.user._id || req.user.id);
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const account_label = `user-${userId.toString()}`;
    const resp = await createDepositAddress({ asset: 'BTC', account_label });

    const depositAddress = resp.address || (resp.data && resp.data.address) || resp.deposit_address || null;
    const referenceId = resp.reference_id || resp.account_label || account_label || resp.reference || null;

    const tx = await btcModel.create({
      user: userId,
      type: 'btc_deposit',
      btcAmount: 0,
      currency: 'BTC',
      btcAddress: depositAddress,
      referenceId,
      status: 'pending',
      metadata: { zerohash_response: resp }
    });

    await transactionModel.create({
      sender: SYSTEM_ACCOUNT_ID,
      receiver: userId,
      type: "btc-deposit",
      amount: Number(btcAmount),
      description: "BTC deposit pending",
      status: "pending",
      reference: tx._id.toString()

    })

    return res.json({ success: true, depositAddress, referenceId, txId: tx._id, resp });
  } catch (err) {
    console.error('createDeposit error', err);
    return res.status(500).json({ message: err.message });
  }
};

// Fee rate calculation
async function calculateFeeRateUSD(usdValue) {
  if (usdValue < 100) return 0.05;
  if (usdValue < 1000) return 0.10;
  return 0.15;
}

const requestWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const userId = req.user && (req.user._id || req.user.id);
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { btcAmount, destinationAddress } = req.body;
    if (!btcAmount || Number(btcAmount) <= 0) return res.status(400).json({ message: 'btcAmount required' });
    if (!destinationAddress) return res.status(400).json({ message: 'destinationAddress required' });

    const user = await signupModel.findById(userId).session(session);
    if (!user) throw new Error('User not found');

    const userBalance = decimalToNumber(user.btcBalance);
    if (userBalance < Number(btcAmount)) throw new Error('Insufficient BTC balance');

    const btcPrice = await getBTCPriceUSD();
    const usdValue = Number(btcAmount) * btcPrice;
    const feeRate = await calculateFeeRateUSD(usdValue);
    const feeBTC = parseFloat((Number(btcAmount) * feeRate).toFixed(8));
    const netBTC = parseFloat((Number(btcAmount) - feeBTC).toFixed(8));

    // debit full amount from user (reserve) via ledger (this will update user's btcBalance using Decimal128)
    await createLedgerAndUpdateUser({
      userId,
      txId: null,
      asset: 'BTC',
      change: -Number(btcAmount),
      kind: 'withdrawal',
      metadata: { stage: 'requested', destinationAddress, feeBTC, feeRate, usdValue },
      session
    });

    // credit admin user with fee
    const adminEmail = process.env.ADMIN_ACCOUNT_EMAIL;
    if (adminEmail) {
      const admin = await signupModel.findOne({ email: adminEmail }).session(session);
      if (admin) {
        await createLedgerAndUpdateUser({
          userId: admin._id,
          txId: null,
          asset: 'BTC',
          change: feeBTC,
          kind: 'fee_income',
          metadata: { fromUser: userId, usdValue, feeRate },
          session
        });
      } else {
        console.warn('Admin user not found for fee credit:', adminEmail);
      }
    }

    // create transaction record
    const tx = (await btcModel.create([{
      user: userId,
      type: 'btc_withdrawal',
      btcAmount: Number(btcAmount),
      currency: 'BTC',
      btcAddress: destinationAddress,
      status: process.env.WITHDRAWAL_APPROVAL_REQUIRED === 'true' ? 'pending' : 'approved',
      metadata: { feeBTC, feeRate, netBTC, usdValue }
    }], { session }))[0];

    await session.commitTransaction();

    await transactionModel.create({
      sender: userId,
      receiver: destinationAddress,
      type: "btc-withdrawal",
      amount: Number(btcAmount),
      description: "BTC Withdrawal request",
      status: "pending",
      reference: tx._id.toString()

    })
    return res.status(201).json({ success: true, tx });
  } catch (err) {
    await session.abortTransaction();
    console.error('requestWithdrawal error', err);
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

const processWithdrawal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { transactionId } = req.params;
    const tx = await btcModel.findById(transactionId).session(session);
    if (!tx) throw new Error('Transaction not found');
    if (tx.type !== 'btc_withdrawal') throw new Error('Invalid transaction type');
    if (tx.status === 'completed') throw new Error('Already processed');

    const path = '/withdrawals';
    const body = {
      asset: 'BTC',
      amount: Number(tx.btcAmount) - (tx.metadata?.feeBTC || 0),
      destination: { address: tx.btcAddress },
      reference_id: tx._id.toString()
    };
    const sendResp = await signedRequest({ method: 'POST', path, data: body });

    const externalTxId = sendResp.id || sendResp.transaction_id || (sendResp.data && sendResp.data.id);
    tx.status = 'completed';
    tx.txHash = externalTxId;
    tx.metadata = { ...tx.metadata, zeroHashResponse: sendResp };
    await tx.save({ session });

    // write an internal ledger event (no balance change — user already debited)
    const userAfter = await signupModel.findById(tx.user).session(session);
    const balanceAfterNum = decimalToNumber(userAfter.btcBalance);

    await ledgerModel.create([{
      user: tx.user,
      tx: tx._id,
      asset: 'BTC',
      change: 0,
      balanceAfter: balanceAfterNum,
      kind: 'internal',
      metadata: { zeroHash: sendResp }
    }], { session });

    await session.commitTransaction();

    await transactionModel.findOneAndUpdate(
      { reference: tx._id.toString() },
      { status: "completed", description: "BTC Withdraw successful" }
    )
    return res.json({ success: true, tx });
  } catch (err) {
    await session.abortTransaction();
    console.error('processWithdrawal error', err);
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

const getPrice = async (req, res) => {
  try {
    const price = await getBTCPriceUSD();
    return res.json({ bitcoin: { usd: price } });
  } catch (err) {
    console.error("BTC price error:", err.message);

    if(cachedBTCPrice) {
      return res.json({
        bitcoin: {usd: cachedBTCPrice},
        cached: true
      })
    }
    res.status(503).json({
      message: "Btc prie temporary unavailable"
    })
  }
};

async function zeroHashWebhookHandler(req, res) {
  try {
    const event = req.body;
    const type = event.event_type || event.type || event.action;
    if (!type) return res.status(400).send('No event_type');

    if (type === 'wallet_deposit' || type === 'deposit_confirmed') {
      const reference = event.reference_id || event.account_label || event.reference;
      const amount = parseFloat(event.amount || '0');
      const txHash = event.tx_hash || event.transaction_id || event.txid;

      const tx = await btcModel.findOne({ referenceId: reference });
      if (!tx) {
        console.warn('Deposit webhook: no tx for reference', reference);
        return res.status(200).send('No matching tx');
      }

      tx.status = 'confirmed';
      tx.btcAmount = Number(amount);
      tx.txHash = txHash;
      tx.metadata = { ...tx.metadata, zeroHashEvent: event };
      await tx.save();

      // create ledger and update user using Decimal128-safe helper
      await createLedgerAndUpdateUser({
        userId: tx.user,
        txId: tx._id,
        asset: 'BTC',
        change: Number(amount),
        kind: 'deposit',
        metadata: { source: 'zerohash', reference, txHash }
      });

      return res.status(200).send('deposit processed');
    }

    if (type === 'withdrawal_completed' || type === 'withdrawal_finalized') {
      const externalId = event.reference_id || event.transaction_id;
      const tx = await btcModel.findOne({ txHash: externalId }) || await btcModel.findById(externalId);
      if (!tx) return res.status(200).send('tx not found');

      tx.status = 'completed';
      tx.metadata = { ...tx.metadata, zeroHashEvent: event };
      await tx.save();

      return res.status(200).send('withdrawal processed');
    }

    console.log('Unhandled ZeroHash event', type);
    return res.status(200).send('ignored');
  } catch (err) {
    console.error('zeroHashWebhookHandler error', err);
    return res.status(500).send('server error');
  }
}

const getUserBalance = async (req, res) => {
  try {
    const userId = req.user && (req.user._id || req.user.id);
    if (!userId) return res.status(401).json({ message: "Unauthenticated" });

    const user = await signupModel.findById(userId).select("btcBalance balance");
    if (!user) return res.status(404).json({ message: "User not found" });

    const btc = decimalToNumber(user.btcBalance);
    const fiat = user.balance || 0;

    return res.json({
      success: true,
      balances: {
        btc,
        fiat
      },
      user: {
        id: user._id,
      }
    });
  } catch (err) {
    console.error("getUserBalance error:", err);
    return res.status(500).json({ message: err.message });
  }
};


const formatOHLC = (raw) => {
    return raw.map((c)=> ({
        time: c[0],
        open: parseFloat(c[1]),
        high: parseFloat(c[2]),
        low:  parseFloat(c[3]),
        close: parseFloat(c[4])
    }))
}

const agent = new https.Agent({
    keepAlive: false,
    secureProtocol: "TLS_method"
});

let cachedOHLC = null
let lastfetch = 0

const getBTC_OHLC = async (req, res) => {
    try {

        const now = Date.now()

        if(cachedOHLC && (now-lastfetch < 60000)){
            return res.json(cachedOHLC)
        }
        const url = "https://api.exchange.coinbase.com/products/BTC-USD/candles"
        const response = await axios.get(url)

        if (!response.data || !Array.isArray(response.data)){
            return res.status(500).json({error: "No OHLC data received"})
        }


        const formatted = formatOHLC(response.data)

        cachedOHLC = formatted
        lastfetch = now
        

        const cleanCandles = formatted
        .filter(c => c && c.time && !isNaN(c.time))
        .sort((a, b) => a.time - b.time)
        .slice(-200)

        res.json(cleanCandles)
        
    } catch (err) {
       console.error("OHLC ERROR:", err.message)
       return res.status(500).json({error: "Failed to fetch OHLC data"}) 
    }
}

// const ohlc = async(req, res) => {
//     try {
//         const {symbol = "BTCUSDT", interval = "1m", limit = 200} = req.query
//         const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
//         const response = await axios.get(url)

//         const formatted = response.data.map((c) => ({
//           time: [0],
//           open: parseFloat(c[1]),
//           high: parseFloat(c[2]),
//           low: parseFloat(c[3]),
//           close: parseFloat(c[4])
//         }))

//         res.json({symbol, interval, candles: formatted})
//     } catch (err) {
//       console.error("OHLC ERROR:", err.message);
//       res.status(500).json({ error: "Failed to fetch OHLC data" })
//     }
// }


const buyBtc = async(req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const userId = req.user && (req.user._id || req.user.id)
    if(!userId)return res.status(401).json({message: "Unauthenticated"})

      const usdAmount = Number(req.body.usdAmount)
      if(!usdAmount || usdAmount <= 0) return res.status(400).json({message: "usdAmount required"})

        const user = await signupModel.findById(userId).session(session)
        if(!user) throw new Error ("User not found")

          const balance = (user.balance || 0)
          if(balance < usdAmount) throw new Error("Insufficient balance")

            await createLedgerAndUpdateUser({
              userId,
              txId: null,
              asset: "USD",
              change: -usdAmount,
              kind: "buy_btc",
              metadata: {stage: "requested", usdAmount},
              session
            })

            const path = "/trades";
            const body = {
              side: "buy",
              source_currency: "USD",
              target_currency: "BTC",
              amount: usdAmount,
              account_label: `user-${userId.toString()}`,
              reference_id: `buy-${Date.now()}-${userId.toString()}`
            }

            const zresp = await signedRequest({method: "POST", path, data: body})

            const btcReceived = parseFloat(zresp.executed_amount || zresp.filled_amount || zresp.filled_target_amount || 0)
            const referenceId = zresp.reference_id || body.reference_id || zresp.id || null


            const tx = await btcModel.create([{
              user: userId,
              type: "btc_deposit",
              btcAmount: btcReceived || 0,
              currency: "BTC",
              btcAddress: null,
              referenceId,
              status: btcReceived > 0 ? "confirmed" : "pending",
              metadata: {zerohash_response: zresp, usdAmount}
            }], {session})

            if(btcReceived > 0){
              await createLedgerAndUpdateUser({
                userId,
                txId: tx[0]._id,
                asset: "BTC",
                change: btcReceived,
                kind: "buy",
                metadata: {source: "zerohash", referenceId, zresp},
                session
              })
            }

            await session.commitTransaction()

            await transactionModel.create({
              sender: SYSTEM_ACCOUNT_ID,
              receiver: userId,
              type: "btc-purchase",
              amount: btcReceived,
              description: "btc credited to balance",
              status: "completed",
              reference: tx[0]._id.toString()

          })
            return res.json({success: true, tx: tx[0], zresp})
  } catch (err) {
    await session.abortTransaction()
    console.error("buyBtcZeroHash error", err)
    return res.status(500).json({message: err.message || "Failed"})
  } finally {
    session.endSession()
  }
}


const adminApprovedWithdrawal = async(req, res) => {
  try {
    const {id} = req.params
    req.params.transactionId = id
    return await processWithdrawal(req, res)
  } catch (err) {
    console.error("adminApproveWithdrawal error", err)
    return res.status(500).json({message: err.message})
  }
}


const adminRejectWithdrawal = async(req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const {id} = req.params
    const reason = req.body.reason || "Rejected by Admin"

    const tx = await btcModel.findById(id).session(session)
    if(!tx) throw new Error ("Transaction not found")
    if(tx.type !== "btc_withdrawal") throw new Error ("Invalid transaction type")
    if(tx.status === "completed" || tx.status === "rejected") throw new Error("Already processed")
      
      tx.status = "rejected";
      tx.metadata = {...tx.metadata, adminRejectReason: reason, rejectedAt: new Date()}
      await tx.save({session})

      await createLedgerAndUpdateUser({
        userId: tx.user,
        txId: tx._id,
        asset: "BTC",
        change: Number(tx.btcAmount),
        kind: "withdrawal_refund",
        metadata: {originalTx: tx._id, reason},
        session
      })

      await session.commitTransaction()

      await transactionModel.findOneAndUpdate(
        { reference: tx._id.toString() },
        { status: "failed", reason: reason, description: "Btc Withdraw failed" }
      )
      return res.json({success: true, tx})
  } catch (err) {
    await session.abortTransaction()
    console.error("adminRejectWithdrawal error", err)
    return res.status(500).json({message: err.message})
  } finally{
    session.endSession()
  }
}


const getAdminStats = async(req, res) => {
  try {
    const totals = await btcModel.aggregate([
      {$match: {}},
      {$group: {
        _id: "$type",
        totalBTC: {$sum: {$toDouble: "$btcAmount"}},
        count: {$sum: 1}
      }}
    ])

    const pendingWithdrawals = await btcModel.find({type: "btc_withdrawal", status: "pending"})
    .populate("user", "firstname lastname email")
    .lean()


    const totalUserHoldingsAgg = await signupModel.aggregate([
      {$group: {_id: null, totalBTC: {$sum: {$toDouble: "$btcBalance"}}}}
    ])
    const totalUserHoldings = (totalUserHoldingsAgg[0] && totalUserHoldingsAgg[0].totalBTC || 0)

    return res.json({
      success: true,
      totals,
      pendingWithdrawals,
      totalUserHoldings
    })
  } catch (err) {
    console.error("getAdminStats error", err)
    return res.status(500).json({message: err.message})
  }
}





module.exports = { createDeposit, requestWithdrawal, processWithdrawal, getPrice, createLedgerAndUpdateUser, zeroHashWebhookHandler, getUserBalance, getBTC_OHLC, buyBtc, adminApprovedWithdrawal, adminRejectWithdrawal, getAdminStats };
