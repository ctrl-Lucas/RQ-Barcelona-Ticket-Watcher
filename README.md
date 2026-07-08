# Ticket Watcher — Riftbound Regional Qualifier Barcelona

Watches the Eventbrite event page every 5 minutes for the `salesStatus` field
embedded in the page's `__NEXT_DATA__` JSON (more reliable than scraping div
text, since Eventbrite's CSS class names are hashed and change on every
deploy). When it flips away from `sold_out`, it emails everyone on the list
via Brevo.

## Architecture

- **This repo (public)** — static signup form + two Vercel serverless
  functions (`/api/subscribe`, `/api/check`) + a GitHub Actions workflow that
  pings `/api/check` every 5 minutes. Public so GitHub Actions minutes are
  unlimited/free. Contains no secrets or personal data.
- **A second, private repo** — just two files, `emails.json` and
  `state.json`. Used purely as a tiny free data store, read/written via the
  GitHub API. Never runs a workflow, so its cost is $0 regardless of
  visibility.
- **Brevo** — sends the actual notification emails (free tier, 300/day).

Total cost: **$0/month**.

## One-time setup

### 1. Create the two GitHub repos

- `ticket-watcher` — **public** — push this folder's contents to it.
- `ticket-watcher-data` — **private** — upload the two seed files from
  `../ticket-watcher-data-seed/` (`emails.json`, `state.json`) to its root.

### 2. Create a GitHub token for the data repo

GitHub → Settings → Developer settings → Fine-grained tokens → Generate new
token. Scope it to **only** the `ticket-watcher-data` repository, with
repository permission **Contents: Read and write**. Copy the token — you'll
paste it into Vercel, not here.

### 3. Brevo (email sending)

1. Sign up at brevo.com (free).
2. Senders, Domains & Dedicated IPs → Senders → add and verify the email
   address you want notifications to come from (click the confirmation
   link Brevo emails you).
3. Settings → SMTP & API → API Keys → generate a new API key.

### 4. Deploy to Vercel

From this folder:

```
vercel login
vercel link
```

Then set environment variables (you'll be prompted for the value each time —
paste secrets there, not in chat/files):

```
vercel env add DATA_GITHUB_OWNER production
vercel env add DATA_GITHUB_REPO production      # ticket-watcher-data
vercel env add DATA_GITHUB_TOKEN production     # the fine-grained PAT from step 2
vercel env add BREVO_API_KEY production
vercel env add BREVO_SENDER_EMAIL production
vercel env add BREVO_SENDER_NAME production     # e.g. "Ticket Watcher"
vercel env add EVENT_URL production             # the Eventbrite URL
vercel env add CRON_SECRET production           # any random string you make up
vercel env add SIGNUP_PASSWORD production       # gates the signup/test-email forms
vercel env add SIGNUP_PASSWORD_2 production     # a second valid password (either works)
```

Note: non-ASCII passwords (e.g. an emoji) can get mangled by `vercel env add`'s
stdin handling on some shells. If that happens, set the value via the Vercel
API directly instead (`POST /v10/projects/<project>/env`) with a UTF-8 JSON
body — that path isn't subject to terminal/stdin encoding quirks.

Deploy:

```
vercel --prod
```

Note the production URL it prints (e.g. `https://ticket-watcher.vercel.app`).

### 5. Wire up the GitHub Actions cron

In the **public** `ticket-watcher` repo on GitHub:

- Settings → Secrets and variables → Actions → **Secrets** → New repository
  secret: `CRON_SECRET` = the same value you used in Vercel.
- Settings → Secrets and variables → Actions → **Variables** → New repository
  variable: `CHECK_URL` = `https://<your-vercel-url>/api/check`.

The workflow in `.github/workflows/ping-check.yml` will now curl that URL
every 5 minutes for free.

### 6. Test it

- Submit your own email on the deployed site to confirm `/api/subscribe`
  works (check `emails.json` in the private repo updates).
- Manually run the workflow once via GitHub → Actions → "Ping ticket check"
  → Run workflow, and check the job output.
- To rehearse a real notification, temporarily edit `state.json` in the
  private data repo to `"status": "on_sale"`, trigger the workflow, confirm
  you get no email (since current real status is still sold_out, so nothing
  changes — actually to rehearse, instead edit the deployed `EVENT_URL`
  temporarily to any *on-sale* Eventbrite event to confirm the email fires,
  then switch it back).

## Adding people manually

Just edit `emails.json` in the private `ticket-watcher-data` repo directly
(add an email to the array, commit). No need to go through the form.
