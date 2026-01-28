-- Change Requests Table
-- Stores client-initiated requests for changes to their account

CREATE TABLE change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Request type and status
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED')),

  -- Request details
  title text NOT NULL,
  description text,
  current_value jsonb,      -- Current state before change
  requested_value jsonb,    -- Requested new state

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,

  -- Who handled it
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolution_notes text
);

-- Indexes for efficient queries
CREATE INDEX idx_change_requests_org ON change_requests(org_id);
CREATE INDEX idx_change_requests_client ON change_requests(client_id);
CREATE INDEX idx_change_requests_status ON change_requests(org_id, status);
CREATE INDEX idx_change_requests_type ON change_requests(org_id, request_type);
CREATE INDEX idx_change_requests_created ON change_requests(org_id, created_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER update_change_requests_updated_at
  BEFORE UPDATE ON change_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view change requests for their org"
  ON change_requests
  FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert change requests for their org"
  ON change_requests
  FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update change requests for their org"
  ON change_requests
  FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete change requests for their org"
  ON change_requests
  FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Comments for documentation
COMMENT ON TABLE change_requests IS 'Client-initiated requests for changes to their account';
COMMENT ON COLUMN change_requests.request_type IS 'Type of change request (e.g., CHANGE_CONTACT_INFO, CHANGE_SERVICE_DAY, PAUSE_SERVICE, etc.)';
COMMENT ON COLUMN change_requests.current_value IS 'JSON object containing the current state before the change';
COMMENT ON COLUMN change_requests.requested_value IS 'JSON object containing the requested new state';
