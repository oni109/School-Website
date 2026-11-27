// =====================================================================
// Epiphany Schools — admin-users Edge Function
// ---------------------------------------------------------------------
// Manages portal logins (Supabase Auth) on behalf of school administrators,
// using the service-role key that only exists on the server.
//
// Actions (POST JSON { action, ... }):
//   bootstrap  { username, password, firstName, lastName }
//              First-time setup only: creates the first administrator.
//              Refused once any login exists.
//   create     { userId, username, password }      (admin only)
//   update     { userId, username?, password?, active? }  (admin only)
//   delete     { userId }                          (admin only)
//
// People sign in with a username; it is mapped to a private address
// `<username>@<LOGIN_DOMAIN>` that is never emailed.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const LOGIN_DOMAIN = 'users.epiphany-schools.app';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,39}$/;
const emailFor = (u: string) => `${u.toLowerCase()}@${LOGIN_DOMAIN}`;
const checkPassword = (p: unknown) => typeof p === 'string' && p.length >= 6 && p.length <= 72;

async function userRecord(userId: string) {
  const { data, error } = await db.from('records').select('id,data').eq('collection', 'users').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as { id: string; data: Record<string, unknown> } | null;
}
async function setAuthId(userId: string, authId: string | null) {
  const rec = await userRecord(userId);
  if (!rec) return;
  const data = { ...rec.data };
  if (authId) data.authId = authId; else delete data.authId;
  const { error } = await db.from('records').update({ data }).eq('collection', 'users').eq('id', userId);
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const action = String(body.action || '');

  try {
    // ---------- first-time setup ----------
    if (action === 'bootstrap') {
      const { data: existing, error } = await db.from('records').select('id').eq('collection', 'users').not('data->>authId', 'is', null).limit(1);
      if (error) throw error;
      if (existing && existing.length) return json({ error: 'This school has already been set up.' }, 403);
      const username = String(body.username || '').trim().toLowerCase();
      if (!USERNAME.test(username)) return json({ error: 'Username must be 3–40 letters, numbers, dots, dashes or underscores.' }, 400);
      if (typeof body.password !== 'string' || body.password.length < 8) return json({ error: 'Use a password of at least 8 characters.' }, 400);
      const created = await db.auth.admin.createUser({ email: emailFor(username), password: body.password, email_confirm: true });
      if (created.error) throw created.error;
      const record = {
        id: 'u_admin', role: 'admin', title: '', firstName: String(body.firstName || 'Admin').slice(0, 60), lastName: String(body.lastName || 'Office').slice(0, 60),
        username, email: '', phone: '', position: 'Administrator', active: true, authId: created.data.user.id,
      };
      const { error: insErr } = await db.from('records').upsert({ collection: 'users', id: 'u_admin', data: record });
      if (insErr) { await db.auth.admin.deleteUser(created.data.user.id); throw insErr; }
      return json({ ok: true });
    }

    // ---------- everything else: caller must be an active administrator ----------
    const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    const { data: who } = await db.auth.getUser(token);
    if (!who?.user) return json({ error: 'Please sign in again.' }, 401);
    const { data: callerRows } = await db.from('records').select('data').eq('collection', 'users').eq('data->>authId', who.user.id).limit(1);
    const caller = callerRows?.[0]?.data as Record<string, unknown> | undefined;
    if (!caller || caller.role !== 'admin' || caller.active === false) return json({ error: 'Only administrators can manage accounts.' }, 403);

    const userId = String(body.userId || '');
    const rec = userId ? await userRecord(userId) : null;
    if (!rec) return json({ error: 'Account record not found. Save it first.' }, 404);
    const authId = rec.data.authId as string | undefined;

    if (action === 'create') {
      const username = String(body.username || rec.data.username || '').trim().toLowerCase();
      if (!USERNAME.test(username)) return json({ error: 'Username must be 3–40 letters, numbers, dots, dashes or underscores.' }, 400);
      if (!checkPassword(body.password)) return json({ error: 'Use a password of at least 6 characters.' }, 400);
      if (authId) return json({ error: 'This account already has a login.' }, 409);
      const created = await db.auth.admin.createUser({ email: emailFor(username), password: body.password as string, email_confirm: true });
      if (created.error) {
        if (/already|exists|registered/i.test(created.error.message)) return json({ error: 'That username is already taken.' }, 409);
        throw created.error;
      }
      await setAuthId(userId, created.data.user.id);
      if (rec.data.active === false) await db.auth.admin.updateUserById(created.data.user.id, { ban_duration: '876000h' });
      return json({ ok: true, authId: created.data.user.id });
    }

    if (action === 'update') {
      if (!authId) return json({ ok: true, skipped: true });
      const attrs: Record<string, unknown> = {};
      if (body.username != null) {
        const username = String(body.username).trim().toLowerCase();
        if (!USERNAME.test(username)) return json({ error: 'Username must be 3–40 letters, numbers, dots, dashes or underscores.' }, 400);
        attrs.email = emailFor(username); attrs.email_confirm = true;
      }
      if (body.password) {
        if (!checkPassword(body.password)) return json({ error: 'Use a password of at least 6 characters.' }, 400);
        attrs.password = body.password;
      }
      if (body.active != null) {
        if (authId === who.user.id && body.active === false) return json({ error: 'You cannot disable your own account.' }, 400);
        attrs.ban_duration = body.active === false ? '876000h' : 'none';
      }
      const { error } = await db.auth.admin.updateUserById(authId, attrs);
      if (error) {
        if (/already|exists|registered/i.test(error.message)) return json({ error: 'That username is already taken.' }, 409);
        throw error;
      }
      return json({ ok: true });
    }

    if (action === 'delete') {
      if (authId === who.user.id) return json({ error: 'You cannot delete your own account.' }, 400);
      if (authId) {
        const { error } = await db.auth.admin.deleteUser(authId);
        if (error && !/not found/i.test(error.message)) throw error;
        await setAuthId(userId, null);
      }
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || 'Server error.' }, 500);
  }
});
