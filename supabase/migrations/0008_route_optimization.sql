-- Route Optimization Tables
-- Stores AI-generated route suggestions and analysis run history

-- Store AI-generated route suggestions
CREATE TABLE route_optimization_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES subscriptions(id) ON DELETE SET NULL,
  suggestion_type text NOT NULL, -- 'new_client_placement', 'move_day', 'full_reorg'
  current_state jsonb,           -- Current day/tech/route info
  suggested_state jsonb,         -- Recommended day/tech/route
  reasoning text,                -- AI explanation
  distance_impact_meters int,    -- Estimated route distance change
  time_impact_minutes int,       -- Estimated time savings
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- Track AI analysis runs
CREATE TABLE route_analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  run_type text NOT NULL CHECK (run_type IN ('continuous_check', 'full_reorg', 'new_client')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  suggestions_generated int DEFAULT 0,
  metadata jsonb                 -- Days analyzed, clients affected, etc.
);

-- Indexes for efficient queries
CREATE INDEX idx_suggestions_org_status ON route_optimization_suggestions(org_id, status);
CREATE INDEX idx_suggestions_subscription ON route_optimization_suggestions(subscription_id);
CREATE INDEX idx_suggestions_created ON route_optimization_suggestions(created_at DESC);
CREATE INDEX idx_analysis_runs_org ON route_analysis_runs(org_id);
CREATE INDEX idx_analysis_runs_started ON route_analysis_runs(started_at DESC);

-- Enable RLS
ALTER TABLE route_optimization_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_analysis_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for route_optimization_suggestions
CREATE POLICY "Users can view their org suggestions"
  ON route_optimization_suggestions
  FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert suggestions for their org"
  ON route_optimization_suggestions
  FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their org suggestions"
  ON route_optimization_suggestions
  FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their org suggestions"
  ON route_optimization_suggestions
  FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- RLS policies for route_analysis_runs
CREATE POLICY "Users can view their org analysis runs"
  ON route_analysis_runs
  FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert analysis runs for their org"
  ON route_analysis_runs
  FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their org analysis runs"
  ON route_analysis_runs
  FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));
