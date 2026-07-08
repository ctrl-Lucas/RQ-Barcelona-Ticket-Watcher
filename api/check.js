const { getFile, putFile } = require('./_github');
const { sendEmail } = require('./_brevo');
const { fetchSalesStatus, EVENT_URL } = require('./_eventbrite');

const CRON_SECRET = process.env.CRON_SECRET;

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
            'Riftbound Barcelona: event page status changed',
            `<p>The status on the Riftbound Regional Qualifier Barcelona event page just changed.</p>` +
              `<p>You can check it here: <a href="${EVENT_URL}">${EVENT_URL}</a></p>`
          )
        )
      );
      notified = true;
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) console.error('Some emails failed to send:', failed);
    }

    // Always record the check time, even if the status itself hasn't changed.
    await putFile(
      'state.json',
      {
        status: sales.salesStatus,
        message: sales.message,
        updatedAt: sales.salesStatus !== state.status ? new Date().toISOString() : state.updatedAt,
        lastCheckedAt: new Date().toISOString(),
      },
      stateSha,
      `Check: ${sales.salesStatus}`
    );

    return res.status(200).json({ ok: true, salesStatus: sales.salesStatus, isAvailable, notified });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
