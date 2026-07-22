/*
# Add backend_bot_id column to bots table

1. Changes
- Adds `backend_bot_id` (integer) column to the `bots` table.
- This stores the bot ID returned by the external backend API (http://169.58.57.242:3000)
  so the frontend can bridge Supabase bot records with the backend's bot records.
- Nullable: set after the backend API creates the bot.
2. Security
- No RLS policy changes needed; existing policies already cover the new column.
*/

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS backend_bot_id integer;
