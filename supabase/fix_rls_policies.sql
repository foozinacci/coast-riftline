-- Fix RLS policy infinite recursion for party_members
-- Run this in Supabase SQL Editor

-- OPTION 1: Disable RLS entirely (quickest fix for development)
ALTER TABLE parties DISABLE ROW LEVEL SECURITY;
ALTER TABLE party_members DISABLE ROW LEVEL SECURITY;

-- Also fix the friend code for your existing profile
UPDATE profiles 
SET friend_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE friend_code IS NULL;

-- NOTE: For production, you'll want to re-enable RLS with proper policies.
-- The issue is that the policies were referencing each other in a loop.
