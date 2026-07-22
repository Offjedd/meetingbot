/*
# Create Dashboard Database Schema

## Overview
This migration creates the core database schema for the Meeting Assistant Dashboard.
It includes tables for user profiles, meeting bots, bot events, and transcripts.

## New Tables

### 1. `profiles`
- Stores user profile information linked to Supabase auth.
- `id` (uuid, PK, FK to auth.users)
- `username` (text, nullable display name)
- `created_at` (timestamptz, default now)

### 2. `bots`
- Stores meeting bot records — one per submitted meeting link.
- `id` (uuid, PK, default gen_random_uuid())
- `user_id` (uuid, NOT NULL DEFAULT auth.uid(), FK to auth.users ON DELETE CASCADE)
- `meeting_url` (text, the raw meeting link)
- `platform` (text: google, zoom, or teams)
- `meeting_title` (text, optional user-provided title)
- `meeting_info` (jsonb, parsed meeting data from link validation)
- `status` (text, default 'READY_TO_DEPLOY': READY_TO_DEPLOY, DEPLOYING, JOINING_CALL, IN_WAITING_ROOM, IN_CALL, CALL_ENDED, DONE, FATAL)
- `recording_url` (text, nullable, S3 signed URL or key)
- `scheduled_at` (timestamptz, nullable, when the bot should auto-deploy)
- `started_at` (timestamptz, nullable, when the bot was actually deployed)
- `youtube_video_id` (text, nullable, YouTube video ID after upload)
- `youtube_upload_status` (text, nullable: pending, uploading, done, failed)
- `last_heartbeat` (timestamptz, nullable)
- `created_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)

### 3. `bot_events`
- Stores individual events in a bot's lifecycle (status changes, errors, etc.).
- `id` (uuid, PK, default gen_random_uuid())
- `bot_id` (uuid, FK to bots ON DELETE CASCADE)
- `event_type` (text, e.g. IN_CALL, CALL_ENDED, DONE, FATAL)
- `event_data` (jsonb, nullable, additional event context)
- `event_time` (timestamptz, default now)
- `created_at` (timestamptz, default now)

### 4. `transcripts`
- Stores transcripts and AI-generated summaries for completed recordings.
- `id` (uuid, PK, default gen_random_uuid())
- `bot_id` (uuid, FK to bots ON DELETE CASCADE)
- `content` (text, full transcript text)
- `summary` (text, nullable, AI-generated summary)
- `created_at` (timestamptz, default now)

## Security (RLS)
- RLS enabled on all tables.
- `profiles`: users can SELECT and UPDATE only their own row.
- `bots`: owner-scoped CRUD (auth.uid() = user_id) with DEFAULT auth.uid() on insert.
- `bot_events`: owner-scoped via EXISTS check against bots table.
- `transcripts`: owner-scoped via EXISTS check against bots table.

## Important Notes
1. The `user_id` column on `bots` defaults to `auth.uid()` so frontend inserts
   that omit `user_id` still satisfy the INSERT policy's WITH CHECK.
2. `bot_events` and `transcripts` do not have their own `user_id` — access is
   scoped through the parent `bots` table via an EXISTS subquery.
3. An `updated_at` trigger is included for the `bots` table.
*/

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 2. BOTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_url text,
  platform text,
  meeting_title text,
  meeting_info jsonb,
  status text NOT NULL DEFAULT 'READY_TO_DEPLOY',
  recording_url text,
  scheduled_at timestamptz,
  started_at timestamptz,
  youtube_video_id text,
  youtube_upload_status text,
  last_heartbeat timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE bots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bots" ON bots;
CREATE POLICY "select_own_bots" ON bots FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bots" ON bots;
CREATE POLICY "insert_own_bots" ON bots FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_bots" ON bots;
CREATE POLICY "update_own_bots" ON bots FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bots" ON bots;
CREATE POLICY "delete_own_bots" ON bots FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id);
CREATE INDEX IF NOT EXISTS idx_bots_status ON bots(status);
CREATE INDEX IF NOT EXISTS idx_bots_scheduled_at ON bots(scheduled_at);

-- updated_at trigger for bots
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bots_updated_at ON bots;
CREATE TRIGGER bots_updated_at BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. BOT_EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS bot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb,
  event_time timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE bot_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bot_events" ON bot_events;
CREATE POLICY "select_own_bot_events" ON bot_events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_events.bot_id AND bots.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_bot_events" ON bot_events;
CREATE POLICY "insert_own_bot_events" ON bot_events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_events.bot_id AND bots.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_bot_events" ON bot_events;
CREATE POLICY "delete_own_bot_events" ON bot_events FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = bot_events.bot_id AND bots.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_bot_events_bot_id ON bot_events(bot_id);

-- ============================================================================
-- 4. TRANSCRIPTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  content text NOT NULL,
  summary text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_transcripts" ON transcripts;
CREATE POLICY "select_own_transcripts" ON transcripts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = transcripts.bot_id AND bots.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_transcripts" ON transcripts;
CREATE POLICY "insert_own_transcripts" ON transcripts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = transcripts.bot_id AND bots.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_transcripts" ON transcripts;
CREATE POLICY "update_own_transcripts" ON transcripts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = transcripts.bot_id AND bots.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = transcripts.bot_id AND bots.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_transcripts" ON transcripts;
CREATE POLICY "delete_own_transcripts" ON transcripts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM bots WHERE bots.id = transcripts.bot_id AND bots.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_transcripts_bot_id ON transcripts(bot_id);

-- ============================================================================
-- 5. AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();