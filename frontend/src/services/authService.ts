/**
 * Auth Service for The Vault Club
 * 
 * This service provides a lightweight wrapper around Supabase authentication
 * that ensures wallet creation is properly triggered via Sequence Theory's
 * existing Turnkey integration.
 * 
 * IMPORTANT: This does NOT create any new infrastructure. It simply:
 * - Uses the existing Supabase project (qldjhlnsphlixmzzrdwi)
 * - Triggers the existing create-turnkey-wallet Edge Function
 * - Sequence Theory remains the single source of truth for wallet creation
 */

import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  walletAddress?: string;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

export interface WalletResult {
  success: boolean;
  walletAddress?: string;
  isNew?: boolean;
  error?: string;
}

/**
 * Triggers wallet creation via Sequence Theory's existing Turnkey Edge Function.
 * This function does NOT implement any wallet logic - it simply calls the
 * existing create-turnkey-wallet function deployed on Supabase.
 */
export async function triggerWalletCreation(accessToken: string): Promise<WalletResult> {
  console.log('[AuthService] Triggering wallet creation via Sequence Theory...');
  
  try {
    const response = await supabase.functions.invoke('create-turnkey-wallet', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (response.error) {
      console.error('[AuthService] Wallet creation error:', response.error);
      return {
        success: false,
        error: response.error.message || 'Failed to create wallet'
      };
    }

    if (response.data?.wallet_address) {
      console.log('[AuthService] Wallet creation successful:', {
        address: response.data.wallet_address,
        isNew: response.data.is_new
      });
      return {
        success: true,
        walletAddress: response.data.wallet_address,
        isNew: response.data.is_new
      };
    }

    console.warn('[AuthService] Wallet response missing address:', response.data);
    return {
      success: false,
      error: 'Wallet creation response missing address'
    };
  } catch (error: any) {
    console.error('[AuthService] Wallet creation exception:', error);
    return {
      success: false,
      error: error.message || 'Unexpected error during wallet creation'
    };
  }
}

/**
 * Fetches existing wallet for a user from Sequence Theory's database.
 */
export async function fetchExistingWallet(userId: string): Promise<WalletResult> {
  console.log('[AuthService] Fetching existing wallet for user:', userId);
  
  try {
    const { data: wallet, error } = await supabase
      .from('user_wallets')
      .select('wallet_address')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[AuthService] Error fetching wallet:', error);
      return {
        success: false,
        error: error.message
      };
    }

    if (wallet?.wallet_address) {
      console.log('[AuthService] Found existing wallet:', wallet.wallet_address);
      return {
        success: true,
        walletAddress: wallet.wallet_address,
        isNew: false
      };
    }

    console.log('[AuthService] No existing wallet found for user');
    return {
      success: false,
      error: 'No wallet found'
    };
  } catch (error: any) {
    console.error('[AuthService] Exception fetching wallet:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch wallet'
    };
  }
}

/**
 * Creates a profile record for a new user.
 * This is a fallback in case the Supabase database trigger doesn't exist.
 * The profile should ideally be created by a trigger on auth.users insert.
 */
async function ensureProfileExists(userId: string, email: string): Promise<void> {
  console.log('[AuthService] Ensuring profile exists for user:', userId);
  
  try {
    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingProfile) {
      console.log('[AuthService] Profile already exists');
      return;
    }

    // Create profile if it doesn't exist
    const { error } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        email: email,
        name: email.split('@')[0], // Default name from email
      });

    if (error) {
      // Profile might have been created by trigger, ignore duplicate error
      if (!error.message.includes('duplicate')) {
        console.error('[AuthService] Error creating profile:', error);
      }
    } else {
      console.log('[AuthService] Profile created successfully');
    }
  } catch (err) {
    console.error('[AuthService] Exception in ensureProfileExists:', err);
  }
}

/**
 * Registers a new user and triggers wallet creation via Sequence Theory.
 * 
 * Flow:
 * 1. Create user in Supabase Auth (same instance as Sequence Theory)
 * 2. Create profile record (fallback if no database trigger)
 * 3. If email confirmation disabled, immediately trigger wallet creation
 * 4. Wallet creation is handled by Sequence Theory's existing Turnkey function
 */
export async function registerUser(
  email: string, 
  password: string,
  redirectUrl?: string
): Promise<AuthResult> {
  console.log('[AuthService] Starting registration for:', email);
  
  try {
    // Step 1: Register user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl || `${window.location.origin}/`
      }
    });

    if (error) {
      console.error('[AuthService] Registration error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Registration failed - no user returned'
      };
    }

    console.log('[AuthService] User created:', data.user.id);

    // Step 2: Ensure profile exists (fallback for missing trigger)
    await ensureProfileExists(data.user.id, email);

    // Step 3: Check if email confirmation is required
    if (!data.session) {
      console.log('[AuthService] Email confirmation required');
      return {
        success: true,
        user: data.user,
        requiresEmailConfirmation: true
      };
    }

    // Step 4: If session exists, trigger wallet creation immediately
    console.log('[AuthService] Session active, triggering wallet creation...');
    const walletResult = await triggerWalletCreation(data.session.access_token);

    return {
      success: true,
      user: data.user,
      session: data.session,
      walletAddress: walletResult.walletAddress,
      requiresEmailConfirmation: false
    };
  } catch (error: any) {
    console.error('[AuthService] Registration exception:', error);
    return {
      success: false,
      error: error.message || 'Registration failed'
    };
  }
}

/**
 * Signs in an existing user and ensures wallet exists.
 * If wallet doesn't exist, triggers creation via Sequence Theory.
 */
export async function signInUser(email: string, password: string): Promise<AuthResult> {
  console.log('[AuthService] Starting sign in for:', email);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('[AuthService] Sign in error:', error);
      return {
        success: false,
        error: error.message
      };
    }

    if (!data.session || !data.user) {
      return {
        success: false,
        error: 'Sign in failed - no session returned'
      };
    }

    console.log('[AuthService] Sign in successful:', data.user.id);

    // Check for existing wallet
    let walletAddress: string | undefined;
    const existingWallet = await fetchExistingWallet(data.user.id);
    
    if (existingWallet.success && existingWallet.walletAddress) {
      walletAddress = existingWallet.walletAddress;
    } else {
      // Trigger wallet creation if not exists
      console.log('[AuthService] No wallet found, triggering creation...');
      const walletResult = await triggerWalletCreation(data.session.access_token);
      walletAddress = walletResult.walletAddress;
    }

    return {
      success: true,
      user: data.user,
      session: data.session,
      walletAddress
    };
  } catch (error: any) {
    console.error('[AuthService] Sign in exception:', error);
    return {
      success: false,
      error: error.message || 'Sign in failed'
    };
  }
}

/**
 * Signs out the current user.
 */
export async function signOutUser(): Promise<{ success: boolean; error?: string }> {
  console.log('[AuthService] Signing out...');
  
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('[AuthService] Sign out error:', error);
      return { success: false, error: error.message };
    }

    console.log('[AuthService] Sign out successful');
    return { success: true };
  } catch (error: any) {
    console.error('[AuthService] Sign out exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Gets the current session.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Subscribes to auth state changes.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange(callback);
}
