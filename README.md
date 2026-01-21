This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Sweep&Go Webhook Integration

This site integrates with Sweep&Go for quote management. When a customer submits a quote through the Sweep&Go form, a webhook notification is sent to our server, which then sends branded email confirmations.

### Webhook Endpoint

```
POST /api/webhooks/sweepandgo
```

### Supported Events

- `free:quote` - Triggered when a customer requests a free quote

### Setting Up Webhooks in Sweep&Go

1. Log in to your Sweep&Go dashboard
2. Navigate to **Settings** > **API & Integrations**
3. Generate or edit an API token
4. Set the webhook URL to: `https://yourdomain.com/api/webhooks/sweepandgo`
5. Enable the `free:quote` event
6. Save your settings

### Local Development Testing

For local development, use [ngrok](https://ngrok.com/) to expose your local server:

```bash
# Start your dev server
npm run dev:webpack

# In another terminal, start ngrok
ngrok http 3000

# Use the ngrok URL (e.g., https://abc123.ngrok.io/api/webhooks/sweepandgo)
# as your webhook URL in Sweep&Go settings
```

### Environment Variables

Configure these in `.env.local`:

```env
# SMTP Configuration for branded emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here
SMTP_FROM=service@doogoodscoopers.com
SMTP_FROM_NAME=DooGoodScoopers

# Notification recipient
NOTIFY_EMAIL=service@doogoodscoopers.com
```

**Note for Gmail:** Use an [App Password](https://myaccount.google.com/apppasswords) instead of your regular password.

### Email Features

When a `free:quote` webhook is received:

1. **Customer Email**: A branded confirmation email is sent to the customer with:
   - Quote details (if available)
   - Service information
   - Contact information
   - Next steps

2. **Business Notification**: An internal notification is sent to `NOTIFY_EMAIL` with the customer's details.
