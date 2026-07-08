const { sendEmail } = require('./_brevo');
const { isValidPassword } = require('./_auth');
const { checkRateLimit } = require('./_ratelimit');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  if (!isValidPassword(password)) {
    return res.status(403).json({ error: 'Incorrect password.' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const rateLimit = await checkRateLimit('test-email', req, { maxRequests: 3, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return res
      .status(429)
      .json({ error: `Too many test emails sent. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).` });
  }

  try {
    await sendEmail(
      email.trim().toLowerCase(),
      'Test email — Ticket Watcher',
      '<p>This is a test email from the Riftbound Barcelona ticket watcher.</p>' +
        "<p>If this landed in spam, mark it as \"not spam\" so real alerts reach your inbox.</p>"
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to send test email.' });
  }
};
