import { getSupabase } from './supabase';
import { storage } from './storage';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  preferred_role: string;
  level: number;
  is_online: boolean;
}

export interface Party {
  id: string;
  leader_id: string;
  code: string;
  max_size: number;
  is_open: boolean;
  members?: PartyMember[];
}

export interface PartyMember {
  id: string;
  party_id: string;
  player_id: string;
  role: string;
  is_ready: boolean;
  profile?: Profile;
}

export interface Lobby {
  id: string;
  name: string;
  shard: string;
  mode: string;
  status: string;
  max_teams: number;
  current_teams: number;
  match_id?: string;
}

export interface PartyInvite {
  id: string;
  party_id: string;
  from_player_id: string;
  to_player_id: string;
  status: string;
  from_profile?: Profile;
}

export type Shard = 'na-east' | 'na-west' | 'eu-west' | 'eu-east' | 'asia' | 'oceania';

export const SHARDS: { id: Shard; name: string; ping?: number }[] = [
  { id: 'na-east', name: 'NA East' },
  { id: 'na-west', name: 'NA West' },
  { id: 'eu-west', name: 'EU West' },
  { id: 'eu-east', name: 'EU East' },
  { id: 'asia', name: 'Asia' },
  { id: 'oceania', name: 'Oceania' },
];

class LobbyManager {
  private currentParty: Party | null = null;
  private currentLobby: Lobby | null = null;
  private profile: Profile | null = null;
  private partyChannel: RealtimeChannel | null = null;
  private lobbyChannel: RealtimeChannel | null = null;
  private invitesChannel: RealtimeChannel | null = null;

  private onPartyUpdate: ((party: Party | null) => void) | null = null;
  private onLobbyUpdate: ((lobby: Lobby | null) => void) | null = null;
  private onInviteReceived: ((invite: PartyInvite) => void) | null = null;
  private onMatchStart: ((matchId: string) => void) | null = null;

  // Get current user profile
  async getProfile(): Promise<Profile | null> {
    const supabase = getSupabase();
    if (!supabase) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }

    this.profile = data;
    return data;
  }

  // Update profile
  async updateProfile(updates: Partial<Profile>): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !this.profile) return false;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', this.profile.id);

    if (error) {
      console.error('Error updating profile:', error);
      return false;
    }

    this.profile = { ...this.profile, ...updates };
    return true;
  }

  // Create a new party (or get existing one)
  async createParty(): Promise<Party | null> {
    const supabase = getSupabase();
    if (!supabase || !this.profile) return null;

    // Check if already in a party
    const existingParty = await this.getCurrentParty();
    if (existingParty) return existingParty;

    // Create new party
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .insert({ leader_id: this.profile.id })
      .select()
      .single();

    if (partyError) {
      console.error('Error creating party:', partyError);
      return null;
    }

    // Add self as member
    const { error: memberError } = await supabase
      .from('party_members')
      .insert({
        party_id: party.id,
        player_id: this.profile.id,
        role: this.profile.preferred_role,
        is_ready: false,
      });

    if (memberError) {
      console.error('Error joining party:', memberError);
      return null;
    }

    this.currentParty = party;
    this.subscribeToParty(party.id);
    return party;
  }

  // Get current party with members
  async getCurrentParty(): Promise<Party | null> {
    const supabase = getSupabase();
    if (!supabase || !this.profile) return null;

    // Find party membership
    const { data: membership, error: memberError } = await supabase
      .from('party_members')
      .select('party_id')
      .eq('player_id', this.profile.id)
      .single();

    if (memberError || !membership) {
      this.currentParty = null;
      return null;
    }

    // Get party with all members
    const { data: party, error: partyError } = await supabase
      .from('parties')
      .select(`
        *,
        members:party_members(
          *,
          profile:profiles(*)
        )
      `)
      .eq('id', membership.party_id)
      .single();

    if (partyError) {
      console.error('Error fetching party:', partyError);
      return null;
    }

    this.currentParty = party;
    this.subscribeToParty(party.id);
    return party;
  }

  // Join party by code
  async joinPartyByCode(code: string): Promise<Party | null> {
    const supabase = getSupabase();
    if (!supabase || !this.profile) return null;

    // Leave current party first
    await this.leaveParty();

    // Find party by code
    const { data: party, error: findError } = await supabase
      .from('parties')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (findError || !party) {
      console.error('Party not found:', findError);
      return null;
    }

    // Check if party is full
    const { count } = await supabase
      .from('party_members')
      .select('*', { count: 'exact' })
      .eq('party_id', party.id);

    if (count && count >= party.max_size) {
      console.error('Party is full');
      return null;
    }

    // Join party
    const { error: joinError } = await supabase
      .from('party_members')
      .insert({
        party_id: party.id,
        player_id: this.profile.id,
        role: this.profile.preferred_role,
        is_ready: false,
      });

    if (joinError) {
      console.error('Error joining party:', joinError);
      return null;
    }

    return this.getCurrentParty();
  }

  // Leave current party
  async leaveParty(): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !this.profile || !this.currentParty) return false;

    // If leader, transfer leadership or delete party
    if (this.currentParty.leader_id === this.profile.id) {
      // Get other members
      const { data: members } = await supabase
        .from('party_members')
        .select('player_id')
        .eq('party_id', this.currentParty.id)
        .neq('player_id', this.profile.id);

      if (members && members.length > 0) {
        // Transfer leadership
        await supabase
          .from('parties')
          .update({ leader_id: members[0].player_id })
          .eq('id', this.currentParty.id);
      } else {
        // Delete party (no other members)
        await supabase
          .from('parties')
          .delete()
          .eq('id', this.currentParty.id);
      }
    }

    // Remove self from party
    const { error } = await supabase
      .from('party_members')
      .delete()
      .eq('party_id', this.currentParty.id)
      .eq('player_id', this.profile.id);

    if (error) {
      console.error('Error leaving party:', error);
      return false;
    }

    this.unsubscribeFromParty();
    this.currentParty = null;
    return true;
  }

  // Set ready status
  async setReady(ready: boolean): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !this.profile || !this.currentParty) return false;

    const { error } = await supabase
      .from('party_members')
      .update({ is_ready: ready })
      .eq('party_id', this.currentParty.id)
      .eq('player_id', this.profile.id);

    return !error;
  }

  // Set role
  async setRole(role: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !this.profile || !this.currentParty) return false;

    const { error } = await supabase
      .from('party_members')
      .update({ role })
      .eq('party_id', this.currentParty.id)
      .eq('player_id', this.profile.id);

    return !error;
  }

  // Get available lobbies
  async getLobbies(shard: Shard): Promise<Lobby[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('lobbies')
      .select('*')
      .eq('shard', shard)
      .eq('status', 'waiting')
      .order('current_teams', { ascending: false });

    if (error) {
      console.error('Error fetching lobbies:', error);
      return [];
    }

    return data || [];
  }

  // Join matchmaking queue
  async joinQueue(shard: Shard): Promise<Lobby | null> {
    const supabase = getSupabase();
    if (!supabase || !this.currentParty) return null;

    // Find an available lobby or create one
    let lobby: Lobby | null = null;

    const { data: lobbies } = await supabase
      .from('lobbies')
      .select('*')
      .eq('shard', shard)
      .eq('status', 'waiting')
      .lt('current_teams', 20)
      .order('current_teams', { ascending: false })
      .limit(1);

    if (lobbies && lobbies.length > 0) {
      lobby = lobbies[0];
    } else {
      // Create new lobby
      const { data: newLobby, error: createError } = await supabase
        .from('lobbies')
        .insert({
          name: `Lobby ${Date.now()}`,
          shard,
          mode: 'standard',
          status: 'waiting',
        })
        .select()
        .single();

      if (createError || !newLobby) {
        console.error('Error creating lobby:', createError);
        return null;
      }
      lobby = newLobby;
    }

    // Ensure lobby is not null at this point
    if (!lobby) {
      return null;
    }

    // Join lobby
    const { error: joinError } = await supabase
      .from('lobby_teams')
      .insert({
        lobby_id: lobby.id,
        party_id: this.currentParty.id,
        team_slot: lobby.current_teams + 1,
      });

    if (joinError) {
      console.error('Error joining lobby:', joinError);
      return null;
    }

    // Update lobby count
    await supabase
      .from('lobbies')
      .update({ current_teams: lobby.current_teams + 1 })
      .eq('id', lobby.id);

    this.currentLobby = lobby;
    this.subscribeToLobby(lobby.id);
    return lobby;
  }

  // Leave queue
  async leaveQueue(): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !this.currentParty || !this.currentLobby) return false;

    const { error } = await supabase
      .from('lobby_teams')
      .delete()
      .eq('lobby_id', this.currentLobby.id)
      .eq('party_id', this.currentParty.id);

    if (error) {
      console.error('Error leaving queue:', error);
      return false;
    }

    // Update lobby count
    await supabase
      .from('lobbies')
      .update({ current_teams: Math.max(0, this.currentLobby.current_teams - 1) })
      .eq('id', this.currentLobby.id);

    this.unsubscribeFromLobby();
    this.currentLobby = null;
    return true;
  }

  // Send party invite
  async invitePlayer(playerId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !this.profile || !this.currentParty) return false;

    const { error } = await supabase
      .from('party_invites')
      .insert({
        party_id: this.currentParty.id,
        from_player_id: this.profile.id,
        to_player_id: playerId,
      });

    return !error;
  }

  // Get pending invites
  async getPendingInvites(): Promise<PartyInvite[]> {
    const supabase = getSupabase();
    if (!supabase || !this.profile) return [];

    const { data, error } = await supabase
      .from('party_invites')
      .select(`
        *,
        from_profile:profiles!party_invites_from_player_id_fkey(*)
      `)
      .eq('to_player_id', this.profile.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching invites:', error);
      return [];
    }

    return data || [];
  }

  // Accept invite
  async acceptInvite(inviteId: string): Promise<Party | null> {
    const supabase = getSupabase();
    if (!supabase || !this.profile) return null;

    // Get invite
    const { data: invite } = await supabase
      .from('party_invites')
      .select('*')
      .eq('id', inviteId)
      .single();

    if (!invite) return null;

    // Update invite status
    await supabase
      .from('party_invites')
      .update({ status: 'accepted' })
      .eq('id', inviteId);

    // Leave current party and join invited party
    await this.leaveParty();

    const { error: joinError } = await supabase
      .from('party_members')
      .insert({
        party_id: invite.party_id,
        player_id: this.profile.id,
        role: this.profile.preferred_role,
        is_ready: false,
      });

    if (joinError) {
      console.error('Error joining party:', joinError);
      return null;
    }

    return this.getCurrentParty();
  }

  // Decline invite
  async declineInvite(inviteId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error } = await supabase
      .from('party_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId);

    return !error;
  }

  // Search players
  async searchPlayers(query: string): Promise<Profile[]> {
    const supabase = getSupabase();
    if (!supabase || query.length < 2) return [];

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error searching players:', error);
      return [];
    }

    return data || [];
  }

  // Subscribe to party updates
  private subscribeToParty(partyId: string): void {
    const supabase = getSupabase();
    if (!supabase) return;

    this.unsubscribeFromParty();

    this.partyChannel = supabase
      .channel(`party:${partyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'party_members',
        filter: `party_id=eq.${partyId}`,
      }, () => {
        this.getCurrentParty().then(party => {
          if (this.onPartyUpdate) this.onPartyUpdate(party);
        });
      })
      .subscribe();
  }

  private unsubscribeFromParty(): void {
    if (this.partyChannel) {
      this.partyChannel.unsubscribe();
      this.partyChannel = null;
    }
  }

  // Subscribe to lobby updates
  private subscribeToLobby(lobbyId: string): void {
    const supabase = getSupabase();
    if (!supabase) return;

    this.unsubscribeFromLobby();

    this.lobbyChannel = supabase
      .channel(`lobby:${lobbyId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lobbies',
        filter: `id=eq.${lobbyId}`,
      }, (payload) => {
        const lobby = payload.new as Lobby;
        this.currentLobby = lobby;
        if (this.onLobbyUpdate) this.onLobbyUpdate(lobby);

        // Check if match started
        if (lobby.status === 'starting' && lobby.match_id && this.onMatchStart) {
          this.onMatchStart(lobby.match_id);
        }
      })
      .subscribe();
  }

  private unsubscribeFromLobby(): void {
    if (this.lobbyChannel) {
      this.lobbyChannel.unsubscribe();
      this.lobbyChannel = null;
    }
  }

  // Subscribe to invites
  subscribeToInvites(): void {
    const supabase = getSupabase();
    if (!supabase || !this.profile) return;

    this.invitesChannel = supabase
      .channel(`invites:${this.profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'party_invites',
        filter: `to_player_id=eq.${this.profile.id}`,
      }, async (payload) => {
        const invite = payload.new as PartyInvite;
        // Get sender profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', invite.from_player_id)
          .single();

        invite.from_profile = profile;
        if (this.onInviteReceived) this.onInviteReceived(invite);
      })
      .subscribe();
  }

  // Event handlers
  setOnPartyUpdate(callback: (party: Party | null) => void): void {
    this.onPartyUpdate = callback;
  }

  setOnLobbyUpdate(callback: (lobby: Lobby | null) => void): void {
    this.onLobbyUpdate = callback;
  }

  setOnInviteReceived(callback: (invite: PartyInvite) => void): void {
    this.onInviteReceived = callback;
  }

  setOnMatchStart(callback: (matchId: string) => void): void {
    this.onMatchStart = callback;
  }

  // Getters
  getParty(): Party | null {
    return this.currentParty;
  }

  getLobby(): Lobby | null {
    return this.currentLobby;
  }

  getProfileSync(): Profile | null {
    return this.profile;
  }

  // Cleanup
  destroy(): void {
    this.unsubscribeFromParty();
    this.unsubscribeFromLobby();
    if (this.invitesChannel) {
      this.invitesChannel.unsubscribe();
    }
  }
}

// Export singleton instance
export const lobbyManager = new LobbyManager();
