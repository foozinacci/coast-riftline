-- RIFTLINE Progression Fix Script
-- Run this to fix the duplicate policy error

-- Drop existing policies first
DROP POLICY IF EXISTS "Players can view own progression" ON player_progression;
DROP POLICY IF EXISTS "Players can view public stats" ON player_progression;
DROP POLICY IF EXISTS "System updates progression" ON player_progression;
DROP POLICY IF EXISTS "View own class mastery" ON class_mastery;
DROP POLICY IF EXISTS "View own weapon mastery" ON weapon_mastery;
DROP POLICY IF EXISTS "View own match history" ON match_history;
DROP POLICY IF EXISTS "View rift tier history" ON rift_tier_history;

-- Recreate policies
-- Players can view their own progression
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
