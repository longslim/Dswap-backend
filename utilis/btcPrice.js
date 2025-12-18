const axios = require("axios");

let cachedBTCPrice = null;
let lastPriceFetch = 0;

async function getBTCPriceUSD() {
  const now = Date.now();

  if (cachedBTCPrice && now - lastPriceFetch < 30000) {
    return cachedBTCPrice;
  }

  const res = await axios.get(
    "https://api.coinbase.com/v2/prices/BTC-USD/spot",
    { timeout: 10000 }
  );

  const price = Number(res.data.data.amount);

  cachedBTCPrice = price;
  lastPriceFetch = now;

  return price;
}

function getCachedBTCPrice() {
  return cachedBTCPrice;
}

module.exports = {
  getBTCPriceUSD,
  getCachedBTCPrice,
};
