/*
  # Add Site Visitors Tracking
  
  1. New Tables
    - `site_visitors`
      - `id` (uuid, primary key) - Unique identifier
      - `visited_at` (timestamptz) - When the visit occurred
      - `session_id` (text) - Browser session identifier
      - `created_at` (timestamptz) - Record creation timestamp
  
  2. Changes
    - Add index on visited_at for efficient date queries
    - Add index on session_id for deduplication
  
  3. Security
    - Enable RLS on `site_visitors` table
    - Add policy for anonymous users to insert their visit records
    - Add policy for authenticated admins to read all visitor data
*/

-- Create site_visitors table
CREATE TABLE IF NOT EXISTS site_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visited_at timestamptz DEFAULT now() NOT NULL,
  session_id text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_site_visitors_visited_at ON site_visitors(visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_visitors_session_id ON site_visitors(session_id);

-- Enable RLS
ALTER TABLE site_visitors ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert visit records
CREATE POLICY "Anyone can track visits"
  ON site_visitors
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can read visitor data
CREATE POLICY "Authenticated users can read visitor data"
  ON site_visitors
  FOR SELECT
  TO authenticated
  USING (true);
