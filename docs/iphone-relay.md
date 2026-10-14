# iPhone relay (BlueBubbles) — setup checklist

Campaign texts can go out from the office iPhone's number, **(760) 987-6771**, as
iMessage (blue bubble) or as a regular text through the iPhone. The app talks to a
BlueBubbles Server running on the office Mac mini in the **DGS Relay** macOS user,
which drives the Messages app signed in as **service@doogoodscoopers.com**.

Code: `src/lib/bluebubbles.ts` (relay client + pacing), `src/lib/text-send.ts`
(which line a campaign uses), `src/app/api/webhooks/bluebubbles/route.ts` (replies,
delivery, server URL changes), `src/lib/inbound-text.ts` (reply handling shared with
Quo). Settings UI: **Campaigns → Text sending**.

## A. iPhone (once)

1. Settings → your name: the iPhone is signed into **service@doogoodscoopers.com**.
2. Settings → Messages → **Send & Receive**: the number (760) 987-6771 is checked
   and is the "Start new conversations from" choice.
3. Settings → Messages → **Text Message Forwarding**: turn on the Mac mini once it
   appears (after step B.2). This is what sends green-bubble texts to people
   without iMessage.

## B. Mac mini — in the DGS Relay user

1. Log into **DGS Relay** (Fast User Switching is fine; it keeps running when you
   switch back to your own account).
2. System Settings → sign the user into **service@doogoodscoopers.com**. Open
   Messages → Settings → iMessage: the (760) number is listed and selected under
   "Start new conversations from".
3. Install the server: open `/Users/Shared/BlueBubbles-1.9.9-arm64.dmg`, drag the
   app to Applications, then **right-click → Open** the first time (the app is
   unsigned).
4. Setup wizard:
   - Permissions: grant **Full Disk Access** (Accessibility is optional).
   - Notifications / Firebase: **skip** — only the BlueBubbles phone app uses it.
   - Connection: set a strong **server password**. Proxy service: **Cloudflare**.
     Copy the URL it shows.
   - Private API: see section C, then come back and turn it on.
   - Finish: turn on **Start on login** / auto-start if offered.
5. Server settings → **Webhooks → Add**: paste the webhook URL from the Campaigns
   page card (it contains its own secret) and subscribe to **New messages,
   Message updates, Message errors, Server URL changes**. Use the test button; the
   card shows "last webhook: just now".
6. Keep-alive: System Settings → Energy → never sleep, "Wake for network access"
   on. Leave DGS Relay logged in.

## C. Private API (needed — it is how the relay starts a conversation with a new number)

1. Shut down. Hold the power button → **Options** → Recovery.
2. Utilities → Terminal: `csrutil disable` (on newer Apple Silicon releases you may
   need to hold Left Shift when the login prompt appears). Restart.
3. In the DGS Relay user: `defaults write -g DisableLibraryValidation -bool true` in
   Terminal, then open BlueBubbles Server → Private API → **enable** and confirm the
   helper connects.
4. This disables SIP for the whole Mac mini, including the personal account.

## D. Vercel + app

1. Vercel → Environment Variables: add **`BLUEBUBBLES_PASSWORD`** = the server
   password (Production). Redeploy. (`BLUEBUBBLES_WEBHOOK_SECRET` is optional; the
   webhook URL otherwise derives its secret from the password.)
2. /admin/campaigns → **Text sending → Relay setup**: paste the server URL, check
   **Relay on**, Save. Status shows "Connected · Private API on".
3. Send a test text to your own cell from the card. Reply to it from your phone;
   it should land on your lead/customer timeline and the inbox.
4. Choose the default: **iPhone** for all campaign texts, or leave the office line
   and pick iPhone per drip ("Send text messages from" on the drip form).

## Pacing and fallback

- The iPhone path sends at most one text per cron run (about one a minute) and
  stops at the daily cap: 40/day the first week, 100 the second, then 200, unless
  a number is typed in the card. Anything over the cap waits for the next day.
- If the relay is unreachable or a send fails, the text goes out from the Quo line
  (toggle in the card). Pacing never falls back; it only waits.
- STOP replies to the iPhone are handled by the app (no carrier does it for
  iMessage). The lead is archived and the number goes on the do-not-contact list.
- The Cloudflare tunnel URL changes when the server restarts; BlueBubbles tells the
  webhook and the app updates the URL by itself.
