# Sweep&Go Migration Guide

This document outlines the complete migration process from Sweep&Go to the new DooGoodScoopers operations platform.

## Overview

The new platform is a complete replacement for Sweep&Go, built on:
- **Supabase** for database and authentication
- **Stripe** for direct payment processing
- **Custom APIs** for all business logic

The migration involves:
1. Exporting data from Sweep&Go
2. Importing into the new system
3. Verifying data integrity
4. Switching over customer-facing systems
5. Retiring Sweep&Go

---

## Pre-Migration Checklist

### 1. Environment Setup

Ensure all environment variables are configured:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe (Required)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Organization
DEFAULT_ORG_ID=doogoodscoopers

# Email (Resend)
RESEND_API_KEY=re_xxx

# SMS (Twilio)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

### 2. Database Ready

Verify Supabase migrations have been applied:

```bash
# Check migration status
npx supabase migration list
```

### 3. Pricing Configuration

Before importing customers, ensure pricing is configured:
- Service plans exist in `service_plans` table
- Pricing rules exist in `pricing_rules` table
- Add-ons configured in `add_ons` table
- ZIP codes configured for service areas

---

## Step 1: Export Data from Sweep&Go

### 1.1 Customer Export

Log into Sweep&Go and export customer data:

1. Go to **Customers** > **Export**
2. Select all fields
3. Export as CSV
4. Save as `sweepandgo-customers.csv`

Expected CSV columns:
```
client_id, first_name, last_name, email, phone, address, city, state, zip,
gate_code, gate_location, dog_count, dog_names, frequency, status,
stripe_customer_id, created_at
```

### 1.2 Subscription Export (Optional)

If Sweep&Go supports subscription export:
1. Export subscription data
2. Save as `sweepandgo-subscriptions.csv`

### 1.3 Payment History (Optional)

For historical records:
1. Export payment history
2. Save for reference (not imported automatically)

---

## Step 2: Import Data

### 2.1 Dry Run

First, run the migration in dry-run mode to preview changes:

```bash
npx ts-node scripts/migrate-sweepandgo.ts \
  --file sweepandgo-customers.csv \
  --dry-run
```

Review the output carefully:
- Number of customers to create
- Number of customers to update (existing by email)
- Any validation errors

### 2.2 Actual Import

Once satisfied with the dry run, perform the actual import:

```bash
npx ts-node scripts/migrate-sweepandgo.ts \
  --file sweepandgo-customers.csv
```

The script will:
- Create client records
- Create location records
- Create dog records
- Link Stripe customer IDs if present
- Create subscriptions for active customers

### 2.3 Review Results

The script creates a results file: `migration-results-{timestamp}.json`

Check for any errors and address individually.

---

## Step 3: Verify Data Integrity

### 3.1 Run Verification Script

```bash
npx ts-node scripts/verify-migration.ts
```

This checks:
- All clients have valid data
- No duplicate emails
- No orphaned records
- Locations have required fields
- Stripe customer IDs are valid
- Sweep&Go IDs are unique

### 3.2 Fix Issues (if needed)

If fixable issues are found:

```bash
npx ts-node scripts/verify-migration.ts --fix
```

### 3.3 Manual Verification

1. **Spot check customers**: Pick 10 random customers and verify:
   - Name and contact info correct
   - Address and location correct
   - Dogs listed correctly
   - Subscription status matches

2. **Check Stripe sync**: Verify Stripe customers have matching IDs

3. **Test login**: Have a few customers test the new client portal

---

## Step 4: Cutover

### 4.1 DNS/Domain Switch

If using a custom domain:
1. Update DNS to point to new Vercel deployment
2. Wait for propagation (up to 48 hours)

### 4.2 Quote Form Switch

The quote form already uses the new v2 API. No changes needed.

### 4.3 Customer Communication

Send email to existing customers:
- New portal URL
- Login instructions (magic link)
- What's changed
- Support contact

### 4.4 Stripe Webhook Update

Ensure Stripe webhooks point to the new endpoint:
1. Go to Stripe Dashboard > Developers > Webhooks
2. Update endpoint URL to: `https://yourdomain.com/api/webhooks/stripe`
3. Verify events are being received

---

## Step 5: Post-Migration

### 5.1 Monitor

For the first week:
- Watch for failed payments
- Monitor error logs
- Check customer support tickets
- Verify job generation is working

### 5.2 Retire Sweep&Go

Once stable (recommend 30 days):
1. Cancel Sweep&Go subscription
2. Export final backup from Sweep&Go
3. Archive for records

### 5.3 Cleanup

Remove any remaining Sweep&Go references:
- Environment variables (SWEEPANDGO_*)
- Database backup references
- Internal documentation

---

## Rollback Plan

If critical issues arise during migration:

### Immediate Rollback (First 24 hours)

1. Restore DNS to old deployment
2. Customer data in Sweep&Go is still valid
3. Investigate issues in new system

### Partial Rollback

1. New customers continue on new system
2. Existing customers flagged for manual migration later

---

## Data Mapping Reference

### Customer Status

| Sweep&Go | New System |
|----------|------------|
| active | ACTIVE |
| paused | PAUSED |
| cancelled | CANCELED |
| suspended | PAUSED |
| inactive | CANCELED |

### Frequency

| Sweep&Go | New System |
|----------|------------|
| weekly, once_a_week | WEEKLY |
| bi-weekly, biweekly | BIWEEKLY |
| monthly, once_a_month | MONTHLY |
| one-time, onetime | ONETIME |

### Database Field Mapping

| Sweep&Go Field | New Field |
|----------------|-----------|
| client_id | sweep_and_go_client_id |
| first_name | first_name |
| last_name | last_name |
| email | email |
| phone | phone |
| address | locations.address_line1 |
| city | locations.city |
| state | locations.state |
| zip | locations.zip_code |
| gate_code | locations.gate_code |
| gate_location | locations.gate_location |
| stripe_customer_id | stripe_customer_id |

---

## Troubleshooting

### Common Issues

**"Duplicate email" error during import**
- Check if customer already exists in new system
- Use `--skip-existing` flag to skip duplicates

**"Stripe customer not found" warning**
- Customer may have been deleted from Stripe
- Create new Stripe customer manually if needed

**"Location missing address" error**
- Address is required; update source CSV
- Or fix manually after import

### Support

For migration support, contact the development team or check the project issues.
