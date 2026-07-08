const { getFile, putFile } = require('./_github');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, website } = req.body || {};

  // Honeypot field: bots fill hidden fields, humans never see it.
  if (website) {
    return res.status(200).json({ ok: true });
  }

  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  const normalized = email.trim().toLowerCase();

  try {
    const { content: emails, sha } = await getFile('emails.json');
    if (emails.some((e) => e.toLowerCase() === normalized)) {
      return res.status(200).json({ ok: true, message: 'You are already subscribed.' });
    }
    emails.push(normalized);
    await putFile('emails.json', emails, sha, `Add subscriber ${normalized}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
};
