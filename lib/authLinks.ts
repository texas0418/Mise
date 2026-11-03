// ---------------------------------------------------------------------------
// lib/authLinks.ts: completing a magic link or a password reset
//
// Neither could finish before 1.3.3. The emails were sent with no redirectTo,
// the client has detectSessionInUrl off (correct for native, where there is no
// URL bar to read), and app/+native-intent.tsx sent every incoming link to
// '/', dropping the code. Now each email names /auth/callback, the intent
// keeps the link, and app/auth/callback.tsx turns it into a session.
//
// Supabase delivers one of two shapes:
//   ?code=...                              PKCE, exchanged with exchangeCodeForSession
//   #access_token=...&refresh_token=...    implicit, installed with setSession
// A PKCE link does not say whether it is a recovery, so the reset email's
// redirectTo carries `next=set-new-password` itself.
//
// No React Native imports, so scripts/test-auth-links.ts can drive it.
// ---------------------------------------------------------------------------

export const AUTH_CALLBACK_PATH = 'auth/callback';
export const NEXT_SET_PASSWORD = 'set-new-password';

export interface AuthLink {
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  /** 'recovery', 'magiclink', 'signup' and so on, when Supabase says. */
  type?: string;
  next?: string;
  error?: string;
}

function readParams(part: string, into: Record<string, string>): void {
  for (const pair of part.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = decodeURIComponent((eq === -1 ? pair : pair.slice(0, eq)).replace(/\+/g, ' '));
    const value = eq === -1 ? '' : decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' '));
    if (key) into[key] = value;
  }
}

/** Read the auth parameters from a link's query and fragment. */
export function parseAuthLink(url: string | null | undefined): AuthLink {
  if (!url) return {};
  const params: Record<string, string> = {};
  const hashAt = url.indexOf('#');
  const beforeHash = hashAt === -1 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  if (queryAt !== -1) readParams(beforeHash.slice(queryAt + 1), params);
  if (hashAt !== -1) readParams(url.slice(hashAt + 1), params);

  const link: AuthLink = {};
  if (params.code) link.code = params.code;
  if (params.access_token) link.accessToken = params.access_token;
  if (params.refresh_token) link.refreshToken = params.refresh_token;
  if (params.type) link.type = params.type;
  if (params.next) link.next = params.next;
  const error = params.error_description || params.error;
  if (error) link.error = error;
  return link;
}

/** Whether a link carries anything to sign in with. */
export function hasAuthCredential(link: AuthLink): boolean {
  return !!link.code || (!!link.accessToken && !!link.refreshToken);
}

/** Where to go once the session is in place. */
export function destinationFor(link: AuthLink): '/auth/set-new-password' | '/' {
  return link.type === 'recovery' || link.next === NEXT_SET_PASSWORD ? '/auth/set-new-password' : '/';
}

/** Whether an incoming deep link path is an auth callback. */
export function isAuthCallbackPath(path: string): boolean {
  const bare = path.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '');
  return bare.startsWith(AUTH_CALLBACK_PATH);
}

// The full incoming link, kept by app/+native-intent.tsx so the fragment
// survives the router, which drops it.
let pendingLink: string | null = null;

export function setPendingAuthLink(url: string): void {
  pendingLink = url;
}

export function takePendingAuthLink(): string | null {
  const url = pendingLink;
  pendingLink = null;
  return url;
}
