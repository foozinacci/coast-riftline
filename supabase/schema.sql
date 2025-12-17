-- RIFTLINE Database Schema
-- Online multiplayer with lobbies, matchmaking, and player profiles

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== PROFILES ====================
-- This table stores player profiles and is linked to auth.users

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
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

CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ==================== LOBBIES ====================

CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL,
  structure TEXT DEFAULT 'single_match',
  is_private BOOLEAN DEFAULT false,
  is_ranked BOOLEAN DEFAULT false,
  max_players INTEGER DEFAULT 30,
  current_players INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'starting', 'in_progress', 'finished')),
  code TEXT,
  game_seed TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Index for quick code lookups
CREATE INDEX IF NOT EXISTS lobbies_code_idx ON lobbies(code) WHERE code IS NOT NULL;

-- Enable RLS for lobbies
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lobbies are viewable by everyone" ON lobbies
  FOR SELECT USING (true);

CREATE POLICY "Users can create lobbies" ON lobbies
  FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Hosts can update their lobbies" ON lobbies
  FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Hosts can delete their lobbies" ON lobbies
  FOR DELETE USING (auth.uid() = host_id);

-- ==================== LOBBY PLAYERS ====================

CREATE TABLE IF NOT EXISTS lobby_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  team_id TEXT,
  squad_slot INTEGER,
  is_ready BOOLEAN DEFAULT false,
  is_host BOOLEAN DEFAULT false,
  selected_class TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lobby_id, player_id)
);

-- Enable RLS for lobby_players
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lobby players viewable by everyone" ON lobby_players
  FOR SELECT USING (true);

CREATE POLICY "Users can join lobbies" ON lobby_players
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their own status" ON lobby_players
  FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Users can leave lobbies" ON lobby_players
  FOR DELETE USING (auth.uid() = player_id);

-- ==================== MATCHMAKING ====================

CREATE TABLE IF NOT EXISTS matchmaking_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL,
  rank INTEGER DEFAULT 1000,
  region TEXT,
  status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'cancelled')),
  lobby_id UUID REFERENCES lobbies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  matched_at TIMESTAMPTZ
);

-- Index for finding players to match
CREATE INDEX IF NOT EXISTS matchmaking_searching_idx ON matchmaking_tickets(mode, rank, status) 
  WHERE status = 'searching';

-- Enable RLS for matchmaking
ALTER TABLE matchmaking_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their tickets" ON matchmaking_tickets
  FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Users can create tickets" ON matchmaking_tickets
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their tickets" ON matchmaking_tickets
  FOR UPDATE USING (auth.uid() = player_id);

-- ==================== MATCH HISTORY ====================

CREATE TABLE IF NOT EXISTS match_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID REFERENCES lobbies(id) ON DELETE SET NULL,
  mode TEXT NOT NULL,
  is_ranked BOOLEAN DEFAULT false,
  winner_team_id TEXT,
  total_players INTEGER,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES match_history(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  team_id TEXT,
  placement INTEGER,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  relics_planted INTEGER DEFAULT 0,
  rank_change INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for match history
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match history viewable by everyone" ON match_history
  FOR SELECT USING (true);

CREATE POLICY "Match players viewable by everyone" ON match_players
  FOR SELECT USING (true);

-- ==================== REALTIME ====================

-- Enable realtime for lobby tables (run separately if needed)
-- ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
-- ALTER PUBLICATION supabase_realtime ADD TABLE lobby_players;
-- ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking_tickets;

-- ==================== TRIGGER FOR AUTO PROFILE CREATION ====================
-- This creates a profile automatically when a new user signs up

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

-- Trigger to auto-create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
