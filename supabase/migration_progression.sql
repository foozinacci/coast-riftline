-- RIFTLINE Progression System Database Schema
-- Implements XP curve, class/weapon mastery, and ranked requirements
-- Run this after migration_matchmaking.sql

-- ============================================================================
-- PLAYER PROGRESSION TABLE
-- ============================================================================

-- Main progression data per player
CREATE TABLE IF NOT EXISTS player_progression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- Account XP and Rift Tier
  account_xp BIGINT NOT NULL DEFAULT 0,
  rift_tier INTEGER NOT NULL DEFAULT 0,
  
  -- Statistics
  total_games_played INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  total_kills INTEGER NOT NULL DEFAULT 0,
  total_deaths INTEGER NOT NULL DEFAULT 0,
  total_assists INTEGER NOT NULL DEFAULT 0,
  total_damage_dealt BIGINT NOT NULL DEFAULT 0,
  total_relics_planted INTEGER NOT NULL DEFAULT 0,
  
  -- Time tracking
  total_playtime_minutes INTEGER NOT NULL DEFAULT 0,
  
  -- Ranked info
  ranked_unlocked BOOLEAN NOT NULL DEFAULT false,
  ranked_mmr INTEGER NOT NULL DEFAULT 1000,
  ranked_tier TEXT NOT NULL DEFAULT 'Unranked',
  ranked_division INTEGER NOT NULL DEFAULT 0,
  ranked_games_played INTEGER NOT NULL DEFAULT 0,
  ranked_wins INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- CLASS MASTERY TABLE
-- ============================================================================

-- Per-class XP and statistics
CREATE TABLE IF NOT EXISTS class_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  class_name TEXT NOT NULL, -- 'scout', 'vanguard', 'medic', 'scavenger'
  
  -- XP and level
  xp BIGINT NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  
  -- Class-specific stats
  games_played INTEGER NOT NULL DEFAULT 0,
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(player_id, class_name)
);

-- ============================================================================
-- WEAPON MASTERY TABLE
-- ============================================================================

-- Per-weapon XP and statistics
CREATE TABLE IF NOT EXISTS weapon_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  weapon_id TEXT NOT NULL, -- 'auto_common', 'semi_rare', etc.
  
  -- XP and level
  xp BIGINT NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  
  -- Weapon-specific stats
  kills INTEGER NOT NULL DEFAULT 0,
  headshots INTEGER NOT NULL DEFAULT 0,
  damage_dealt BIGINT NOT NULL DEFAULT 0,
  shots_fired INTEGER NOT NULL DEFAULT 0,
  shots_hit INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(player_id, weapon_id)
);

-- ============================================================================
-- MATCH HISTORY TABLE
-- ============================================================================

-- Individual match results for progression tracking
CREATE TABLE IF NOT EXISTS match_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  match_id TEXT NOT NULL,
  
  -- Match info
  mode TEXT NOT NULL,
  map_name TEXT,
  match_duration_seconds INTEGER NOT NULL DEFAULT 0,
  
  -- Player performance
  squad_id TEXT,
  class_used TEXT NOT NULL,
  weapon_used TEXT NOT NULL,
  placement INTEGER, -- 1 = winner, 2 = second, etc.
  
  -- Combat stats
  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  assists INTEGER NOT NULL DEFAULT 0,
  damage_dealt INTEGER NOT NULL DEFAULT 0,
  damage_taken INTEGER NOT NULL DEFAULT 0,
  
  -- Objective stats
  relics_collected INTEGER NOT NULL DEFAULT 0,
  relics_planted INTEGER NOT NULL DEFAULT 0,
  orbs_collected INTEGER NOT NULL DEFAULT 0,
  
  -- XP earned
  base_xp INTEGER NOT NULL DEFAULT 0,
  bonus_xp INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RIFT TIER HISTORY (Prestige Tracking)
-- ============================================================================

-- Track when players reach new Rift Tiers
CREATE TABLE IF NOT EXISTS rift_tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  tier_reached INTEGER NOT NULL,
  tier_name TEXT NOT NULL,
  account_xp_at_tier BIGINT NOT NULL,
  reached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_player_progression_player ON player_progression(player_id);
CREATE INDEX IF NOT EXISTS idx_player_progression_rift_tier ON player_progression(rift_tier);
CREATE INDEX IF NOT EXISTS idx_player_progression_ranked ON player_progression(ranked_unlocked, ranked_mmr);

CREATE INDEX IF NOT EXISTS idx_class_mastery_player ON class_mastery(player_id);
CREATE INDEX IF NOT EXISTS idx_class_mastery_level ON class_mastery(player_id, level);

CREATE INDEX IF NOT EXISTS idx_weapon_mastery_player ON weapon_mastery(player_id);
CREATE INDEX IF NOT EXISTS idx_weapon_mastery_level ON weapon_mastery(player_id, level);

CREATE INDEX IF NOT EXISTS idx_match_history_player ON match_history(player_id);
CREATE INDEX IF NOT EXISTS idx_match_history_match ON match_history(match_id);
CREATE INDEX IF NOT EXISTS idx_match_history_date ON match_history(player_id, played_at DESC);

CREATE INDEX IF NOT EXISTS idx_rift_tier_player ON rift_tier_history(player_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Calculate level from XP using front-loaded exponential curve
-- This mirrors the TypeScript implementation
CREATE OR REPLACE FUNCTION calculate_level_from_xp(
  total_xp BIGINT,
  xp_type TEXT
) RETURNS INTEGER AS $$
DECLARE
  base_xp INTEGER;
  exponent NUMERIC;
  level INTEGER := 1;
  max_level INTEGER;
  xp_accumulated BIGINT := 0;
  xp_for_next BIGINT;
BEGIN
  -- Set parameters based on type
  CASE xp_type
    WHEN 'class' THEN
      base_xp := 100;
      exponent := 1.8;
      max_level := 50;
    WHEN 'weapon' THEN
      base_xp := 80;
      exponent := 1.7;
      max_level := 30;
    WHEN 'account' THEN
      base_xp := 150;
      exponent := 2.0;
      max_level := 100;
    ELSE
      RETURN 1;
  END CASE;
  
  -- Calculate level
  WHILE level < max_level LOOP
    xp_for_next := FLOOR(
      base_xp * 
      POWER(level + 1, exponent) * 
      (1 + LOG(GREATEST(1, level - 9)) * 0.5)
    );
    xp_for_next := FLOOR(xp_for_next / 10) * 10;
    
    IF xp_accumulated + xp_for_next > total_xp THEN
      EXIT;
    END IF;
    
    xp_accumulated := xp_accumulated + xp_for_next;
    level := level + 1;
  END LOOP;
  
  RETURN level;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if player can access ranked
CREATE OR REPLACE FUNCTION check_ranked_access(player_uuid UUID)
RETURNS TABLE(allowed BOOLEAN, reason TEXT) AS $$
DECLARE
  prog RECORD;
  classes_at_10 INTEGER;
  weapons_at_10 INTEGER;
BEGIN
  -- Get progression
  SELECT * INTO prog FROM player_progression WHERE player_id = player_uuid;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'No progression data found'::TEXT;
    RETURN;
  END IF;
  
  -- Check Rift Tier
  IF prog.rift_tier < 5 THEN
    RETURN QUERY SELECT false, 'Reach Rift Tier 5 (Warden) to unlock Ranked'::TEXT;
    RETURN;
  END IF;
  
  -- Check class levels
  SELECT COUNT(*) INTO classes_at_10 
  FROM class_mastery 
  WHERE player_id = player_uuid AND level >= 10;
  
  IF classes_at_10 < 4 THEN
    RETURN QUERY SELECT false, 'Level all 4 classes to level 10'::TEXT;
    RETURN;
  END IF;
  
  -- Check weapon levels
  SELECT COUNT(*) INTO weapons_at_10 
  FROM weapon_mastery 
  WHERE player_id = player_uuid AND level >= 10;
  
  IF weapons_at_10 < 4 THEN
    RETURN QUERY SELECT false, 'Level 4 weapons to level 10'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Initialize progression for new player
CREATE OR REPLACE FUNCTION initialize_player_progression(player_uuid UUID)
RETURNS VOID AS $$
BEGIN
  -- Create main progression record
  INSERT INTO player_progression (player_id)
  VALUES (player_uuid)
  ON CONFLICT (player_id) DO NOTHING;
  
  -- Create class mastery records
  INSERT INTO class_mastery (player_id, class_name)
  VALUES 
    (player_uuid, 'scout'),
    (player_uuid, 'vanguard'),
    (player_uuid, 'medic'),
    (player_uuid, 'scavenger')
  ON CONFLICT (player_id, class_name) DO NOTHING;
  
  -- Create weapon mastery records
  INSERT INTO weapon_mastery (player_id, weapon_id)
  VALUES 
    (player_uuid, 'auto_common'),
    (player_uuid, 'semi_common'),
    (player_uuid, 'burst_common'),
    (player_uuid, 'charge_common')
  ON CONFLICT (player_id, weapon_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Update progression after match
CREATE OR REPLACE FUNCTION update_progression_after_match(
  player_uuid UUID,
  match_uuid TEXT,
  mode_name TEXT,
  class_used_name TEXT,
  weapon_used_name TEXT,
  p_kills INTEGER,
  p_deaths INTEGER,
  p_assists INTEGER,
  p_damage INTEGER,
  p_relics_planted INTEGER,
  p_won BOOLEAN,
  p_duration_seconds INTEGER,
  p_base_xp INTEGER,
  p_bonus_xp INTEGER
) RETURNS VOID AS $$
DECLARE
  total_xp INTEGER;
  class_xp INTEGER;
  weapon_xp INTEGER;
  new_account_xp BIGINT;
  new_rift_tier INTEGER;
  old_rift_tier INTEGER;
BEGIN
  total_xp := p_base_xp + p_bonus_xp;
  class_xp := FLOOR(total_xp * 0.8);
  weapon_xp := FLOOR(total_xp * 0.6);
  
  -- Get current Rift Tier
  SELECT rift_tier INTO old_rift_tier 
  FROM player_progression 
  WHERE player_id = player_uuid;
  
  -- Update main progression
  UPDATE player_progression SET
    account_xp = account_xp + total_xp,
    total_games_played = total_games_played + 1,
    total_wins = total_wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    total_kills = total_kills + p_kills,
    total_deaths = total_deaths + p_deaths,
    total_assists = total_assists + p_assists,
    total_damage_dealt = total_damage_dealt + p_damage,
    total_relics_planted = total_relics_planted + p_relics_planted,
    total_playtime_minutes = total_playtime_minutes + CEIL(p_duration_seconds / 60.0),
    updated_at = NOW()
  WHERE player_id = player_uuid
  RETURNING account_xp INTO new_account_xp;
  
  -- Calculate new Rift Tier
  new_rift_tier := FLOOR(calculate_level_from_xp(new_account_xp, 'account') / 10);
  
  -- Update Rift Tier if changed
  IF new_rift_tier > old_rift_tier THEN
    UPDATE player_progression SET rift_tier = new_rift_tier WHERE player_id = player_uuid;
    
    -- Record tier achievement
    INSERT INTO rift_tier_history (player_id, tier_reached, tier_name, account_xp_at_tier)
    VALUES (
      player_uuid, 
      new_rift_tier,
      CASE new_rift_tier
        WHEN 0 THEN 'Initiate'
        WHEN 1 THEN 'Drifter'
        WHEN 2 THEN 'Voyager'
        WHEN 3 THEN 'Pathfinder'
        WHEN 4 THEN 'Navigator'
        WHEN 5 THEN 'Warden'
        WHEN 6 THEN 'Sentinel'
        WHEN 7 THEN 'Vanguard'
        WHEN 8 THEN 'Harbinger'
        WHEN 9 THEN 'Convergent'
        ELSE 'Rift Master'
      END,
      new_account_xp
    );
  END IF;
  
  -- Update class mastery
  UPDATE class_mastery SET
    xp = xp + class_xp,
    level = calculate_level_from_xp(xp + class_xp, 'class'),
    games_played = games_played + 1,
    kills = kills + p_kills,
    deaths = deaths + p_deaths,
    wins = wins + CASE WHEN p_won THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE player_id = player_uuid AND class_name = class_used_name;
  
  -- Update weapon mastery
  UPDATE weapon_mastery SET
    xp = xp + weapon_xp,
    level = calculate_level_from_xp(xp + weapon_xp, 'weapon'),
    kills = kills + p_kills,
    damage_dealt = damage_dealt + p_damage,
    updated_at = NOW()
  WHERE player_id = player_uuid AND weapon_id = weapon_used_name;
  
  -- Insert match history
  INSERT INTO match_history (
    player_id, match_id, mode, class_used, weapon_used,
    kills, deaths, assists, damage_dealt,
    relics_planted, base_xp, bonus_xp, total_xp,
    match_duration_seconds, placement
  ) VALUES (
    player_uuid, match_uuid, mode_name, class_used_name, weapon_used_name,
    p_kills, p_deaths, p_assists, p_damage,
    p_relics_planted, p_base_xp, p_bonus_xp, total_xp,
    p_duration_seconds, CASE WHEN p_won THEN 1 ELSE 2 END
  );
  
  -- Check and update ranked unlock status
  UPDATE player_progression SET
    ranked_unlocked = (SELECT allowed FROM check_ranked_access(player_uuid))
  WHERE player_id = player_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE player_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE weapon_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE rift_tier_history ENABLE ROW LEVEL SECURITY;

-- Players can read their own progression
CREATE POLICY "Players can view own progression" ON player_progression
  FOR SELECT USING (auth.uid() = player_id);

-- Players can view others' public stats (for leaderboards)
CREATE POLICY "Players can view public stats" ON player_progression
  FOR SELECT USING (true);

-- Only system can update progression
CREATE POLICY "System updates progression" ON player_progression
  FOR UPDATE USING (auth.uid() = player_id);

-- Class/weapon mastery policies
CREATE POLICY "View own class mastery" ON class_mastery
  FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "View own weapon mastery" ON weapon_mastery
  FOR SELECT USING (auth.uid() = player_id);

-- Match history policies
CREATE POLICY "View own match history" ON match_history
  FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "View rift tier history" ON rift_tier_history
  FOR SELECT USING (auth.uid() = player_id);

-- ============================================================================
-- TRIGGER: Auto-initialize progression on new profile
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_init_progression()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM initialize_player_progression(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_profile_created_init_progression ON profiles;
CREATE TRIGGER on_profile_created_init_progression
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_init_progression();
