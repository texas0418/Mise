/**
 * scripts/test-auth-links.ts
 *
 *   bun scripts/test-auth-links.ts
 *
 * Reading magic link and password reset links (lib/authLinks.ts). Before
 * 1.3.3 neither could complete: every link went to '/' with its code dropped.
 */
import {
  parseAuthLink,
  hasAuthCredential,
  destinationFor,
  isAuthCallbackPath,
} from '@/lib/authLinks';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean) {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}`);
}

const pkce = parseAuthLink('mise-app://auth/callback?code=abc123');
ok('a PKCE code is read', pkce.code === 'abc123' && hasAuthCredential(pkce));
ok('a magic link goes home', destinationFor(pkce) === '/');

const reset = parseAuthLink('https://mise.simonbuilds.app/auth/callback?next=set-new-password&code=xyz');
ok('a reset link keeps its code', reset.code === 'xyz');
ok('a reset link goes to set-new-password', destinationFor(reset) === '/auth/set-new-password');

const implicit = parseAuthLink('mise-app://auth/callback#access_token=a.b.c&refresh_token=r1&type=recovery');
ok('fragment tokens are read', implicit.accessToken === 'a.b.c' && implicit.refreshToken === 'r1');
ok('fragment tokens are a credential', hasAuthCredential(implicit));
ok('type=recovery goes to set-new-password', destinationFor(implicit) === '/auth/set-new-password');

const half = parseAuthLink('mise-app://auth/callback#access_token=a.b.c');
ok('an access token alone is not a credential', !hasAuthCredential(half));

const expired = parseAuthLink('mise-app://auth/callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
ok('an error description is read and decoded', expired.error === 'Email link is invalid or has expired');
ok('nothing is not a credential', !hasAuthCredential(parseAuthLink(null)));

ok('a scheme callback path is recognized', isAuthCallbackPath('mise-app://auth/callback?code=1'));
ok('a bare callback path is recognized', isAuthCallbackPath('/auth/callback?code=1'));
ok('another path is not', !isAuthCallbackPath('mise-app://project-detail?id=1'));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
