const EVENT_URL = process.env.EVENT_URL;

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

module.exports = { fetchSalesStatus, EVENT_URL };
