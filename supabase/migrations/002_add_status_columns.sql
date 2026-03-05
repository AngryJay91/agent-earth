-- Migration 002: Add status columns to existing tables
-- Needed for databases created before 001_initial_schema.sql
-- (CREATE TABLE IF NOT EXISTS does NOT add columns to existing tables)
-- Safe to run multiple times (IF NOT EXISTS).

-- P3: agents.status
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';

-- P3: walks.status
ALTER TABLE walks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Existing rows automatically get DEFAULT values:
--   agents → 'approved'  (existing agents are trusted)
--   walks  → 'published' (existing walks are already live)
