-- RIFTLINE Database Migration: Online Matchmaking Features
-- Run this migration AFTER the base schema.sql
-- Generated: 2025-12-17

-- =============================================================================
-- 1. FRIEND CODES
-- Static, shareable codes for each player
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS friend_code TEXT UNIQUE;

-- Generate friend codes for existing users (6 character alphanumeric)
-- Run this manually or in a function if needed:
-- UPDATE profiles SET friend_code = upper(substr(md5(random()::text), 1, 6)) WHERE friend_code IS NULL;

-- =============================================================================
-- 2. FRIENDS SYSTEM
-- Allows players to add friends for easy invites
-- =============================================================================

CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(player_id, friend_id),
  -- Prevent self-friending
  CHECK (player_id != friend_id)
);

-- Enable RLS for friends
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their friendships" ON friends
  FOR SELECT USING (auth.uid() = player_id OR auth.uid() = friend_id);

CREATE POLICY "Users can send friend requests" ON friends
  FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update their friendships" ON friends
  FOR UPDATE USING (auth.uid() = player_id OR auth.uid() = friend_id);

CREATE POLICY "Users can remove friendships" ON friends
  FOR DELETE USING (auth.uid() = player_id OR auth.uid() = friend_id);

-- Index for quick friend lookups
CREATE INDEX IF NOT EXISTS friends_player_idx ON friends(player_id);
CREATE INDEX IF NOT EXISTS friends_friend_idx ON friends(friend_id);

-- =============================================================================
-- 3. PARTY SYSTEM
-- Groups of players queueing together
-- =============================================================================

CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mode TEXT,  -- GameMode they're queueing for (null = not queueing)
  max_size INTEGER DEFAULT 3,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'queued', 'in_lobby', 'in_match')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_members (
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  is_leader BOOLEAN DEFAULT false,
  is_ready BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (party_id, player_id)
);

-- Enable RLS
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties are viewable by members" ON parties
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_members WHERE party_id = id AND player_id = auth.uid())
  );

CREATE POLICY "Leaders can update parties" ON parties
  FOR UPDATE USING (leader_id = auth.uid());

CREATE POLICY "Leaders can delete parties" ON parties
  FOR DELETE USING (leader_id = auth.uid());

CREATE POLICY "Users can create parties" ON parties
  FOR INSERT WITH CHECK (leader_id = auth.uid());

CREATE POLICY "Party members viewable by party members" ON party_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM party_members pm WHERE pm.party_id = party_members.party_id AND pm.player_id = auth.uid())
  );

CREATE POLICY "Users can join parties" ON party_members
  FOR INSERT WITH CHECK (player_id = auth.uid());

CREATE POLICY "Users can update their party status" ON party_members
  FOR UPDATE USING (player_id = auth.uid());

CREATE POLICY "Users can leave parties" ON party_members
  FOR DELETE USING (player_id = auth.uid());

-- =============================================================================
-- 4. PER-MODE STATS
-- Track SBMM stats separately for each game mode
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_mode_stats (
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  damage_dealt BIGINT DEFAULT 0,
  relics_planted INTEGER DEFAULT 0,
  skill_rating INTEGER DEFAULT 1000,
  skill_band TEXT DEFAULT 'bronze' CHECK (skill_band IN ('bronze', 'silver', 'gold', 'rift')),
  peak_rating INTEGER DEFAULT 1000,
  last_played TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (player_id, mode)
);

-- Enable RLS
ALTER TABLE player_mode_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mode stats viewable by everyone" ON player_mode_stats
  FOR SELECT USING (true);

CREATE POLICY "Stats updated by system only" ON player_mode_stats
  FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Stats can be created by system" ON player_mode_stats
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- =============================================================================
-- 5. LOBBY ENHANCEMENTS
-- Add lock and bot fill settings
-- =============================================================================

ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS bot_fill_enabled BOOLEAN DEFAULT true;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS min_players_to_start INTEGER DEFAULT 2;

-- =============================================================================
-- 6. MATCH SESSION BINDING
-- Track player sessions for reconnect support
-- =============================================================================

ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS reconnect_allowed BOOLEAN DEFAULT true;

-- =============================================================================
-- 7. MATCHMAKING IMPROVEMENTS
-- Better queue tracking
-- =============================================================================

ALTER TABLE matchmaking_tickets ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id) ON DELETE SET NULL;
ALTER TABLE matchmaking_tickets ADD COLUMN IF NOT EXISTS queue_started_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE matchmaking_tickets ADD COLUMN IF NOT EXISTS skill_band TEXT;

-- Index for skill-based matchmaking
CREATE INDEX IF NOT EXISTS matchmaking_skill_idx ON matchmaking_tickets(mode, skill_band, status) 
  WHERE status = 'searching';

-- =============================================================================
-- 8. ARENA ROUND TRACKING
-- For Best-of-X round-based arena modes
-- =============================================================================

CREATE TABLE IF NOT EXISTS arena_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lobby_id UUID REFERENCES lobbies(id) ON DELETE CASCADE NOT NULL,
  mode TEXT NOT NULL,
  structure TEXT DEFAULT 'best_of_3' CHECK (structure IN ('best_of_3', 'best_of_5')),
  current_round INTEGER DEFAULT 1,
  total_rounds INTEGER DEFAULT 3,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS arena_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  arena_match_id UUID REFERENCES arena_matches(id) ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL,
  winner_team_id TEXT,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS arena_team_scores (
  arena_match_id UUID REFERENCES arena_matches(id) ON DELETE CASCADE NOT NULL,
  team_id TEXT NOT NULL,
  round_wins INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  PRIMARY KEY (arena_match_id, team_id)
);

-- Enable RLS
ALTER TABLE arena_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_team_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arena matches viewable by everyone" ON arena_matches
  FOR SELECT USING (true);

CREATE POLICY "Arena rounds viewable by everyone" ON arena_rounds
  FOR SELECT USING (true);

CREATE POLICY "Arena scores viewable by everyone" ON arena_team_scores
  FOR SELECT USING (true);

-- =============================================================================
-- REALTIME SUBSCRIPTIONS
-- Enable realtime for new tables (run separately if needed)
-- =============================================================================

-- Uncomment and run in Supabase dashboard if realtime is needed:
-- ALTER PUBLICATION supabase_realtime ADD TABLE friends;
-- ALTER PUBLICATION supabase_realtime ADD TABLE parties;
-- ALTER PUBLICATION supabase_realtime ADD TABLE party_members;
-- ALTER PUBLICATION supabase_realtime ADD TABLE arena_matches;
-- ALTER PUBLICATION supabase_realtime ADD TABLE arena_rounds;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to generate friend code for new users
CREATE OR REPLACE FUNCTION generate_friend_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  attempts INTEGER := 0;
BEGIN
  LOOP
    code := upper(substr(md5(random()::text), 1, 6));
    -- Check if code exists
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE friend_code = code) THEN
      RETURN code;
    END IF;
    attempts := attempts + 1;
    IF attempts > 100 THEN
      -- Fallback to longer code
      code := upper(substr(md5(random()::text), 1, 8));
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to update skill band based on rating
CREATE OR REPLACE FUNCTION update_skill_band()
RETURNS TRIGGER AS $$
BEGIN
  NEW.skill_band := CASE
    WHEN NEW.skill_rating >= 2000 THEN 'rift'
    WHEN NEW.skill_rating >= 1500 THEN 'gold'
    WHEN NEW.skill_rating >= 1200 THEN 'silver'
    ELSE 'bronze'
  END;
  
  -- Update peak rating
  IF NEW.skill_rating > COALESCE(NEW.peak_rating, 0) THEN
    NEW.peak_rating := NEW.skill_rating;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_skill_band_trigger
  BEFORE INSERT OR UPDATE OF skill_rating ON player_mode_stats
  FOR EACH ROW EXECUTE FUNCTION update_skill_band();

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
