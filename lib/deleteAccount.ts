/**
 * lib/deleteAccount.ts
 *
 * Ask the server to delete this account (supabase/functions/delete-account).
 * Only the server can delete the auth user and the scripts storage objects,
 * so the app no longer tries to do any of it itself.
 */
import { supabase } from '@/lib/supabase';

export const SUPPORT_EMAIL = 'support@simonbuilds.app';

/** Resolves to null on success, or a message to show the user. */
export async function requestAccountDeletion(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) return error.message || 'The server could not delete the account.';
    if (!data?.ok) return data?.error || 'The server could not delete the account.';
    return null;
  } catch (e: any) {
    return e?.message || 'Could not reach the server.';
  }
}
