-- Quick fix for missing party columns
-- Run this in the Supabase SQL Editor

-- Add missing columns to parties table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parties' AND column_name = 'max_size') THEN
        ALTER TABLE parties ADD COLUMN max_size INTEGER DEFAULT 3;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parties' AND column_name = 'status') THEN
        ALTER TABLE parties ADD COLUMN status TEXT DEFAULT 'idle';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parties' AND column_name = 'mode') THEN
        ALTER TABLE parties ADD COLUMN mode TEXT;
    END IF;
END $$;

-- Add missing column to party_members
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'party_members' AND column_name = 'is_leader') THEN
        ALTER TABLE party_members ADD COLUMN is_leader BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Add missing column to matchmaking_tickets  
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matchmaking_tickets' AND column_name = 'party_id') THEN
        ALTER TABLE matchmaking_tickets ADD COLUMN party_id UUID;
    END IF;
END $$;

-- Add friend_code column to profiles if missing
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'friend_code') THEN
        ALTER TABLE profiles ADD COLUMN friend_code TEXT;
    END IF;
END $$;

-- Generate friend codes for existing profiles that don't have one
UPDATE profiles 
SET friend_code = UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6))
WHERE friend_code IS NULL;
