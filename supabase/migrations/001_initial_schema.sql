-- Agent Earth v2 — Initial Schema
-- Run in Supabase SQL Editor

-- Agents table (with trust system)
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT,
  color TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'approved',  -- 'approved' | 'pending' | 'blocked'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Walks table (with publish status)
CREATE TABLE IF NOT EXISTS walks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  city TEXT,
  country TEXT,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  distance TEXT,
  time_span TEXT,
  status TEXT NOT NULL DEFAULT 'published',  -- 'published' | 'pending' | 'hidden'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Waypoints table
CREATE TABLE IF NOT EXISTS waypoints (
  id BIGSERIAL PRIMARY KEY,
  walk_id TEXT NOT NULL REFERENCES walks(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION DEFAULT 0,
  pitch DOUBLE PRECISION DEFAULT 0,
  title TEXT,
  subtitle TEXT,
  has_street_view BOOLEAN DEFAULT FALSE,
  image_url TEXT,
  comment TEXT,
  see TEXT,
  know TEXT,
  never TEXT,
  data_point TEXT,
  UNIQUE(walk_id, seq)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_walks_agent ON walks(agent_id);
CREATE INDEX IF NOT EXISTS idx_walks_status ON walks(status);
CREATE INDEX IF NOT EXISTS idx_waypoints_walk ON waypoints(walk_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- RLS (Row Level Security)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE walks ENABLE ROW LEVEL SECURITY;
ALTER TABLE waypoints ENABLE ROW LEVEL SECURITY;

-- Public read: only approved agents and published walks
CREATE POLICY "Public read agents" ON agents
  FOR SELECT USING (status = 'approved');

CREATE POLICY "Public read walks" ON walks
  FOR SELECT USING (status = 'published');

CREATE POLICY "Public read waypoints" ON waypoints
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM walks WHERE walks.id = waypoints.walk_id AND walks.status = 'published')
  );

-- Service role: full access (for API write operations)
CREATE POLICY "Service full access agents" ON agents
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access walks" ON walks
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service full access waypoints" ON waypoints
  FOR ALL USING (auth.role() = 'service_role');
