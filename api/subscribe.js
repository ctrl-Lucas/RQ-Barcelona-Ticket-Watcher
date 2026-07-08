const { getFile, putFile } = require('./_github');
const { isValidPassword } = require('./_auth');
const { sendEmail } = require('./_brevo');
const { EVENT_URL } = require('./_eventbrite');
const { checkRateLimit } = require('./_ratelimit');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISCLAIMER =
  'There is no guarantee that an email will be sent when tickets become available — this tool checks ' +
  'every 5 minutes on a best-effort basis and could fail silently. Providing your email address is at ' +
  'your own risk; it is handled with care, but delivery and security are not guaranteed.';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, website, password } = req.body || {};

  // Honeypot field: bots fill hidden fields, humans never see it.
  if (website) {
    return res.status(200).json({ ok: true });
  }

  if (!isValidPassword(password)) {
    return res.status(403).json({ error: 'Incorrect password.' });
  }
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  const normalized = email.trim().toLowerCase();

  const rateLimit = await checkRateLimit('subscribe', req, { maxRequests: 5, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return res
      .status(429)
      .json({ error: `Too many attempts. Try again in ${Math.ceil(rateLimit.retryAfterSeconds / 60)} minute(s).` });
  }

  try {
    const { content: emails, sha } = await getFile('emails.json');
    if (emails.some((e) => e.toLowerCase() === normalized)) {
      return res.status(200).json({ ok: true, message: 'You are already subscribed.' });
    }
    emails.push(normalized);
    await putFile('emails.json', emails, sha, `Add subscriber ${normalized}`);

    try {
      await sendEmail(
        normalized,
        "You're on the list — Riftbound Barcelona Ticket Watcher",
        `<p>You've been added to the recipient list for the Riftbound Regional Qualifier Barcelona ticket watcher.</p>` +
          `<p>We check <a href="${EVENT_URL}">the event page</a> every 5 minutes and will email this list the moment tickets become available.</p>` +
          `<p style="color:#888;font-size:0.85em">${DISCLAIMER}</p>`
      );
    } catch (err) {
      console.error('Failed to send confirmation email:', err);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};
