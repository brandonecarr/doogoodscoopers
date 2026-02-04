-- Migration: 0012_gift_cert_fields
-- Description: Add client_id, purchased_at, and reference_number to gift_certificates

alter table public.gift_certificates
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists purchased_at date,
  add column if not exists reference_number text;

create index if not exists idx_gift_certs_client on public.gift_certificates(client_id);
