const { getFile, putFile } = require('./_github');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || 'unknown';
}

// Basic fixed-window rate limit, backed by the same private data repo used
// for emails/state. Only writes back when a request is actually allowed
// (reset or increment), so requests made while already over the limit don't
// generate extra commits.
async function checkRateLimit(bucket, req, { maxRequests, windowMs }) {
  const ip = getClientIp(req);
  const key = `${bucket}:${ip}`;
  const now = Date.now();

  const { content: limits, sha } = await getFile('rate_limits.json');
  const entry = limits[key];

  if (!entry || now - entry.windowStart > windowMs) {
    limits[key] = { count: 1, windowStart: now };
    await putFile('rate_limits.json', limits, sha, `Rate limit: reset ${key}`);
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  limits[key] = { count: entry.count + 1, windowStart: entry.windowStart };
  await putFile('rate_limits.json', limits, sha, `Rate limit: increment ${key}`);
  return { allowed: true };
}

module.exports = { checkRateLimit };
