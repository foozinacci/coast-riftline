-- Riftline Supabase Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Player profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    rank INTEGER DEFAULT 1000,
    friend_code TEXT UNIQUE DEFAULT UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 6)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game lobbies table
CREATE TABLE IF NOT EXISTS lobbies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    mode TEXT DEFAULT 'MAIN',
    structure TEXT DEFAULT 'BEST_OF_3',
    is_private BOOLEAN DEFAULT FALSE,
    is_ranked BOOLEAN DEFAULT FALSE,
    max_players INTEGER DEFAULT 6,
    current_players INTEGER DEFAULT 0,
    status TEXT DEFAULT 'waiting',
    code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to lobbies if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'host_id') THEN
        ALTER TABLE lobbies ADD COLUMN host_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'mode') THEN
        ALTER TABLE lobbies ADD COLUMN mode TEXT DEFAULT 'MAIN';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'structure') THEN
        ALTER TABLE lobbies ADD COLUMN structure TEXT DEFAULT 'BEST_OF_3';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'is_private') THEN
        ALTER TABLE lobbies ADD COLUMN is_private BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'is_ranked') THEN
        ALTER TABLE lobbies ADD COLUMN is_ranked BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'max_players') THEN
        ALTER TABLE lobbies ADD COLUMN max_players INTEGER DEFAULT 6;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'current_players') THEN
        ALTER TABLE lobbies ADD COLUMN current_players INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'status') THEN
        ALTER TABLE lobbies ADD COLUMN status TEXT DEFAULT 'waiting';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'code') THEN
        ALTER TABLE lobbies ADD COLUMN code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'created_at') THEN
        ALTER TABLE lobbies ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lobbies' AND column_name = 'updated_at') THEN
        ALTER TABLE lobbies ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Lobby players (join table)
CREATE TABLE IF NOT EXISTS lobby_players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    team_id TEXT,
    is_ready BOOLEAN DEFAULT FALSE,
    is_host BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lobby_id, player_id)
);

-- Matchmaking tickets
CREATE TABLE IF NOT EXISTS matchmaking_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    mode TEXT NOT NULL,
    rank INTEGER,
    region TEXT,
    status TEXT DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'cancelled')),
    matched_lobby_id UUID REFERENCES lobbies(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Friends table
CREATE TABLE IF NOT EXISTS friends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to friends
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'friends' AND column_name = 'user_id') THEN
        ALTER TABLE friends ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'friends' AND column_name = 'friend_id') THEN
        ALTER TABLE friends ADD COLUMN friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'friends' AND column_name = 'status') THEN
        ALTER TABLE friends ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Parties table (for grouping before matchmaking)
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    leader_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to parties
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parties' AND column_name = 'leader_id') THEN
        ALTER TABLE parties ADD COLUMN leader_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'parties' AND column_name = 'code') THEN
        ALTER TABLE parties ADD COLUMN code TEXT;
    END IF;
END $$;

-- Party members
CREATE TABLE IF NOT EXISTS party_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
    player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    is_ready BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to party_members
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'party_members' AND column_name = 'party_id') THEN
        ALTER TABLE party_members ADD COLUMN party_id UUID REFERENCES parties(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'party_members' AND column_name = 'player_id') THEN
        ALTER TABLE party_members ADD COLUMN player_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'party_members' AND column_name = 'is_ready') THEN
        ALTER TABLE party_members ADD COLUMN is_ready BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (makes script idempotent)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Lobbies are viewable by everyone" ON lobbies;
DROP POLICY IF EXISTS "Users can create lobbies" ON lobbies;
DROP POLICY IF EXISTS "Host can update lobby" ON lobbies;
DROP POLICY IF EXISTS "Host can delete lobby" ON lobbies;
DROP POLICY IF EXISTS "Lobby players viewable" ON lobby_players;
DROP POLICY IF EXISTS "Players can join lobbies" ON lobby_players;
DROP POLICY IF EXISTS "Players can update own status" ON lobby_players;
DROP POLICY IF EXISTS "Players can leave lobbies" ON lobby_players;
DROP POLICY IF EXISTS "Users can read own tickets" ON matchmaking_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON matchmaking_tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON matchmaking_tickets;
DROP POLICY IF EXISTS "Users can delete own tickets" ON matchmaking_tickets;
DROP POLICY IF EXISTS "Users can see own friends" ON friends;
DROP POLICY IF EXISTS "Users can add friends" ON friends;
DROP POLICY IF EXISTS "Users can update friend status" ON friends;
DROP POLICY IF EXISTS "Users can remove friends" ON friends;
DROP POLICY IF EXISTS "Parties viewable by members" ON parties;
DROP POLICY IF EXISTS "Users can create parties" ON parties;
DROP POLICY IF EXISTS "Leader can update party" ON parties;
DROP POLICY IF EXISTS "Leader can delete party" ON parties;
DROP POLICY IF EXISTS "Party members viewable" ON party_members;
DROP POLICY IF EXISTS "Users can join parties" ON party_members;
DROP POLICY IF EXISTS "Users can update own party status" ON party_members;
DROP POLICY IF EXISTS "Users can leave parties" ON party_members;

-- Profiles: Users can read all profiles, update their own
CREATE POLICY "Public profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Lobbies: Anyone can read, host can update
CREATE POLICY "Lobbies are viewable by everyone" ON lobbies
    FOR SELECT USING (true);

CREATE POLICY "Users can create lobbies" ON lobbies
    FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update lobby" ON lobbies
    FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Host can delete lobby" ON lobbies
    FOR DELETE USING (auth.uid() = host_id);

-- Lobby players: Anyone can read, players can manage own
CREATE POLICY "Lobby players viewable" ON lobby_players
    FOR SELECT USING (true);

CREATE POLICY "Players can join lobbies" ON lobby_players
    FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Players can update own status" ON lobby_players
    FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Players can leave lobbies" ON lobby_players
    FOR DELETE USING (auth.uid() = player_id);

-- Matchmaking: Users can manage own tickets
CREATE POLICY "Users can read own tickets" ON matchmaking_tickets
    FOR SELECT USING (auth.uid() = player_id);

CREATE POLICY "Users can create tickets" ON matchmaking_tickets
    FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update own tickets" ON matchmaking_tickets
    FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Users can delete own tickets" ON matchmaking_tickets
    FOR DELETE USING (auth.uid() = player_id);

-- Friends: Users can manage own friendships
CREATE POLICY "Users can see own friends" ON friends
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can add friends" ON friends
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update friend status" ON friends
    FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can remove friends" ON friends
    FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- Parties: Party management
CREATE POLICY "Parties viewable by members" ON parties
    FOR SELECT USING (true);

CREATE POLICY "Users can create parties" ON parties
    FOR INSERT WITH CHECK (auth.uid() = leader_id);

CREATE POLICY "Leader can update party" ON parties
    FOR UPDATE USING (auth.uid() = leader_id);

CREATE POLICY "Leader can delete party" ON parties
    FOR DELETE USING (auth.uid() = leader_id);

-- Party members
CREATE POLICY "Party members viewable" ON party_members
    FOR SELECT USING (true);

CREATE POLICY "Users can join parties" ON party_members
    FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can update own party status" ON party_members
    FOR UPDATE USING (auth.uid() = player_id);

CREATE POLICY "Users can leave parties" ON party_members
    FOR DELETE USING (auth.uid() = player_id);

-- Realtime subscriptions (ignore if already added)
DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE lobbies;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE lobby_players;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE parties;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ 
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE party_members;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- NOTE: The trigger on auth.users for auto-creating profiles requires 
-- elevated permissions. Instead, profiles are created on first login via the app.
-- If you have superuser access, you can enable this in Database > Triggers.

-- Function to auto-create profile (used manually or via app)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, username, display_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'Player_' || SUBSTR(NEW.id::TEXT, 1, 8)),
        COALESCE(NEW.raw_user_meta_data->>'display_name', 'Player')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update lobby player count
CREATE OR REPLACE FUNCTION update_lobby_player_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE lobbies SET current_players = current_players + 1, updated_at = NOW()
        WHERE id = NEW.lobby_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE lobbies SET current_players = current_players - 1, updated_at = NOW()
        WHERE id = OLD.lobby_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for player count
DROP TRIGGER IF EXISTS on_lobby_player_change ON lobby_players;
CREATE TRIGGER on_lobby_player_change
    AFTER INSERT OR DELETE ON lobby_players
    FOR EACH ROW EXECUTE FUNCTION update_lobby_player_count();
