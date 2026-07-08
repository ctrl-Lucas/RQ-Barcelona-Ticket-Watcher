const { getFile } = require('./_github');

module.exports = async function handler(req, res) {
  try {
    const { content: state } = await getFile('state.json');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      status: state.status,
      message: state.message,
      lastCheckedAt: state.lastCheckedAt || state.updatedAt || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not load status.' });
  }
};
