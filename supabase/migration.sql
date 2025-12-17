-- RIFTLINE Migration: Add profiles and lobby system
-- Run this if you already have the old schema

-- ==================== PROFILES ====================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  rank INTEGER DEFAULT 1000,
  total_matches INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  relics_planted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ==================== AUTO PROFILE CREATION TRIGGER ====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    new.id,
    'Player_' || substr(new.id::text, 1, 8),
    'Recruit'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==================== LOBBIES (skip if exists) ====================
CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL,
  structure TEXT DEFAULT 'single_match',
  is_private BOOLEAN DEFAULT false,
  is_ranked BOOLEAN DEFAULT false,
  max_players INTEGER DEFAULT 30,
  current_players INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting',
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lobbies are viewable by everyone" ON lobbies;
CREATE POLICY "Lobbies are viewable by everyone" ON lobbies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can create lobbies" ON lobbies;
CREATE POLICY "Users can create lobbies" ON lobbies FOR INSERT WITH CHECK (auth.uid() = host_id);

-- ==================== LOBBY PLAYERS ====================
CREATE TABLE IF NOT EXISTS lobby_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_ready BOOLEAN DEFAULT false,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lobby_id, player_id)
);

ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lobby players viewable" ON lobby_players;
CREATE POLICY "Lobby players viewable" ON lobby_players FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can join lobbies" ON lobby_players;
CREATE POLICY "Users can join lobbies" ON lobby_players FOR INSERT WITH CHECK (auth.uid() = player_id);
