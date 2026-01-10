const crypto = require('crypto');
const NodeCache = require('node-cache');

const replayCache = new NodeCache({ stdTTL: 300 }); 

module.exports = function verifyZeroHashSignature(req, res, next) {
  try {
    const secret = process.env.ZEROHASH_WEBHOOK_SECRET;
    if (!secret) {
      //console.warn('[verifyZeroHashSignature] ZEROHASH_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook verification not configured' });
    }

    
    const raw = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : req.rawBody || (
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body || {})
      );
  
    const signature = req.headers['x-signature'] || req.headers['x-zh-signature'] || req.headers['signature'];
    const timestamp = req.headers['x-timestamp'] || req.headers['x-zh-timestamp'] || req.headers['timestamp'];

    if (!signature || !timestamp) return res.status(401).json({ error: 'Missing signature/timestamp' });

    
    const now = Date.now();
    const eventTs = parseInt(timestamp, 10);
    if (Number.isNaN(eventTs) || Math.abs(now - eventTs) > 5 * 60 * 1000) {
      return res.status(403).json({ error: 'Stale webhook timestamp' });
    }

    
    if (replayCache.has(signature)) return res.status(409).json({ error: 'Duplicate webhook' });

    
    const computed = crypto.createHmac('sha256', secret).update(`${timestamp}${raw}`).digest('hex');

    if (computed !== signature && computed !== Buffer.from(signature, 'base64').toString('hex')) {
      //console.error('Invalid webhook signature', { computed, signature });
      return res.status(403).json({ error: 'Invalid signature' });
    }

    
    replayCache.set(signature, true);

    next();
  } catch (err) {
    //console.error('verifyZeroHashSignature error', err);
    return res.status(500).json({ error: 'Verification failed' });
  }
};