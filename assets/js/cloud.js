/* =====================================================================
   Epiphany Schools — cloud sync (Supabase)
   ---------------------------------------------------------------------
   Keeps the app's in-memory data model, but:
     * loads it from the `records` table (the database only returns rows
       the signed-in person is allowed to see),
     * saves every changed / new / deleted row back automatically,
     * applies live changes made by other people (Realtime),
     * signs people in with Supabase Auth.
   If EPS_CONFIG has no Supabase details, the app runs in local demo mode.
   ===================================================================== */
(function (global) {
  'use strict';
  const EPS = global.EPS, S = EPS.Store;
  const cfg = global.EPS_CONFIG || {};
  const META = ['settings', 'subjects', 'periods'];
  const COLLECTIONS = ['users', 'classes', 'students', 'scores', 'reports', 'attendance', 'feeSchedule', 'payments', 'timetables', 'homework', 'news', 'events', 'gallery', 'faqs', 'testimonials', 'applications', 'enquiries', 'messages', 'announcements', 'pins', 'log', 'subscribers'];
  const configured = !!(cfg.supabaseUrl && cfg.supabaseKey);

  const Cloud = EPS.Cloud = {
    configured,
    enabled: configured && !!global.supabase,
    client: null,
    authUser: null,
    mode: null,
    status: 'idle',
    snapshot: new Map(),
    onRemoteChange: null,
    onStatus: null
  };

  /* ---------- helpers ---------- */
  const key = (c, id) => c + '\u0001' + id;
  // Stable JSON (sorted keys) so local objects compare equal to what the database returns.
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v === undefined ? null : v);
  }
  function rowsFromData(d) {
    const out = new Map();
    META.forEach(m => { if (d[m] !== undefined && d[m] !== null) out.set(key('meta', m), { collection: 'meta', id: m, data: d[m] }); });
    COLLECTIONS.forEach(c => (d[c] || []).forEach(item => {
      if (item && item.id != null) out.set(key(c, String(item.id)), { collection: c, id: String(item.id), data: item });
    }));
    return out;
  }
  function dataFromRows(rows) {
    const d = { version: EPS.DB_VERSION };
    COLLECTIONS.forEach(c => { d[c] = []; });
    rows.forEach(r => {
      if (r.collection === 'meta') d[r.id] = r.data;
      else if (d[r.collection]) d[r.collection].push(r.data);
    });
    return d;
  }
  function errMessage(e) { return (e && (e.message || e.error_description || e.error)) || String(e); }
  const isNetworkError = e => /fetch|network|Load failed|timeout/i.test(errMessage(e)) && !(e && e.code);
  const toEmail = u => String(u || '').trim().toLowerCase() + '@' + (cfg.loginDomain || 'users.epiphany-schools.app');
  Cloud.toEmail = toEmail;

  function setStatus(s, detail) {
    Cloud.status = s;
    if (Cloud.onStatus) try { Cloud.onStatus(s, detail); } catch (e) { console.error(e); }
  }

  /** Session storage that honours "Keep me signed in". */
  const authStorage = {
    remember() { try { return localStorage.getItem('eps.remember') === '1'; } catch (e) { return false; } },
    getItem(k) { try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; } },
    setItem(k, v) { try { if (this.remember()) { localStorage.setItem(k, v); sessionStorage.removeItem(k); } else { sessionStorage.setItem(k, v); localStorage.removeItem(k); } } catch (e) { } },
    removeItem(k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch (e) { } }
  };

  /* ---------- boot ---------- */
  /**
   * mode 'site'   : public website, never signed in, read-only.
   * mode 'portal' : uses the saved sign-in session.
   * Resolves to { local } | { needsSetup } | { ok } | { error }.
   */
  Cloud.boot = async function (mode) {
    Cloud.mode = mode;
    if (!configured) { S.load(); return { local: true }; }
    if (!global.supabase) return { error: 'The school database library could not be loaded.' };
    if (!Cloud.client) {
      Cloud.client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: mode === 'portal'
          ? { persistSession: true, autoRefreshToken: true, storageKey: 'eps.auth', storage: authStorage }
          : { persistSession: false, autoRefreshToken: false }
      });
      if (mode === 'portal') {
        Cloud.client.auth.onAuthStateChange((event, session) => {
          Cloud.authUser = session ? session.user : null;
          if (event === 'SIGNED_OUT' && Cloud.onSignedOut) Cloud.onSignedOut();
        });
      }
    }
    try {
      if (mode === 'portal') {
        const { data } = await Cloud.client.auth.getSession();
        Cloud.authUser = data.session ? data.session.user : null;
      }
      await Cloud.loadAll();
      if (!S.data.settings) {
        const { data: done } = await Cloud.client.rpc('is_setup_done');
        return { needsSetup: !done, needsData: !!done };
      }
      if (mode === 'portal') { await Cloud.loadFamilyExtras(); Cloud.subscribe(); }
      return { ok: true };
    } catch (e) {
      console.error(e);
      return { error: isNetworkError(e) ? 'Cannot reach the school database. Please check your internet connection and try again.' : errMessage(e) };
    }
  };

  Cloud.loadAll = async function () {
    const rows = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      const { data, error } = await Cloud.client.from('records').select('collection,id,data').order('collection').order('id').range(from, from + page - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < page) break;
    }
    S.data = dataFromRows(rows);
    S.resultContext = {};
    Cloud.snapshot = new Map();
    rowsFromData(S.data).forEach((r, k) => Cloud.snapshot.set(k, stable(r.data)));
  };

  /** Parents & students: their own attendance marks and class positions come from secure functions. */
  Cloud.loadFamilyExtras = async function () {
    const me = Cloud.me();
    if (!me || (me.role !== 'parent' && me.role !== 'student')) return;
    const att = await Cloud.client.rpc('my_attendance');
    if (!att.error && Array.isArray(att.data)) {
      S.data.attendance = att.data;
      att.data.forEach(a => Cloud.snapshot.set(key('attendance', a.id), stable(a)));
    }
    const st = S.data.settings;
    const kids = me.role === 'parent' ? (me.childIds || []) : [me.studentId];
    await Promise.all(kids.filter(Boolean).map(async sid => {
      const { data } = await Cloud.client.rpc('result_context', { p_student: sid, p_session: st.session, p_term: Number(st.term) });
      if (data) S.resultContext[[sid, st.session, Number(st.term)].join('|')] = data;
    }));
  };

  Cloud.me = function () {
    if (!Cloud.authUser || !S.data) return null;
    const u = (S.data.users || []).find(x => x.authId === Cloud.authUser.id);
    return u && u.active !== false ? u : null;
  };

  /* ---------- auth ---------- */
  Cloud.signIn = async function (username, password, remember) {
    try { localStorage.setItem('eps.remember', remember ? '1' : '0'); } catch (e) { }
    const { data, error } = await Cloud.client.auth.signInWithPassword({ email: toEmail(username), password });
    if (error) throw new Error(/invalid/i.test(error.message) ? 'Incorrect username or password.' : /banned/i.test(error.message) ? 'This account has been deactivated. Please contact the school office.' : error.message);
    Cloud.authUser = data.user;
    return data.user;
  };
  Cloud.signOut = async function () {
    Cloud.unsubscribe();
    try { await Cloud.client.auth.signOut(); } catch (e) { }
    Cloud.authUser = null;
  };
  Cloud.changePassword = async function (current, next) {
    const me = Cloud.me();
    const check = await Cloud.client.auth.signInWithPassword({ email: toEmail(me.username), password: current });
    if (check.error) throw new Error('Your current password is incorrect.');
    const { error } = await Cloud.client.auth.updateUser({ password: next });
    if (error) throw new Error(error.message);
  };

  /** Call the admin-users Edge Function. */
  Cloud.admin = async function (action, payload) {
    const { data, error } = await Cloud.client.functions.invoke('admin-users', { body: Object.assign({ action }, payload || {}) });
    if (error) {
      let msg = error.message;
      try { const body = await error.context.json(); if (body && body.error) msg = body.error; } catch (e) { }
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  };

  Cloud.rpc = async function (fn, args) {
    const { data, error } = await Cloud.client.rpc(fn, args || {});
    if (error) throw new Error(error.message);
    return data;
  };

  /** Tell the sync engine a row was already saved by a server function. */
  Cloud.markSynced = function (collection, id) {
    const item = collection === 'meta' ? S.data[id] : (S.data[collection] || []).find(x => x.id === id);
    if (item) Cloud.snapshot.set(key(collection, id), stable(item));
  };

  /* ---------- saving ---------- */
  let timer = null, flushing = null, again = false, retryTimer = null;
  Cloud.pending = () => {
    if (!S.data) return false;
    const cur = rowsFromData(S.data);
    for (const [k, r] of cur) if (Cloud.snapshot.get(k) !== stable(r.data)) return true;
    for (const k of Cloud.snapshot.keys()) if (!cur.has(k)) return true;
    return false;
  };
  Cloud.schedule = function () {
    if (!Cloud.enabled || Cloud.mode !== 'portal' || !Cloud.authUser) return;
    clearTimeout(timer);
    setStatus('saving');
    timer = setTimeout(() => Cloud.flush(), 300);
  };
  /** Save all changes now. Resolves when the database has them. */
  Cloud.flush = function () {
    clearTimeout(timer);
    if (flushing) { again = true; return flushing; }
    flushing = (async () => {
      const cur = rowsFromData(S.data);
      const ups = [], dels = {};
      cur.forEach((r, k) => { const j = stable(r.data); if (Cloud.snapshot.get(k) !== j) ups.push({ r, j, k }); });
      Cloud.snapshot.forEach((j, k) => { if (!cur.has(k)) { const [c, id] = k.split('\u0001'); (dels[c] = dels[c] || []).push({ id, k }); } });
      if (!ups.length && !Object.keys(dels).length) { setStatus('saved'); return; }
      setStatus('saving');
      try {
        // New rows are plain inserts; existing rows are upserts. (An upsert also requires being able
        // to read the row back, which people cannot do for e.g. their own activity-log entries.)
        const inserts = ups.filter(x => !Cloud.snapshot.has(x.k)), updates = ups.filter(x => Cloud.snapshot.has(x.k));
        for (const [list, op] of [[inserts, 'insert'], [updates, 'upsert']]) {
          for (let i = 0; i < list.length; i += 300) {
            const batch = list.slice(i, i + 300);
            const rows = batch.map(x => ({ collection: x.r.collection, id: x.r.id, data: x.r.data }));
            const { error } = await Cloud.client.from('records')[op](rows);
            if (error) throw error;
            batch.forEach(x => Cloud.snapshot.set(x.k, x.j));
          }
        }
        for (const c of Object.keys(dels)) {
          for (let i = 0; i < dels[c].length; i += 100) {
            const batch = dels[c].slice(i, i + 100);
            const { error } = await Cloud.client.from('records').delete().eq('collection', c).in('id', batch.map(x => x.id));
            if (error) throw error;
            batch.forEach(x => Cloud.snapshot.delete(x.k));
          }
        }
        setStatus('saved');
      } catch (e) {
        console.error(e);
        if (isNetworkError(e)) {
          setStatus('offline');
          clearTimeout(retryTimer);
          retryTimer = setTimeout(() => Cloud.flush(), 8000);
        } else {
          setStatus('error', errMessage(e));
          if (EPS.UI) EPS.UI.toast('That change could not be saved (' + errMessage(e) + '). Reloading the latest data.', 'bad');
          await Cloud.reload();
        }
        throw e;
      }
    })().finally(() => {
      flushing = null;
      if (again) { again = false; Cloud.flush().catch(() => { }); }
    });
    return flushing;
  };
  Cloud.reload = async function () {
    try { await Cloud.loadAll(); await Cloud.loadFamilyExtras(); } catch (e) { console.error(e); }
    if (Cloud.onRemoteChange) Cloud.onRemoteChange(true);
  };
  global.addEventListener('beforeunload', e => {
    if (Cloud.enabled && Cloud.authUser && (Cloud.status === 'saving' || Cloud.status === 'offline')) { e.preventDefault(); e.returnValue = ''; }
  });
  global.addEventListener('online', () => { if (Cloud.status === 'offline') Cloud.flush().catch(() => { }); });

  /* ---------- live updates ---------- */
  let remoteTimer = null;
  Cloud.subscribe = function () {
    Cloud.unsubscribe();
    if (!Cloud.authUser) return;
    Cloud.channel = Cloud.client.channel('records-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, p => applyRemote(p))
      .subscribe();
  };
  Cloud.unsubscribe = function () {
    if (Cloud.channel) { Cloud.client.removeChannel(Cloud.channel); Cloud.channel = null; }
  };
  function applyRemote(p) {
    const row = p.eventType === 'DELETE' ? p.old : p.new;
    if (!row || !row.collection || row.id == null) return;
    const k = key(row.collection, row.id);
    if (p.eventType === 'DELETE') {
      if (!Cloud.snapshot.has(k)) return;
      if (row.collection === 'meta') delete S.data[row.id];
      else if (S.data[row.collection]) { const i = S.data[row.collection].findIndex(x => x.id === row.id); if (i >= 0) S.data[row.collection].splice(i, 1); }
      Cloud.snapshot.delete(k);
    } else {
      const j = stable(row.data);
      if (Cloud.snapshot.get(k) === j) return; // our own change coming back
      if (row.collection === 'meta') S.data[row.id] = row.data;
      else {
        const list = S.data[row.collection] || (S.data[row.collection] = []);
        const cur = list.find(x => x.id === row.id);
        if (cur) { Object.keys(cur).forEach(x => { delete cur[x]; }); Object.assign(cur, row.data); } // keep the same object
        else list.push(row.data);
      }
      Cloud.snapshot.set(k, j);
    }
    clearTimeout(remoteTimer);
    remoteTimer = setTimeout(() => { if (Cloud.onRemoteChange) Cloud.onRemoteChange(false); }, 400);
  }

  /* ---------- first-time setup ---------- */
  /** Build and upload the school's starting data (sample or empty) as the signed-in admin. */
  Cloud.seedSchool = async function (opts) {
    const me = Cloud.me();
    if (!me || me.role !== 'admin') throw new Error('Only an administrator can set up the school.');
    // Remove logins of any existing accounts that will be replaced.
    for (const u of (S.data.users || [])) {
      if (u.id !== me.id && u.authId) { try { await Cloud.admin('delete', { userId: u.id }); } catch (e) { console.warn(e); } }
    }
    const seed = EPS.buildSeed();
    const admin = Object.assign({}, me);
    const passwords = {};
    if (opts.sample) {
      seed.users = seed.users.filter(u => u.id !== admin.id && u.id !== 'u_admin');
      seed.users.forEach(u => {
        passwords[u.id] = u.password === 'changeme' ? Math.random().toString(36).slice(2, 10) + 'A1' : u.password;
        delete u.password;
      });
      seed.users.unshift(admin);
    } else {
      S.emptySchool(seed, admin);
    }
    if (opts.schoolName) seed.settings.schoolName = opts.schoolName;
    S.data = seed;
    await Cloud.flush();
    if (opts.sample) {
      for (const u of seed.users) {
        if (!passwords[u.id]) continue;
        const res = await Cloud.admin('create', { userId: u.id, username: u.username, password: passwords[u.id] });
        u.authId = res.authId;
        Cloud.markSynced('users', u.id);
      }
    }
    return { passwords };
  };
})(window);
