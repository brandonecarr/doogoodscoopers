-- New lead status: QUOTED (got a price from the website quote form, no signup yet).
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'QUOTED';
