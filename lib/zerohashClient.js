const axios = require('axios');
const crypto = require('crypto');

const BASE = process.env.ZEROHASH_API_BASE || 'https://api.cert.zerohash.com';
const API_KEY = process.env.ZEROHASH_API_KEY;
const API_SECRET = process.env.ZEROHASH_API_SECRET || '';
const PASSPHRASE = process.env.ZEROHASH_PASSPHRASE || '';

if (!API_KEY || !API_SECRET) {
  //console.warn('[zerohashClient] ZEROHASH_API_KEY or ZEROHASH_API_SECRET missing in env');
}


const zh = axios.create({
  baseURL: BASE,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' }
});


function signRequest({ method, path, body = '', timestamp = null }) {
  const ts = timestamp || Date.now().toString();
  const payload = `${ts}${method.toUpperCase()}${path}${body || ''}`;
  const hmac = crypto.createHmac('sha256', API_SECRET).update(payload).digest('hex');
  return { signature: hmac, timestamp: ts };
}


async function signedRequest({ method = 'GET', path = '/', data = null, params = null }) {
  const body = data ? JSON.stringify(data) : '';
  const { signature, timestamp } = signRequest({ method, path, body });
  const headers = {
    'X-API-KEY': API_KEY,
    'X-SIGNATURE': signature,
    'X-TIMESTAMP': timestamp
  };
  if (PASSPHRASE) headers['X-PASSPHRASE'] = PASSPHRASE;

  try {
    const resp = await zh.request({
      url: path,
      method,
      data,
      params,
      headers
    });
    return resp.data;
  } catch (err) {
    
    const msg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
    const e = new Error(`ZeroHash request error: ${msg}`);
    e.original = err;
    throw e;
  }
}


async function createDepositAddress({ asset = 'BTC', account_label = null }) {
  const path = '/deposits/digital_asset_addresses';
  return await signedRequest({
    method: 'POST',
    path,
    data: { asset, account_label }
  });
}


async function getPlatformBalances() {
  const path = '/fund/accounts'; 
  return await signedRequest({ method: 'GET', path });
}

module.exports = { signedRequest, createDepositAddress, getPlatformBalances };