const API = 'https://api.github.com';

function env() {
  const owner = process.env.DATA_GITHUB_OWNER;
  const repo = process.env.DATA_GITHUB_REPO;
  const token = process.env.DATA_GITHUB_TOKEN;
  if (!owner || !repo || !token) {
    throw new Error('Missing DATA_GITHUB_OWNER / DATA_GITHUB_REPO / DATA_GITHUB_TOKEN env vars');
  }
  return { owner, repo, token };
}

async function getFile(path) {
  const { owner, repo, token } = env();
  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'ticket-watcher',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const content = JSON.parse(Buffer.from(json.content, 'base64').toString('utf-8'));
  return { content, sha: json.sha };
}

async function putFile(path, content, sha, message) {
  const { owner, repo, token } = env();
  const res = await fetch(`${API}/repos/${owner}/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'ticket-watcher',
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(content, null, 2) + '\n').toString('base64'),
      sha,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
  }
}

module.exports = { getFile, putFile };
