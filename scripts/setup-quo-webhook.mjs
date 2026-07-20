/**
 * Register the Quo webhook(s) that point at this app's /api/webhooks/quo route.
 *
 * Quo exposes two webhook APIs:
 *   - Legacy (per resource): POST https://api.quo.com/v1/webhooks/{messages|calls|call-summaries|call-transcripts}
 *   - Beta (single, multi-event): POST https://api.quo.com/webhooks  with { url, events: [...] }
 *
 * This script uses the LEGACY endpoints by default (best-documented). If your
 * workspace is on the beta webhooks, pass `--beta`.
 *
 * Usage:
 *   node --env-file=.env scripts/setup-quo-webhook.mjs https://doogoodscoopers.vercel.app/api/webhooks/quo
 *   node --env-file=.env scripts/setup-quo-webhook.mjs <url> --beta
 *
 * Requires QUO_API_KEY in env. Auth header is the RAW key (not Bearer).
 */

const apiKey = process.env.QUO_API_KEY;
if (!apiKey) {
  console.error("Missing QUO_API_KEY in env.");
  process.exit(1);
}

const args = process.argv.slice(2);
const beta = args.includes("--beta");
const url = args.find((a) => !a.startsWith("--"));
if (!url) {
  console.error("Provide the webhook URL, e.g. https://<app>/api/webhooks/quo");
  process.exit(1);
}

const headers = { Authorization: apiKey, "Content-Type": "application/json", Accept: "application/json" };

async function post(path, body) {
  const res = await fetch(`https://api.quo.com${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { data = await res.text(); }
  console.log(`POST ${path} → ${res.status}`);
  console.log(JSON.stringify(data, null, 2));
  return res.ok;
}

if (beta) {
  // Single beta webhook subscribing to every event we handle.
  await post("/webhooks", {
    url,
    events: [
      "message.received",
      "message.delivered",
      "message.failed",
      "call.completed",
      "call.summary.completed",
      "call.transcript.completed",
      "call.missed",
      "call.voicemail.completed",
    ],
  });
} else {
  // Legacy: one subscription per resource type, all pointing at the same URL.
  await post("/v1/webhooks/messages", { url });
  await post("/v1/webhooks/calls", { url });
  await post("/v1/webhooks/call-summaries", { url });
  await post("/v1/webhooks/call-transcripts", { url });
}

console.log("\nDone. Verify in the Quo dashboard, then send a test text to your Quo number.");
