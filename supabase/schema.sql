-- RIFTLINE Database Schema
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/YOUR_PROJECT/sql)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  preferred_role TEXT DEFAULT 'skirmisher',
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_online TIMESTAMPTZ DEFAULT NOW(),
  is_online BOOLEAN DEFAULT FALSE
);

-- ============================================
-- PARTIES TABLE (groups of players queuing together)
-- ============================================
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT UNIQUE, -- 6-char join code
  max_size INTEGER DEFAULT 3,
  is_open BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARTY MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS party_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'skirmisher',
  is_ready BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(party_id, player_id)
);

-- ============================================
-- LOBBIES TABLE (pre-match waiting rooms)
-- ============================================
CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  shard TEXT DEFAULT 'na-east', -- Server region
  mode TEXT DEFAULT 'standard', -- standard, ranked, custom
  status TEXT DEFAULT 'waiting', -- waiting, starting, in_progress, ended
  max_teams INTEGER DEFAULT 20,
  current_teams INTEGER DEFAULT 0,
  match_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- ============================================
-- LOBBY TEAMS TABLE (teams in a lobby)
-- ============================================
CREATE TABLE IF NOT EXISTS lobby_teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE,
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  team_slot INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lobby_id, party_id),
  UNIQUE(lobby_id, team_slot)
);

-- ============================================
-- FRIEND REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, accepted, declined
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_player_id, to_player_id)
);

-- ============================================
-- FRIENDS TABLE (accepted friendships)
-- ============================================
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, friend_id)
);

-- ============================================
-- PARTY INVITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS party_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  from_player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, accepted, declined, expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '5 minutes'
);

-- ============================================
-- MATCHES TABLE (completed/in-progress matches)
-- ============================================
CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID REFERENCES lobbies(id),
  shard TEXT,
  mode TEXT,
  status TEXT DEFAULT 'in_progress', -- in_progress, completed, cancelled
  winner_team_id UUID,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  match_data JSONB -- Full match replay/stats data
);

-- ============================================
-- MATCH PLAYERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS match_players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  team_id UUID,
  role TEXT,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  orbs_collected INTEGER DEFAULT 0,
  relics_delivered INTEGER DEFAULT 0,
  placement INTEGER,
  xp_earned INTEGER DEFAULT 0
);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Parties: Members can view their party
CREATE POLICY "Party members can view party" ON parties FOR SELECT USING (
  id IN (SELECT party_id FROM party_members WHERE player_id = auth.uid())
  OR leader_id = auth.uid()
);
CREATE POLICY "Users can create parties" ON parties FOR INSERT WITH CHECK (leader_id = auth.uid());
CREATE POLICY "Leaders can update party" ON parties FOR UPDATE USING (leader_id = auth.uid());
CREATE POLICY "Leaders can delete party" ON parties FOR DELETE USING (leader_id = auth.uid());

-- Party members: viewable by party members
CREATE POLICY "Party members viewable by members" ON party_members FOR SELECT USING (
  party_id IN (SELECT party_id FROM party_members WHERE player_id = auth.uid())
);
CREATE POLICY "Users can join parties" ON party_members FOR INSERT WITH CHECK (player_id = auth.uid());
CREATE POLICY "Users can leave parties" ON party_members FOR DELETE USING (player_id = auth.uid());
CREATE POLICY "Users can update own membership" ON party_members FOR UPDATE USING (player_id = auth.uid());

-- Lobbies: public read
CREATE POLICY "Lobbies are viewable by everyone" ON lobbies FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create lobbies" ON lobbies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Lobby teams: public read
CREATE POLICY "Lobby teams viewable by everyone" ON lobby_teams FOR SELECT USING (true);
CREATE POLICY "Party leaders can join lobbies" ON lobby_teams FOR INSERT WITH CHECK (
  party_id IN (SELECT id FROM parties WHERE leader_id = auth.uid())
);

-- Friends: users can see their own friends
CREATE POLICY "Users can view own friends" ON friends FOR SELECT USING (
  player_id = auth.uid() OR friend_id = auth.uid()
);
CREATE POLICY "Users can add friends" ON friends FOR INSERT WITH CHECK (player_id = auth.uid());
CREATE POLICY "Users can remove friends" ON friends FOR DELETE USING (player_id = auth.uid());

-- Friend requests: users can see requests to/from them
CREATE POLICY "Users can view own friend requests" ON friend_requests FOR SELECT USING (
  from_player_id = auth.uid() OR to_player_id = auth.uid()
);
CREATE POLICY "Users can send friend requests" ON friend_requests FOR INSERT WITH CHECK (from_player_id = auth.uid());
CREATE POLICY "Users can update requests to them" ON friend_requests FOR UPDATE USING (to_player_id = auth.uid());

-- Party invites: users can see invites to/from them
CREATE POLICY "Users can view own party invites" ON party_invites FOR SELECT USING (
  from_player_id = auth.uid() OR to_player_id = auth.uid()
);
CREATE POLICY "Users can send party invites" ON party_invites FOR INSERT WITH CHECK (from_player_id = auth.uid());
CREATE POLICY "Users can respond to invites" ON party_invites FOR UPDATE USING (to_player_id = auth.uid());

-- Matches: public read
CREATE POLICY "Matches are viewable by everyone" ON matches FOR SELECT USING (true);

-- Match players: public read
CREATE POLICY "Match players viewable by everyone" ON match_players FOR SELECT USING (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate party codes
CREATE OR REPLACE FUNCTION generate_party_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate party code
CREATE OR REPLACE FUNCTION set_party_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := generate_party_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER party_code_trigger
  BEFORE INSERT ON parties
  FOR EACH ROW
  EXECUTE FUNCTION set_party_code();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'Player_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'New Player')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Function to update profile timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================
-- Enable realtime for key tables

ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE lobby_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE parties;
ALTER PUBLICATION supabase_realtime ADD TABLE party_members;
ALTER PUBLICATION supabase_realtime ADD TABLE party_invites;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_online ON profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_parties_code ON parties(code);
CREATE INDEX IF NOT EXISTS idx_party_members_party ON party_members(party_id);
CREATE INDEX IF NOT EXISTS idx_party_members_player ON party_members(player_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_lobbies_shard ON lobbies(shard);
CREATE INDEX IF NOT EXISTS idx_lobby_teams_lobby ON lobby_teams(lobby_id);
CREATE INDEX IF NOT EXISTS idx_friends_player ON friends(player_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match ON match_players(match_id);
CREATE INDEX IF NOT EXISTS idx_match_players_player ON match_players(player_id);
