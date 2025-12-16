// lib/fireblocksClient.js
const fs = require('fs');
const { FireblocksSDK } = require('fireblocks-sdk');

const secretKeyPath = process.env.FIREBLOCKS_SECRET_KEY_PATH || './fireblocks_secret.key';
if (!fs.existsSync(secretKeyPath)) {
  console.warn('[fireblocksClient] secret key file not found at', secretKeyPath);
}
const privateKey = fs.existsSync(secretKeyPath) ? fs.readFileSync(secretKeyPath, 'utf8') : null;

const fireblocksOptions = { basePath: process.env.FIREBLOCKS_BASE_PATH || 'https://api.fireblocks.io' };

const fireblocks = new FireblocksSDK(privateKey, process.env.FIREBLOCKS_API_KEY, fireblocksOptions);

async function createFireblocksTransfer({ sourceVaultAccountId, destination, assetId = 'BTC', amount, fee = null, note = '', externalTxId = null }) {
  if (!sourceVaultAccountId) throw new Error('sourceVaultAccountId required');
  const body = {
    assetId,
    source: { type: 'VAULT_ACCOUNT', id: sourceVaultAccountId },
    destination,
    amount: amount.toString(),
    note,
    metadata: externalTxId ? { externalId: externalTxId } : undefined
  };
  const resp = await fireblocks.createTransaction(body);
  return resp;
}

function makeOneTimeAddressDestination(address) {
  return { type: 'ONE_TIME_ADDRESS', one_time_address: { address } };
}

module.exports = { fireblocks, createFireblocksTransfer, makeOneTimeAddressDestination };
