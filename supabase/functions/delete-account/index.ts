/**
 * supabase/functions/delete-account/index.ts
 *
 * Deletes the calling account and everything it owns.
 *
 * The app used to do this itself, table by table, from app/auth/profile.tsx.
 * It missed several tables, ignored every error, could not touch storage or
 * project memberships, and could never delete the auth user, because only the
 * service role can. So "Delete My Account" signed the user out and left the
 * account and most of its data in place.
 *
 * ## Trust
 *
 * Who is being deleted comes only from the caller's Supabase JWT, verified by
 * `auth.getUser()`. The body is never read: a body field would let anyone
 * delete any account by typing its id.
 *
 * ## Order
 *
 * 0. In projects the caller owns, every row of every member, and the
 *    memberships: the film goes with its owner.
 * 1. Rows in every public table with `user_id` (tables.ts), children first.
 *    A table that is not on the server yet is skipped; any other error stops
 *    here with a 500 that names the table, so nothing half-deleted reaches
 *    step 4 and the user can retry.
 * 2. The caller's project_members rows.
 * 3. The caller's files in the `scripts` bucket. utils/scriptPicker.ts names
 *    every upload `{projectId}/{userId}-{timestamp}-{name}`.
 * 4. The auth user.
 *
 * TODO(Apple token revocation): an account that used Sign in with Apple must
 * also have its Apple tokens revoked (POST https://appleid.apple.com/auth/revoke).
 * That needs Apple key material (team id, key id, private key, client id) as
 * secrets, which are not set yet. Tracked in texas0418/Mise#160.
 *
 * ## Deployment
 *
 * `verify_jwt` stays at its default of true: the caller is a signed-in user.
 *
 *   supabase functions deploy delete-account
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { USER_TABLES, PROJECT_TABLES, isMissingTable } from './tables.ts';

const BUCKET = 'scripts';
const PAGE = 1000;

// The web build at mise.simonbuilds.app calls this from the browser, which
// sends a CORS preflight first. Native apps send no Origin and ignore these.
const WEB_ORIGIN = 'https://mise.simonbuilds.app';
const CORS = {
  'Access-Control-Allow-Origin': WEB_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/** Who is calling, according to their token rather than their claim. */
async function callerId(req: Request): Promise<string | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;

  const scoped = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }
  );

  const { data, error } = await scoped.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

/** Empty the projects this account owns. Returns the table that failed, or null. */
async function deleteOwnedProjects(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.from('projects').select('id').eq('user_id', userId);
  if (error) return 'projects';
  const ids = (data ?? []).map((p: { id: string }) => p.id);
  if (ids.length === 0) return null;

  for (const table of [...PROJECT_TABLES, 'project_members']) {
    const { error: deleteError } = await admin.from(table).delete().in('project_id', ids);
    if (deleteError && !isMissingTable(deleteError.code)) {
      console.error(`[delete-account] ${table} in owned projects: ${deleteError.message}`);
      return table;
    }
  }
  return null;
}

/** Delete the caller's rows everywhere. Returns the table that failed, or null. */
async function deleteRows(admin: SupabaseClient, userId: string): Promise<string | null> {
  for (const table of USER_TABLES) {
    const { error } = await admin.from(table).delete().eq('user_id', userId);
    if (error && !isMissingTable(error.code)) {
      console.error(`[delete-account] ${table}: ${error.message}`);
      return table;
    }
  }
  const { error } = await admin.from('project_members').delete().eq('user_id', userId);
  if (error) {
    console.error(`[delete-account] project_members: ${error.message}`);
    return 'project_members';
  }
  return null;
}

/** Every file in the bucket whose name starts with this user's id. */
async function findUserFiles(admin: SupabaseClient, userId: string): Promise<string[]> {
  const storage = admin.storage.from(BUCKET);
  const { data: folders, error } = await storage.list('', { limit: PAGE });
  if (error) throw error;

  const paths: string[] = [];
  for (const folder of folders ?? []) {
    // A folder has no id; a stray root-level file does.
    if (folder.id) {
      if (folder.name.startsWith(`${userId}-`)) paths.push(folder.name);
      continue;
    }
    const { data: files, error: listError } = await storage.list(folder.name, {
      limit: PAGE,
      search: `${userId}-`,
    });
    if (listError) throw listError;
    for (const file of files ?? []) {
      if (file.name.startsWith(`${userId}-`)) paths.push(`${folder.name}/${file.name}`);
    }
  }
  return paths;
}

async function deleteFiles(admin: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const paths = await findUserFiles(admin, userId);
    for (let i = 0; i < paths.length; i += 100) {
      const { error } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.error('[delete-account] storage:', (e as Error).message);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const userId = await callerId(req);
  if (!userId) return json(401, { error: 'unauthorized' });

  const admin = serviceClient();

  const failedTable = (await deleteOwnedProjects(admin, userId)) ?? (await deleteRows(admin, userId));
  if (failedTable) return json(500, { error: `could not delete ${failedTable}` });

  if (!(await deleteFiles(admin, userId))) {
    return json(500, { error: 'could not delete uploaded scripts' });
  }

  // TODO(Apple token revocation): revoke here, before the user is gone. See the header.

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error('[delete-account] auth user:', error.message);
    return json(500, { error: 'could not delete the account' });
  }

  console.log(`[delete-account] ${userId} deleted`);
  return json(200, { ok: true });
});
