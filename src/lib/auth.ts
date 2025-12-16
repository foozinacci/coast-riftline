import { supabase } from './supabase';
import { storage } from './storage';

export interface UserProfile {
  id: string;
  displayName: string;
  isGuest: boolean;
  sr: number; // Skill Rating
  lr: number; // Loadout Rating
  currency: number;
}

// Sign in with email magic link
export async function signInWithEmail(email: string): Promise<{ error: Error | null }> {
  if (!supabase) {
    return { error: new Error('Supabase not configured') };
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.origin,
    },
  });

  return { error: error ? new Error(error.message) : null };
}

// Sign out
export async function signOut(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut();
  }
  storage.remove('profile');
  storage.remove('shard');
}

// Get current session
export async function getSession() {
  if (!supabase) {
    return null;
  }

  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Continue as guest (offline mode)
export function continueAsGuest(): UserProfile {
  const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const profile: UserProfile = {
    id: guestId,
    displayName: `Guest_${guestId.slice(-4)}`,
    isGuest: true,
    sr: 1000,
    lr: 0,
    currency: 0,
  };

  storage.set('profile', profile);
  return profile;
}

// Get stored profile
export function getStoredProfile(): UserProfile | null {
  return storage.get<UserProfile>('profile');
}

// Bootstrap profile from server (or create local stub)
export async function bootstrapProfile(): Promise<UserProfile> {
  const session = await getSession();

  if (!session) {
    // Check for existing guest profile
    const existingProfile = getStoredProfile();
    if (existingProfile) {
      return existingProfile;
    }
    // Return null to indicate no profile
    throw new Error('No session');
  }

  // Try to call edge function
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://apschbgavppsbjxieuql.supabase.co'}/functions/v1/profile_bootstrap`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const profile = await response.json() as UserProfile;
      storage.set('profile', profile);
      return profile;
    }
  } catch (e) {
    console.warn('Profile bootstrap failed (edge function not deployed?), using stub');
  }

  // Fallback to stub profile
  const profile: UserProfile = {
    id: session.user.id,
    displayName: session.user.email?.split('@')[0] || 'Player',
    isGuest: false,
    sr: 1000,
    lr: 0,
    currency: 0,
  };

  storage.set('profile', profile);
  return profile;
}

// Listen for auth state changes
export function onAuthStateChange(callback: (isAuthenticated: boolean) => void) {
  if (!supabase) {
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(!!session);
  });

  return () => subscription.unsubscribe();
}
