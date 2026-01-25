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

## Architecture

This is the DooGoodScoopers operations platform - a complete pet-waste service management system.

### Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth with role-based access control
- **Payments**: Stripe (subscriptions, invoices, gift certificates)
- **Notifications**: Twilio (SMS) + Resend (Email)
- **Hosting**: Vercel

### Portals

- `/app/office` - Office staff portal (scheduling, dispatch, clients, billing)
- `/app/field` - Field technician PWA (routes, job completion, photos)
- `/app/client` - Customer self-service portal

### Key Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Resend (Email)
RESEND_API_KEY=

# Organization
DEFAULT_ORG_ID=doogoodscoopers
```

### API Structure

- `/api/v2/*` - Public quote/onboarding APIs
- `/api/admin/*` - Office portal APIs (authenticated)
- `/api/field/*` - Field tech APIs (authenticated)
- `/api/client/*` - Client portal APIs (authenticated)
- `/api/public/*` - Public APIs (metrics, etc.)
- `/api/webhooks/*` - Stripe webhook handlers
