-- ============================================================
-- GoSkate — Spots Table Schema
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- to create the spots table.
--
-- This single table stores both official and user-added spots.
-- For now, only official spots are loaded from Supabase.
-- User spots will be migrated from mock data later.
-- ============================================================

-- Create the spots table
CREATE TABLE IF NOT EXISTS spots (
  -- Primary key — auto-generated UUID
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- ---- Display fields ----
  -- The name shown to users in the app (may be enriched)
  display_name  TEXT NOT NULL,
  -- What kind of spot: 'skatepark' or 'street'
  type          TEXT NOT NULL CHECK (type IN ('skatepark', 'street')),
  -- Who added the spot: 'official' (from OSM) or 'user' (community-added)
  source        TEXT NOT NULL CHECK (source IN ('official', 'user')),

  -- ---- Coordinates (internal only — never shown in UI) ----
  latitude      DOUBLE PRECISION NOT NULL,
  longitude     DOUBLE PRECISION NOT NULL,

  -- ---- OSM provenance ----
  -- The original name from OpenStreetMap (if any)
  osm_name      TEXT,
  -- The OSM element identifier, e.g. "way/123456"
  osm_id        TEXT UNIQUE,

  -- ---- Enrichment tracking ----
  -- Has an enrichment attempt been made for this spot?
  enrichment_checked    BOOLEAN DEFAULT FALSE,
  -- Where the enriched name came from (e.g. 'google_places', 'manual', NULL)
  enrichment_source     TEXT,
  -- How confident the enriched name is: 'high', 'medium', 'low', or NULL
  enrichment_confidence TEXT CHECK (
    enrichment_confidence IN ('high', 'medium', 'low') OR enrichment_confidence IS NULL
  ),
  -- Should a human review this spot's name?
  needs_review          BOOLEAN DEFAULT FALSE,

  -- ---- Timestamps ----
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS)
--
-- Enable RLS so the table isn't wide-open.
-- For now we allow anyone to SELECT (read) spots — the app
-- needs this to display markers on the map.
-- INSERT/UPDATE/DELETE are blocked for anonymous users.
-- ============================================================

ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read spots (including anonymous / anon key)
CREATE POLICY "Anyone can read spots"
  ON spots FOR SELECT
  USING (true);

-- ============================================================
-- Indexes — speed up common queries
-- ============================================================

-- Fast lookups by source (e.g. "give me all official spots")
CREATE INDEX IF NOT EXISTS idx_spots_source ON spots (source);

-- Fast lookups for the review workflow
CREATE INDEX IF NOT EXISTS idx_spots_needs_review ON spots (needs_review) WHERE needs_review = TRUE;

-- Spatial lookups (optional, for future bounding-box queries)
CREATE INDEX IF NOT EXISTS idx_spots_lat_lng ON spots (latitude, longitude);
