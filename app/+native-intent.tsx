import { isAuthCallbackPath, setPendingAuthLink } from '@/lib/authLinks';

/*
 * Every incoming link used to go to '/', which threw away the code in a
 * magic link or password reset email. An auth callback now keeps its link and
 * lands on the screen that completes it; anything else still opens the app.
 */
export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  if (isAuthCallbackPath(path)) {
    setPendingAuthLink(path);
    return '/auth/callback';
  }
  return '/';
}
