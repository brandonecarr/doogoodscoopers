-- =============================================================================
-- DooGoodScoopers Test Data Seed
-- Run this in Supabase SQL Editor to populate test data
-- =============================================================================

-- Using existing organization ID: b2b5d576-aee6-4899-9a2f-c3e1c68e802c
DO $$ BEGIN RAISE NOTICE 'Starting seed...'; END $$;

-- =============================================================================
-- 1. ORGANIZATION (skip if exists)
-- =============================================================================
INSERT INTO public.organizations (id, name, slug, phone, email, website, timezone, primary_color, secondary_color, address, settings)
VALUES (
  'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid,
  'DooGoodScoopers',
  'doogoodscoopers',
  '(909) 355-5555',
  'info@doogoodscoopers.com',
  'https://doogoodscoopers.com',
  'America/Los_Angeles',
  '#0D9488',
  '#1E3A5F',
  '{"city": "Rancho Cucamonga", "state": "CA", "zip": "91730"}',
  '{"businessHours": {"start": "08:00", "end": "17:00"}, "serviceRadius": 25}'
) ON CONFLICT (slug) DO NOTHING;

-- =============================================================================
-- 2. SERVICE PLANS
-- =============================================================================
INSERT INTO public.service_plans (id, org_id, name, description, frequency, is_active, sort_order)
VALUES
  ('5b000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Weekly Service', 'Once per week yard cleaning', 'WEEKLY', true, 1),
  ('5b000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Twice Weekly', 'Two visits per week', 'WEEKLY', true, 2),
  ('5b000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Every Other Week', 'Bi-weekly service', 'BIWEEKLY', true, 3),
  ('5b000000-0000-0000-0000-000000000004'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Monthly Service', 'Once per month deep clean', 'MONTHLY', true, 4),
  ('5b000000-0000-0000-0000-000000000005'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'One-Time Cleanup', 'Single visit cleanup', 'ONETIME', true, 5)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- =============================================================================
-- 3. ADD-ONS
-- =============================================================================
INSERT INTO public.add_ons (id, org_id, name, description, price_cents, price_type, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Extra Dog', 'Additional dog (3+)', 500, 'PER_DOG', true),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Deodorizing Treatment', 'Yard deodorizing spray', 1500, 'FIXED', true),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Large Yard', 'Properties over 10,000 sq ft', 1000, 'FIXED', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- =============================================================================
-- 4. PRICING RULES
-- =============================================================================
INSERT INTO public.pricing_rules (id, org_id, plan_id, name, frequency, min_dogs, max_dogs, base_price_cents, per_dog_price_cents, is_active, priority)
VALUES
  ('b0000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'Weekly 1-2 Dogs', 'WEEKLY', 1, 2, 1500, 0, true, 1),
  ('b0000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'Weekly 3-5 Dogs', 'WEEKLY', 3, 5, 2000, 500, true, 2),
  ('b0000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '5b000000-0000-0000-0000-000000000003'::uuid, 'Biweekly 1-2 Dogs', 'BIWEEKLY', 1, 2, 2500, 0, true, 3),
  ('b0000000-0000-0000-0000-000000000004'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '5b000000-0000-0000-0000-000000000004'::uuid, 'Monthly Base', 'MONTHLY', 1, 2, 4500, 0, true, 4),
  ('b0000000-0000-0000-0000-000000000005'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '5b000000-0000-0000-0000-000000000005'::uuid, 'One-Time Base', 'ONETIME', 1, 2, 7500, 0, true, 5)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- =============================================================================
-- 5. USERS (Staff)
-- =============================================================================
-- Note: These users need corresponding Supabase Auth users
-- The id should match the Supabase Auth user id

-- Office Manager (your admin user - must exist in Supabase Auth first)
INSERT INTO public.users (id, org_id, email, role, first_name, last_name, phone, is_active)
VALUES
  ('55b21f60-d575-4d7b-98ce-539301e6aa9c'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'admin@doogoodscoopers.com', 'OWNER', 'Admin', 'User', '(909) 555-0001', true)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  first_name = EXCLUDED.first_name,
  org_id = EXCLUDED.org_id,
  updated_at = NOW();

-- =============================================================================
-- 6. CLIENTS (10 test clients)
-- =============================================================================
INSERT INTO public.clients (id, org_id, first_name, last_name, email, phone, client_type, status, referral_source, tags, notification_preferences)
VALUES
  -- Active residential clients
  ('c1000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'John', 'Smith', 'john.smith@example.com', '(909) 555-1001', 'RESIDENTIAL', 'ACTIVE', 'Google', ARRAY['weekly', 'auto-pay'], '{"email": true, "sms": true}'),
  ('c1000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Sarah', 'Johnson', 'sarah.j@example.com', '(909) 555-1002', 'RESIDENTIAL', 'ACTIVE', 'Referral', ARRAY['weekly'], '{"email": true, "sms": true}'),
  ('c1000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Michael', 'Williams', 'mwilliams@example.com', '(909) 555-1003', 'RESIDENTIAL', 'ACTIVE', 'Facebook', ARRAY['biweekly'], '{"email": true, "sms": false}'),
  ('c1000000-0000-0000-0000-000000000004'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Emily', 'Brown', 'emily.brown@example.com', '(909) 555-1004', 'RESIDENTIAL', 'ACTIVE', 'Yelp', ARRAY['weekly', 'multiple-dogs'], '{"email": true, "sms": true}'),
  ('c1000000-0000-0000-0000-000000000005'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'David', 'Garcia', 'dgarcia@example.com', '(909) 555-1005', 'RESIDENTIAL', 'ACTIVE', 'Google', ARRAY['weekly'], '{"email": true, "sms": true}'),

  -- Paused client
  ('c1000000-0000-0000-0000-000000000006'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Jennifer', 'Martinez', 'jmartinez@example.com', '(909) 555-1006', 'RESIDENTIAL', 'PAUSED', 'Nextdoor', ARRAY['vacation'], '{"email": true, "sms": true}'),

  -- Delinquent client
  ('c1000000-0000-0000-0000-000000000007'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Robert', 'Anderson', 'randerson@example.com', '(909) 555-1007', 'RESIDENTIAL', 'DELINQUENT', 'Google', ARRAY['payment-issue'], '{"email": true, "sms": true}'),

  -- Commercial clients
  ('c1000000-0000-0000-0000-000000000008'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Property', 'Manager', 'pm@sunsetapts.com', '(909) 555-1008', 'COMMERCIAL', 'ACTIVE', 'Commercial Inquiry', ARRAY['commercial', 'hoa'], '{"email": true, "sms": false}'),
  ('c1000000-0000-0000-0000-000000000009'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'HOA', 'President', 'hoa@mountainview.com', '(909) 555-1009', 'COMMERCIAL', 'ACTIVE', 'Referral', ARRAY['commercial', 'hoa'], '{"email": true, "sms": false}'),

  -- Canceled client
  ('c1000000-0000-0000-0000-000000000010'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'Lisa', 'Taylor', 'ltaylor@example.com', '(909) 555-1010', 'RESIDENTIAL', 'CANCELED', 'Google', ARRAY[]::text[], '{"email": false, "sms": false}')
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  updated_at = NOW();

-- Update commercial clients with company names
UPDATE public.clients SET company_name = 'Sunset Apartments' WHERE id = 'c1000000-0000-0000-0000-000000000008'::uuid;
UPDATE public.clients SET company_name = 'Mountain View HOA' WHERE id = 'c1000000-0000-0000-0000-000000000009'::uuid;

-- =============================================================================
-- 7. LOCATIONS
-- =============================================================================
INSERT INTO public.locations (id, org_id, client_id, address_line1, city, state, zip_code, latitude, longitude, gate_code, access_notes, is_primary, is_active)
VALUES
  ('11000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, '123 Oak Street', 'Rancho Cucamonga', 'CA', '91730', 34.1064, -117.5931, NULL, 'Side gate unlocked', true, true),
  ('11000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, '456 Maple Ave', 'Upland', 'CA', '91786', 34.0975, -117.6484, '1234', 'Gate code on keypad at front', true, true),
  ('11000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, '789 Pine Road', 'Claremont', 'CA', '91711', 34.0967, -117.7198, NULL, 'Dog door to backyard', true, true),
  ('11000000-0000-0000-0000-000000000004'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, '321 Cedar Lane', 'Rancho Cucamonga', 'CA', '91737', 34.1330, -117.5594, '5678#', 'Large backyard, dogs are friendly', true, true),
  ('11000000-0000-0000-0000-000000000005'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000005'::uuid, '654 Birch Court', 'Fontana', 'CA', '92336', 34.0922, -117.4350, NULL, NULL, true, true),
  ('11000000-0000-0000-0000-000000000006'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000006'::uuid, '987 Elm Drive', 'Ontario', 'CA', '91764', 34.0633, -117.6509, NULL, 'On vacation until Feb', true, true),
  ('11000000-0000-0000-0000-000000000007'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000007'::uuid, '147 Walnut Street', 'Rancho Cucamonga', 'CA', '91730', 34.1064, -117.5931, NULL, NULL, true, true),
  ('11000000-0000-0000-0000-000000000008'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000008'::uuid, '500 Sunset Blvd', 'Rancho Cucamonga', 'CA', '91730', 34.1100, -117.5800, NULL, 'Multiple buildings - check map', true, true),
  ('11000000-0000-0000-0000-000000000009'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000009'::uuid, '100 Mountain View Dr', 'Upland', 'CA', '91786', 34.1050, -117.6400, NULL, 'Common areas only', true, true),
  ('11000000-0000-0000-0000-000000000010'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000010'::uuid, '222 Cherry Lane', 'Claremont', 'CA', '91711', 34.0950, -117.7100, NULL, NULL, true, false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 8. DOGS
-- =============================================================================
INSERT INTO public.dogs (id, org_id, client_id, name, breed, size, is_safe, safety_notes, is_active)
VALUES
  -- John Smith's dogs
  ('d0000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Max', 'Golden Retriever', 'LARGE', true, NULL, true),
  ('d0000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'Bella', 'Beagle', 'MEDIUM', true, NULL, true),

  -- Sarah Johnson's dog
  ('d0000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'Charlie', 'Labrador', 'LARGE', true, NULL, true),

  -- Michael Williams' dogs
  ('d0000000-0000-0000-0000-000000000004'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 'Cooper', 'Australian Shepherd', 'LARGE', true, NULL, true),
  ('d0000000-0000-0000-0000-000000000005'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 'Luna', 'Husky', 'LARGE', false, 'Barks at strangers - keep gate closed', true),

  -- Emily Brown's dogs (multiple)
  ('d0000000-0000-0000-0000-000000000006'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, 'Rocky', 'German Shepherd', 'XLARGE', false, 'Can be aggressive - do not enter if dog is out', true),
  ('d0000000-0000-0000-0000-000000000007'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, 'Daisy', 'Poodle', 'SMALL', true, NULL, true),
  ('d0000000-0000-0000-0000-000000000008'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, 'Duke', 'Boxer', 'LARGE', true, 'Very friendly', true),

  -- David Garcia's dog
  ('d0000000-0000-0000-0000-000000000009'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000005'::uuid, 'Buddy', 'Mixed', 'MEDIUM', true, NULL, true),

  -- Jennifer Martinez's dog (paused)
  ('d0000000-0000-0000-0000-000000000010'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000006'::uuid, 'Sadie', 'Corgi', 'SMALL', true, NULL, true),

  -- Robert Anderson's dog (delinquent)
  ('d0000000-0000-0000-0000-000000000011'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000007'::uuid, 'Tucker', 'Pit Bull', 'LARGE', true, 'Friendly but strong', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 9. SUBSCRIPTIONS
-- =============================================================================
-- Active subscriptions
INSERT INTO public.subscriptions (id, org_id, client_id, location_id, plan_id, status, frequency, preferred_day, price_per_visit_cents, next_service_date)
VALUES
  ('51000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, '11000000-0000-0000-0000-000000000001'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'ACTIVE', 'WEEKLY', 'MONDAY', 2000, CURRENT_DATE + INTERVAL '1 day'),
  ('51000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, '11000000-0000-0000-0000-000000000002'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'ACTIVE', 'WEEKLY', 'TUESDAY', 1500, CURRENT_DATE + INTERVAL '2 days'),
  ('51000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, '11000000-0000-0000-0000-000000000003'::uuid, '5b000000-0000-0000-0000-000000000003'::uuid, 'ACTIVE', 'BIWEEKLY', 'WEDNESDAY', 2500, CURRENT_DATE + INTERVAL '3 days'),
  ('51000000-0000-0000-0000-000000000004'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, '11000000-0000-0000-0000-000000000004'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'ACTIVE', 'WEEKLY', 'THURSDAY', 2500, CURRENT_DATE + INTERVAL '4 days'),
  ('51000000-0000-0000-0000-000000000005'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000005'::uuid, '11000000-0000-0000-0000-000000000005'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'ACTIVE', 'WEEKLY', 'FRIDAY', 1500, CURRENT_DATE + INTERVAL '5 days')
ON CONFLICT (id) DO NOTHING;

-- Paused subscription
INSERT INTO public.subscriptions (id, org_id, client_id, location_id, plan_id, status, frequency, preferred_day, price_per_visit_cents, pause_start_date, pause_end_date)
VALUES
  ('51000000-0000-0000-0000-000000000006'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000006'::uuid, '11000000-0000-0000-0000-000000000006'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'PAUSED', 'WEEKLY', 'MONDAY', 1500, CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- Past due subscription
INSERT INTO public.subscriptions (id, org_id, client_id, location_id, plan_id, status, frequency, preferred_day, price_per_visit_cents)
VALUES
  ('51000000-0000-0000-0000-000000000007'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000007'::uuid, '11000000-0000-0000-0000-000000000007'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'PAST_DUE', 'WEEKLY', 'TUESDAY', 1500)
ON CONFLICT (id) DO NOTHING;

-- Commercial subscriptions
INSERT INTO public.subscriptions (id, org_id, client_id, location_id, plan_id, status, frequency, preferred_day, price_per_visit_cents, next_service_date)
VALUES
  ('51000000-0000-0000-0000-000000000008'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000008'::uuid, '11000000-0000-0000-0000-000000000008'::uuid, '5b000000-0000-0000-0000-000000000001'::uuid, 'ACTIVE', 'WEEKLY', 'MONDAY', 15000, CURRENT_DATE + INTERVAL '1 day'),
  ('51000000-0000-0000-0000-000000000009'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000009'::uuid, '11000000-0000-0000-0000-000000000009'::uuid, '5b000000-0000-0000-0000-000000000003'::uuid, 'ACTIVE', 'BIWEEKLY', 'WEDNESDAY', 10000, CURRENT_DATE + INTERVAL '3 days')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 10. JOBS (Past, Today, Future)
-- =============================================================================
-- Past completed jobs (last 30 days)
INSERT INTO public.jobs (id, org_id, subscription_id, client_id, location_id, scheduled_date, status, price_cents, completed_at, duration_minutes)
SELECT
  gen_random_uuid(),
  'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid,
  '51000000-0000-0000-0000-000000000001'::uuid,
  'c1000000-0000-0000-0000-000000000001'::uuid,
  '11000000-0000-0000-0000-000000000001'::uuid,
  CURRENT_DATE - (n * 7),
  'COMPLETED',
  2000,
  (CURRENT_DATE - (n * 7) + TIME '10:30:00')::timestamp,
  15
FROM generate_series(1, 4) n
ON CONFLICT DO NOTHING;

INSERT INTO public.jobs (id, org_id, subscription_id, client_id, location_id, scheduled_date, status, price_cents, completed_at, duration_minutes)
SELECT
  gen_random_uuid(),
  'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid,
  '51000000-0000-0000-0000-000000000002'::uuid,
  'c1000000-0000-0000-0000-000000000002'::uuid,
  '11000000-0000-0000-0000-000000000002'::uuid,
  CURRENT_DATE - (n * 7) + 1,
  'COMPLETED',
  1500,
  (CURRENT_DATE - (n * 7) + 1 + TIME '11:00:00')::timestamp,
  12
FROM generate_series(1, 4) n
ON CONFLICT DO NOTHING;

-- A skipped job
INSERT INTO public.jobs (id, org_id, subscription_id, client_id, location_id, scheduled_date, status, price_cents, skip_reason)
VALUES
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '51000000-0000-0000-0000-000000000003'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, '11000000-0000-0000-0000-000000000003'::uuid, CURRENT_DATE - 14, 'SKIPPED', 0, 'Gate locked - customer not home')
ON CONFLICT DO NOTHING;

-- Today's jobs
INSERT INTO public.jobs (id, org_id, subscription_id, client_id, location_id, scheduled_date, status, price_cents, scheduled_time_start, scheduled_time_end)
VALUES
  ('01000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '51000000-0000-0000-0000-000000000001'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, '11000000-0000-0000-0000-000000000001'::uuid, CURRENT_DATE, 'SCHEDULED', 2000, '08:00', '09:00'),
  ('01000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '51000000-0000-0000-0000-000000000002'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, '11000000-0000-0000-0000-000000000002'::uuid, CURRENT_DATE, 'SCHEDULED', 1500, '09:00', '10:00'),
  ('01000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '51000000-0000-0000-0000-000000000004'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, '11000000-0000-0000-0000-000000000004'::uuid, CURRENT_DATE, 'SCHEDULED', 2500, '10:00', '11:00'),
  ('01000000-0000-0000-0000-000000000004'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '51000000-0000-0000-0000-000000000008'::uuid, 'c1000000-0000-0000-0000-000000000008'::uuid, '11000000-0000-0000-0000-000000000008'::uuid, CURRENT_DATE, 'SCHEDULED', 15000, '13:00', '15:00')
ON CONFLICT (id) DO NOTHING;

-- Future scheduled jobs (next 2 weeks)
INSERT INTO public.jobs (id, org_id, subscription_id, client_id, location_id, scheduled_date, status, price_cents)
SELECT
  gen_random_uuid(),
  'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid,
  '51000000-0000-0000-0000-000000000001'::uuid,
  'c1000000-0000-0000-0000-000000000001'::uuid,
  '11000000-0000-0000-0000-000000000001'::uuid,
  CURRENT_DATE + (n * 7),
  'SCHEDULED',
  2000
FROM generate_series(1, 2) n
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 11. ROUTES (Today's route)
-- =============================================================================
INSERT INTO public.routes (id, org_id, route_date, name, status)
VALUES
  ('e1000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, CURRENT_DATE, 'Monday Route A', 'PLANNED')
ON CONFLICT (id) DO NOTHING;

-- Route stops
INSERT INTO public.route_stops (id, org_id, route_id, job_id, stop_order, estimated_arrival)
VALUES
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, '01000000-0000-0000-0000-000000000001'::uuid, 1, '08:00'),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, '01000000-0000-0000-0000-000000000002'::uuid, 2, '09:00'),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, '01000000-0000-0000-0000-000000000003'::uuid, 3, '10:00'),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'e1000000-0000-0000-0000-000000000001'::uuid, '01000000-0000-0000-0000-000000000004'::uuid, 4, '13:00')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 12. INVOICES
-- =============================================================================
INSERT INTO public.invoices (id, org_id, client_id, invoice_number, status, subtotal_cents, tax_cents, discount_cents, total_cents, amount_paid_cents, amount_due_cents, due_date, paid_at)
VALUES
  -- Paid invoice
  ('f1000000-0000-0000-0000-000000000001'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'INV-00001', 'PAID', 8000, 0, 0, 8000, 8000, 0, CURRENT_DATE - 15, CURRENT_DATE - 15),
  -- Open invoice (unpaid)
  ('f1000000-0000-0000-0000-000000000002'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'INV-00002', 'OPEN', 6000, 0, 0, 6000, 0, 6000, CURRENT_DATE + 15, NULL),
  -- Open overdue invoice
  ('f1000000-0000-0000-0000-000000000003'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000007'::uuid, 'INV-00003', 'OPEN', 6000, 0, 0, 6000, 0, 6000, CURRENT_DATE - 10, NULL),
  -- Partial payment (still open)
  ('f1000000-0000-0000-0000-000000000004'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 'INV-00004', 'OPEN', 10000, 0, 0, 10000, 5000, 5000, CURRENT_DATE + 5, NULL),
  -- Commercial invoice (paid)
  ('f1000000-0000-0000-0000-000000000005'::uuid, 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000008'::uuid, 'INV-00005', 'PAID', 60000, 0, 0, 60000, 60000, 0, CURRENT_DATE - 5, CURRENT_DATE - 5)
ON CONFLICT (id) DO NOTHING;

-- Invoice line items
INSERT INTO public.invoice_items (id, org_id, invoice_id, description, quantity, unit_price_cents, total_cents)
VALUES
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'f1000000-0000-0000-0000-000000000001'::uuid, 'Weekly Service - 4 visits', 4, 2000, 8000),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'f1000000-0000-0000-0000-000000000002'::uuid, 'Weekly Service - 4 visits', 4, 1500, 6000),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'f1000000-0000-0000-0000-000000000003'::uuid, 'Weekly Service - 4 visits', 4, 1500, 6000),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid, 'Biweekly Service - 4 visits', 4, 2500, 10000),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'f1000000-0000-0000-0000-000000000005'::uuid, 'Commercial Weekly Service', 4, 15000, 60000)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 13. PAYMENTS
-- =============================================================================
INSERT INTO public.payments (id, org_id, client_id, invoice_id, amount_cents, status, payment_method, stripe_payment_intent_id, created_at)
VALUES
  -- Succeeded payments
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'f1000000-0000-0000-0000-000000000001'::uuid, 8000, 'SUCCEEDED', 'card', 'pi_test_123456', CURRENT_DATE - 15),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000008'::uuid, 'f1000000-0000-0000-0000-000000000005'::uuid, 60000, 'SUCCEEDED', 'check', 'pi_test_456789', CURRENT_DATE - 5),
  -- Partial payment
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000003'::uuid, 'f1000000-0000-0000-0000-000000000004'::uuid, 5000, 'SUCCEEDED', 'card', 'pi_test_789012', CURRENT_DATE - 8),
  -- Cash payment
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000004'::uuid, NULL, 2500, 'SUCCEEDED', 'cash', NULL, CURRENT_DATE - 3)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 14. LEADS
-- =============================================================================
INSERT INTO public.leads (id, org_id, source, status, first_name, last_name, email, phone, zip_code, city, state, dog_count, frequency, notes, created_at)
VALUES
  -- New leads
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'QUOTE_FORM', 'NEW', 'Amanda', 'Wilson', 'awilson@example.com', '(909) 555-2001', '91730', 'Rancho Cucamonga', 'CA', 2, 'WEEKLY', 'Submitted via website', CURRENT_DATE),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'QUOTE_FORM', 'NEW', 'Brian', 'Clark', 'bclark@example.com', '(909) 555-2002', '91786', 'Upland', 'CA', 1, 'BIWEEKLY', NULL, CURRENT_DATE - 1),

  -- Contacted leads
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'AD_LEAD', 'CONTACTED', 'Christina', 'Lee', 'clee@example.com', '(909) 555-2003', '91711', 'Claremont', 'CA', 3, 'WEEKLY', 'Called, left voicemail', CURRENT_DATE - 3),

  -- Qualified lead
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'REFERRAL', 'QUALIFIED', 'Daniel', 'Kim', 'dkim@example.com', '(909) 555-2004', '91730', 'Rancho Cucamonga', 'CA', 2, 'WEEKLY', 'Referred by John Smith, ready to start', CURRENT_DATE - 5),

  -- Lost lead
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'QUOTE_FORM', 'LOST', 'Eva', 'Rodriguez', 'erodriguez@example.com', '(909) 555-2005', '91737', 'Rancho Cucamonga', 'CA', 1, 'MONTHLY', 'Price too high', CURRENT_DATE - 10),

  -- Commercial lead
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'COMMERCIAL', 'CONTACTED', 'Frank', 'Manager', 'fmanager@bigcomplex.com', '(909) 555-2006', '91730', 'Rancho Cucamonga', 'CA', NULL, NULL, '200 unit apartment complex', CURRENT_DATE - 2),

  -- Out of area lead
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'OUT_OF_AREA', 'NEW', 'Grace', 'Thompson', 'gthompson@example.com', '(213) 555-2007', '90001', 'Los Angeles', 'CA', 2, 'WEEKLY', 'Outside service area', CURRENT_DATE - 1)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 15. REFERRAL PROGRAM
-- =============================================================================
INSERT INTO public.referral_program_settings (org_id, is_enabled, reward_referrer_cents, reward_referee_cents, reward_type, terms)
VALUES
  ('b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, true, 2500, 1500, 'ACCOUNT_CREDIT', 'Referrer receives $25 credit after referee completes 4 paid services. Referee receives $15 off first service.')
ON CONFLICT (org_id) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  reward_referrer_cents = EXCLUDED.reward_referrer_cents;

-- Referrals
INSERT INTO public.referrals (id, org_id, referrer_client_id, referral_code, referee_name, referee_email, referee_phone, status, created_at)
VALUES
  -- Rewarded referral (completed)
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'C1000000', 'Sarah Johnson', 'sarah.j@example.com', '(909) 555-1002', 'REWARDED', CURRENT_DATE - 60),
  -- New referrals
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000001'::uuid, 'C1000001', 'New Friend', 'newfriend@example.com', '(909) 555-3001', 'NEW', CURRENT_DATE - 5),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'c1000000-0000-0000-0000-000000000002'::uuid, 'C1000002', 'Another Friend', 'another@example.com', '(909) 555-3002', 'INVITED', CURRENT_DATE - 3)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 16. GIFT CERTIFICATES
-- =============================================================================
INSERT INTO public.gift_certificates (id, org_id, code, initial_value_cents, balance_cents, purchaser_name, purchaser_email, recipient_name, recipient_email, status, expires_at)
VALUES
  -- Active gift certificate
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'GIFT-ABC123', 5000, 5000, 'Gift Buyer', 'buyer@example.com', 'Lucky Recipient', 'lucky@example.com', 'ACTIVE', CURRENT_DATE + 335),
  -- Partially used
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'GIFT-DEF456', 10000, 6500, 'Another Buyer', 'buyer2@example.com', 'Happy Person', 'happy@example.com', 'ACTIVE', CURRENT_DATE + 305),
  -- Fully redeemed
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'GIFT-GHI789', 7500, 0, 'Third Buyer', 'buyer3@example.com', 'Super Lucky', 'superlucky@example.com', 'REDEEMED', CURRENT_DATE + 275)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 17. NOTIFICATION TEMPLATES
-- =============================================================================
INSERT INTO public.notification_templates (id, org_id, type, channel, name, subject, body, is_enabled)
VALUES
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'ON_THE_WAY', 'SMS', 'On The Way SMS', NULL, 'Hi {{client_name}}! Your DooGoodScoopers technician is on the way and will arrive in approximately {{eta}} minutes.', true),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'DAY_AHEAD', 'SMS', 'Day Ahead Reminder', NULL, 'Reminder: DooGoodScoopers is scheduled to service your yard tomorrow. Please ensure gate access is available.', true),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'COMPLETED', 'SMS', 'Service Completed', NULL, 'Your yard has been serviced by DooGoodScoopers! Thanks for being a valued customer.', true),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'WELCOME', 'EMAIL', 'Welcome Email', 'Welcome to DooGoodScoopers!', 'Hi {{client_name}},\n\nWelcome to the DooGoodScoopers family! We''re excited to help keep your yard clean.\n\nYour first service is scheduled for {{next_service_date}}.\n\nThanks,\nThe DooGoodScoopers Team', true),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 'PAYMENT_FAILED', 'EMAIL', 'Payment Failed', 'Action Required: Payment Failed', 'Hi {{client_name}},\n\nWe were unable to process your payment. Please update your payment method to avoid service interruption.\n\nThanks,\nDooGoodScoopers', true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 18. PUBLIC METRICS CACHE
-- =============================================================================
INSERT INTO public.public_metrics_cache (org_id, satisfied_customers, happy_pets, completed_yards, five_star_reviews, computed_at)
VALUES
  ('b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, 847, 1523, 52847, 312, NOW())
ON CONFLICT (org_id) DO UPDATE SET
  satisfied_customers = EXCLUDED.satisfied_customers,
  happy_pets = EXCLUDED.happy_pets,
  completed_yards = EXCLUDED.completed_yards,
  five_star_reviews = EXCLUDED.five_star_reviews,
  computed_at = NOW();

-- =============================================================================
-- 19. ZIP FREQUENCY RESTRICTIONS (Zip Guard)
-- =============================================================================
-- Note: This table stores BLOCKED frequencies, not allowed ones
INSERT INTO public.zip_frequency_restrictions (id, org_id, zip, blocked_frequencies, note)
VALUES
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '91701', ARRAY['MONTHLY', 'ONETIME'], 'Full service area - no monthly or one-time'),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '91730', ARRAY['ONETIME'], 'Primary service area - no one-time'),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '91737', ARRAY['ONETIME'], 'Primary service area - no one-time'),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '91786', ARRAY['MONTHLY', 'ONETIME'], 'Upland area - no monthly or one-time'),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '91711', ARRAY['BIWEEKLY', 'MONTHLY', 'ONETIME'], 'Claremont - weekly only'),
  (gen_random_uuid(), 'b2b5d576-aee6-4899-9a2f-c3e1c68e802c'::uuid, '92336', ARRAY['MONTHLY', 'ONETIME'], 'Fontana area - no monthly or one-time')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- DONE!
-- =============================================================================
-- Summary of test data created:
-- - 1 Organization (id: b2b5d576-aee6-4899-9a2f-c3e1c68e802c)
-- - 5 Service Plans
-- - 3 Add-ons
-- - 3 Pricing Rules
-- - 1 Admin User (must exist in Supabase Auth first with id: 55b21f60-d575-4d7b-98ce-539301e6aa9c)
-- - 10 Clients (various statuses)
-- - 10 Locations
-- - 11 Dogs
-- - 9 Subscriptions
-- - ~20 Jobs (past, present, future)
-- - 1 Route with 4 stops
-- - 5 Invoices
-- - 4 Payments
-- - 7 Leads
-- - Referral program + 3 referrals
-- - 3 Gift certificates
-- - 5 Notification templates
-- - Public metrics
-- - 6 ZIP restrictions

SELECT 'Seed data created successfully!' as status;
