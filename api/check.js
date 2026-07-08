const { getFile, putFile } = require('./_github');

const EVENT_URL = process.env.EVENT_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Ticket Watcher';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

async function fetchSalesStatus() {
  const res = await fetch(EVENT_URL, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`Eventbrite fetch failed: ${res.status}`);
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('__NEXT_DATA__ block not found on page (Eventbrite may have changed layout)');
  const data = JSON.parse(match[1]);
  const salesStatus = data?.props?.pageProps?.context?.salesStatus;
  if (!salesStatus || !salesStatus.salesStatus) throw new Error('salesStatus field not found in page data');
  return salesStatus; // { salesStatus: 'sold_out' | 'on_sale' | ..., message: '...' }
}

async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: BREVO_SENDER_EMAIL, name: BREVO_SENDER_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) throw new Error(`Brevo send to ${to} failed: ${res.status} ${await res.text()}`);
}

module.exports = async function handler(req, res) {
  if (!CRON_SECRET || req.query.secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const sales = await fetchSalesStatus();
    const isAvailable = sales.salesStatus !== 'sold_out';

    const { content: state, sha: stateSha } = await getFile('state.json');
    const wasAvailable = state.status !== 'sold_out';

    let notified = false;
    if (isAvailable && !wasAvailable) {
      const { content: emails } = await getFile('emails.json');
      const results = await Promise.allSettled(
        emails.map((email) =>
          sendEmail(
            email,
            'Tickets available: Riftbound Regional Qualifier Barcelona',
            `<p>Tickets just became available again (status: <b>${sales.message}</b>).</p>` +
              `<p><a href="${EVENT_URL}">Buy tickets now</a></p>`
          )
        )
      );
      notified = true;
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) console.error('Some emails failed to send:', failed);
    }

    if (sales.salesStatus !== state.status) {
      await putFile(
        'state.json',
        { status: sales.salesStatus, message: sales.message, updatedAt: new Date().toISOString() },
        stateSha,
        `Update status to ${sales.salesStatus}`
      );
    }

    return res.status(200).json({ ok: true, salesStatus: sales.salesStatus, isAvailable, notified });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
