/* =====================================================================
   Epiphany Schools — portal core (auth, shell, router, shared helpers)
   Views are registered in portal-academic.js and portal-office.js.
   ===================================================================== */
(function () {
  'use strict';
  const EPS = window.EPS, S = EPS.Store.load(), U = EPS.UI;
  const { esc, attr } = U;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const app = $('#app');

  const P = EPS.Portal = { views: {}, S, U, $, $$ };

  /* ---------- session ---------- */
  const SESSION_KEY = 'eps.session';
  function readSession() {
    try { return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY); } catch (e) { return null; }
  }
  function writeSession(id, remember) {
    try {
      sessionStorage.setItem(SESSION_KEY, id);
      if (remember) localStorage.setItem(SESSION_KEY, id); else localStorage.removeItem(SESSION_KEY);
    } catch (e) { }
  }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) { } }
  P.me = () => { const id = readSession(); const u = id ? S.get('users', id) : null; return u && u.active !== false ? u : null; };
  P.logout = () => { const me = P.me(); if (me) S.log(me.id, 'Signed out.'); clearSession(); location.hash = ''; render(); };

  /* ---------- permissions & scope ---------- */
  P.isAdmin = () => { const m = P.me(); return m && m.role === 'admin'; };
  P.myClassIds = () => {
    const me = P.me(); if (!me) return [];
    if (me.role === 'admin') return S.sortedClasses().map(c => c.id);
    if (me.role === 'teacher') {
      const ids = new Set(me.classIds || []);
      S.all('classes').forEach(c => { if (c.teacherId === me.id) ids.add(c.id); });
      return S.sortedClasses().filter(c => ids.has(c.id)).map(c => c.id);
    }
    return [];
  };
  P.myChildren = () => {
    const me = P.me(); if (!me) return [];
    if (me.role === 'parent') return (me.childIds || []).map(id => S.get('students', id)).filter(Boolean);
    if (me.role === 'student') { const s = S.get('students', me.studentId); return s ? [s] : []; }
    return [];
  };
  P.currentChild = q => {
    const kids = P.myChildren();
    let id = q && q.child;
    if (!id) { try { id = sessionStorage.getItem('eps.child'); } catch (e) { } }
    const kid = kids.find(k => k.id === id) || kids[0] || null;
    if (kid) { try { sessionStorage.setItem('eps.child', kid.id); } catch (e) { } }
    return kid;
  };
  P.canSeeStudent = sid => {
    const me = P.me(); if (!me) return false;
    if (me.role === 'admin') return true;
    const s = S.get('students', sid); if (!s) return false;
    if (me.role === 'teacher') return P.myClassIds().includes(s.classId);
    return P.myChildren().some(k => k.id === sid);
  };

  /* ---------- navigation ---------- */
  P.threadVisible = (t, u) => t.participants.includes(u.id) || (u.role === 'admin' && t.participants.includes('office'));
  P.unreadThreads = () => { const me = P.me(); return me ? S.all('messages').filter(t => P.threadVisible(t, me) && !(t.readBy || []).includes(me.id)).length : 0; };
  const unreadThreads = () => P.unreadThreads();
  const newApps = () => S.all('applications').filter(a => a.status === 'Submitted').length;
  const newEnq = () => S.all('enquiries').filter(e => e.status === 'New').length;

  const NAV = {
    admin: [
      ['', [['dashboard', 'Dashboard', '🏠']]],
      ['People', [['students', 'Students', '🎓'], ['staff', 'Staff & users', '👩‍🏫'], ['classes', 'Classes', '🏫']]],
      ['Academics', [['attendance', 'Attendance', '✅'], ['gradebook', 'Gradebook', '📝'], ['reports', 'Report cards', '📄'], ['homework', 'Homework', '📚'], ['timetable', 'Timetables', '🗓']]],
      ['Office', [['fees', 'Fees & payments', '💳'], ['admissions', 'Admissions', '📥', newApps], ['enquiries', 'Enquiries', '☎️', newEnq]]],
      ['Communication', [['announcements', 'Announcements', '📣'], ['messages', 'Messages', '💬', unreadThreads]]],
      ['Website & system', [['website', 'Website content', '🌐'], ['pins', 'Result PINs', '🔑'], ['settings', 'Settings', '⚙️'], ['data', 'Data & backup', '💾'], ['activity', 'Activity log', '🕘']]]
    ],
    teacher: [
      ['', [['dashboard', 'Dashboard', '🏠']]],
      ['My classes', [['students', 'Students', '🎓'], ['attendance', 'Attendance', '✅'], ['gradebook', 'Gradebook', '📝'], ['reports', 'Report cards', '📄'], ['homework', 'Homework', '📚'], ['timetable', 'Timetable', '🗓']]],
      ['Communication', [['announcements', 'Announcements', '📣'], ['messages', 'Messages', '💬', unreadThreads], ['calendar', 'School calendar', '📅']]]
    ],
    parent: [
      ['', [['dashboard', 'Dashboard', '🏠']]],
      ['My children', [['results', 'Results', '📊'], ['attendance', 'Attendance', '✅'], ['fees', 'Fees & receipts', '💳'], ['homework', 'Homework', '📚'], ['timetable', 'Timetable', '🗓']]],
      ['School', [['announcements', 'Announcements', '📣'], ['messages', 'Messages', '💬', unreadThreads], ['calendar', 'School calendar', '📅']]]
    ],
    student: [
      ['', [['dashboard', 'Dashboard', '🏠']]],
      ['My learning', [['timetable', 'Timetable', '🗓'], ['homework', 'Homework', '📚'], ['results', 'Results', '📊'], ['attendance', 'Attendance', '✅']]],
      ['School', [['announcements', 'Announcements', '📣'], ['calendar', 'School calendar', '📅']]]
    ]
  };
  P.allowed = (view, role) => (NAV[role] || []).some(g => g[1].some(i => i[0] === view)) || view === 'profile' || view === 'account';

  /* ---------- hash routing ---------- */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = {};
    new URLSearchParams(qs || '').forEach((v, k) => { q[k] = v; });
    return { view: parts[0] || 'dashboard', arg: parts[1] ? decodeURIComponent(parts[1]) : null, q };
  }
  P.href = (view, arg, q) => '#/' + view + (arg ? '/' + encodeURIComponent(arg) : '') + (q && Object.keys(q).length ? '?' + new URLSearchParams(Object.entries(q).filter(([, v]) => v != null && v !== '')).toString() : '');
  P.go = (view, arg, q) => { const h = P.href(view, arg, q); if (location.hash === h) render(); else location.hash = h; };
  P.setQuery = patch => { const r = parseHash(); P.go(r.view, r.arg, Object.assign({}, r.q, patch)); };
  P.refresh = () => render();

  /* ---------- shared view helpers ---------- */
  P.pageHead = (title, sub, actions) => '<div class="page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (actions ? '<div class="actions">' + actions + '</div>' : '') + '</div>';
  P.kpi = (icon, label, value, sub, href) => (href ? '<a class="kpi" href="' + attr(href) + '">' : '<div class="kpi">') + '<div class="k-ico" aria-hidden="true">' + icon + '</div><div><span>' + esc(label) + '</span><b>' + value + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + (href ? '</a>' : '</div>');
  P.avatar = (name, gender, size) => '<span class="avatar ' + (size || '') + ' ' + (gender === 'Female' ? 'f' : gender === 'Male' ? 'm' : '') + '" aria-hidden="true">' + esc(U.initials(name)) + '</span>';
  P.classOptions = (ids, value, opts) => {
    opts = opts || {};
    const list = S.sortedClasses().filter(c => !ids || ids.includes(c.id));
    return (opts.all ? '<option value="">' + esc(opts.all) + '</option>' : '') + list.map(c => '<option value="' + c.id + '"' + (c.id === value ? ' selected' : '') + '>' + esc(c.name) + '</option>').join('');
  };
  P.childSwitcher = (q, view) => {
    const kids = P.myChildren();
    if (kids.length < 2) return '';
    const cur = P.currentChild(q);
    return '<div class="tabs" role="tablist" aria-label="Choose child">' + kids.map(k => '<a role="tab" aria-selected="' + (k.id === cur.id) + '" class="' + (k.id === cur.id ? 'active' : '') + '" href="' + P.href(view, null, Object.assign({}, q, { child: k.id })) + '">' + esc(k.firstName) + ' · ' + esc((S.classOf(k) || {}).name || '') + '</a>').join('') + '</div>';
  };
  P.statusBadge = st => {
    const map = { Paid: 'ok', 'Part-paid': 'warn', Owing: 'bad', Active: 'ok', Graduated: 'info', Withdrawn: 'bad', Suspended: 'warn', Submitted: 'info', 'Under review': 'warn', 'Exam scheduled': 'warn', Admitted: 'ok', Declined: 'bad', Waitlisted: 'warn', Enrolled: 'ok', New: 'bad', Replied: 'ok', Closed: '' };
    return '<span class="badge ' + (map[st] || '') + '">' + esc(st) + '</span>';
  };
  P.empty = (text, action) => '<div class="empty"><div style="font-size:34px">🗂</div><p>' + esc(text) + '</p>' + (action || '') + '</div>';
  P.waLink = (phone, text) => { const n = String(phone || '').replace(/\D/g, '').replace(/^0/, '234'); return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text || '') : ''; };
  P.studentLink = s => '<a class="link-btn" href="' + P.href('students', s.id) + '">' + esc(S.studentName(s)) + '</a>';
  P.bindForm = (form, handler) => form.addEventListener('submit', e => { e.preventDefault(); if (!form.checkValidity()) { form.reportValidity(); return; } handler(U.formData(form), form); });

  /** Resize an uploaded image file to a compact JPEG data URL. */
  P.readImage = (file, maxW) => new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('Please choose an image file.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, (maxW || 1200) / img.width);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => reject(new Error('That image could not be opened.'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  /* ---------- login screen ---------- */
  function renderLogin(err) {
    const st = S.settings;
    document.title = 'Portal login | ' + st.schoolName;
    const demo = st.demoMode ? '<div><p class="hint" style="margin:0 0 8px"><b>Demo accounts</b> — tap to sign in:</p><div class="demo-accounts">' +
      [['admin', 'admin123', 'Administrator', 'Full school office'], ['teacher', 'teacher123', 'Teacher', 'Mrs. Eze · Primary 4'], ['parent', 'parent123', 'Parent', 'Mr. Okafor · 2 children'], ['student', 'student123', 'Student', 'Chinedu · JSS 2']]
        .map(a => '<button type="button" data-u="' + a[0] + '" data-p="' + a[1] + '"><b>' + a[2] + '</b><small>' + a[3] + '</small></button>').join('') + '</div></div>' : '';
    app.innerHTML = '<div class="login"><div class="login-art"><a class="brand" href="index.html">' + U.crest(46) + '<span><strong>' + esc(st.schoolName) + '</strong><small>' + esc((st.town + ' · ' + st.state).toUpperCase()) + '</small></span></a>' +
      '<div><h1>One portal for the whole school community.</h1><p>Administrators, teachers, parents and students — everything in one secure place.</p><ul><li>Report cards, positions and printable results</li><li>Daily attendance and homework</li><li>Fees, receipts and balances</li><li>Messages between parents and teachers</li><li>Admissions, enquiries and website updates</li></ul></div>' +
      '<small style="color:#aebbc9">' + esc(st.motto) + '</small></div>' +
      '<div class="login-form"><form id="login-form" autocomplete="on"><div><h2>Sign in</h2><p class="muted" style="margin:4px 0 0">Use the username and password given by the school.</p></div>' +
      (err ? '<div class="notice-box warn" role="alert">' + esc(err) + '</div>' : '') +
      U.field('username', 'Username', { required: true, autocomplete: 'username' }) + U.field('password', 'Password', { required: true, type: 'password', autocomplete: 'current-password' }) +
      '<label class="check"><input type="checkbox" name="remember"> Keep me signed in on this device</label>' +
      '<button class="btn block">SIGN IN</button>' + demo +
      '<p class="hint" style="margin:0">Forgot your password? Contact the school office to reset it. · <a class="link-btn" href="index.html">← Back to website</a></p></form></div></div>';
    const form = $('#login-form');
    const attempt = (u, p, remember) => {
      const user = S.find('users', x => x.username.toLowerCase() === String(u).toLowerCase() && x.password === p);
      if (!user) { renderLogin('Incorrect username or password.'); return; }
      if (user.active === false) { renderLogin('This account has been deactivated. Please contact the school office.'); return; }
      writeSession(user.id, remember);
      S.update('users', user.id, { lastLogin: new Date().toISOString() });
      S.log(user.id, 'Signed in.');
      location.hash = '#/dashboard';
      render();
    };
    form.addEventListener('submit', e => { e.preventDefault(); const d = U.formData(form); attempt(d.username, d.password, !!d.remember); });
    $$('[data-u]', form).forEach(b => b.onclick = () => attempt(b.dataset.u, b.dataset.p, false));
  }

  /* ---------- shell ---------- */
  function shell(me, view, inner) {
    const st = S.settings;
    const nav = (NAV[me.role] || []).map(([group, items]) => (group ? '<h6>' + esc(group) + '</h6>' : '') + items.map(([key, label, icon, countFn]) => {
      const n = countFn ? countFn() : 0;
      return '<a href="#/' + key + '" class="' + (key === view ? 'active' : '') + '"' + (key === view ? ' aria-current="page"' : '') + '><span class="ico" aria-hidden="true">' + icon + '</span>' + esc(label) + (n ? '<span class="count">' + n + '</span>' : '') + '</a>';
    }).join('')).join('');
    const notes = notifications(me);
    return '<div class="shell"><aside class="side" id="side" aria-label="Portal navigation"><a class="side-brand" href="#/dashboard">' + U.crest(36) + '<span><strong>' + esc(st.schoolName) + '</strong><small>' + esc(me.role.toUpperCase()) + ' PORTAL</small></span></a><nav>' + nav + '</nav>' +
      '<div class="side-foot">' + esc(st.session) + ' · ' + esc(S.termLabel()) + '<br><a href="index.html">View public website ↗</a></div></aside><div class="overlay" id="overlay"></div>' +
      '<div class="main">' +
      (st.demoMode ? '<div class="demo-strip"><span>🧪 <b>Demo mode</b> — sample data stored only in this browser.' + (me.role === 'admin' ? ' Switch off in Settings when going live.' : '') + '</span>' + (me.role === 'admin' ? '<a href="#/data">Reset or start fresh</a>' : '') + '</div>' : '') +
      '<header class="topnav"><button class="icon-btn burger" id="burger" aria-label="Open menu">☰</button>' +
      (me.role === 'admin' || me.role === 'teacher' ? '<div class="gsearch"><label class="sr-only" for="gsearch">Search students</label><input id="gsearch" type="search" placeholder="Search students by name or admission no…" autocomplete="off"><div class="gsearch-results hidden" id="gsearch-results"></div></div>' : '<span class="spacer"></span>') +
      '<span class="spacer"></span><div class="top-actions">' +
      '<button class="icon-btn" id="p-theme" aria-label="Toggle dark mode" title="Toggle dark mode"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg></button>' +
      '<div style="position:relative"><button class="icon-btn bell" id="bell" aria-label="Notifications (' + notes.length + ')" aria-expanded="false">🔔' + (notes.length ? '<span class="dot">' + notes.length + '</span>' : '') + '</button><div class="dropdown hidden" id="bell-dd"><h5>Notifications</h5>' + (notes.length ? notes.map(n => '<a href="' + attr(n.href) + '">' + esc(n.text) + '<small>' + esc(n.sub || '') + '</small></a>').join('') : '<p class="empty" style="padding:20px">You are all caught up.</p>') + '</div></div>' +
      '<div style="position:relative"><button class="userchip" id="userchip" aria-expanded="false" aria-haspopup="true">' + P.avatar(S.userName(me)) + '<span class="who"><b>' + esc(me.firstName + ' ' + me.lastName) + '</b><br><small>' + esc(me.position || me.role) + '</small></span></button>' +
      '<div class="dropdown hidden" id="user-dd"><a href="#/account">👤 My account &amp; password</a><button class="dd-item" id="logout">↩ Sign out</button></div></div>' +
      '</div></header><div class="content" id="content">' + inner + '</div></div></div>';
  }
  function notifications(me) {
    const out = [];
    S.all('messages').filter(t => P.threadVisible(t, me) && !(t.readBy || []).includes(me.id)).forEach(t => out.push({ text: '💬 ' + t.subject, sub: 'New message', href: P.href('messages', t.id) }));
    if (me.role === 'admin') {
      const a = newApps(), e = newEnq();
      if (a) out.push({ text: '📥 ' + a + ' new admission application' + (a > 1 ? 's' : ''), sub: 'Awaiting review', href: '#/admissions' });
      if (e) out.push({ text: '☎️ ' + e + ' new enquir' + (e > 1 ? 'ies' : 'y'), sub: 'From the website', href: '#/enquiries' });
    }
    if (me.role === 'parent' || me.role === 'student') {
      P.myChildren().forEach(k => {
        const due = S.where('homework', h => h.classId === k.classId && !h.doneBy.includes(k.id) && h.due >= EPS.today() && h.due <= EPS.isoDate(new Date(Date.now() + 3 * 864e5)));
        due.forEach(h => out.push({ text: '📚 ' + h.title, sub: k.firstName + ' · due ' + U.fmtDate(h.due, 'short'), href: '#/homework?child=' + k.id }));
        if (me.role === 'parent') { const f = S.feeStatus(k.id); if (f.balance > 0) out.push({ text: '💳 ' + k.firstName + ': balance ' + U.money(f.balance), sub: S.termLabel() + ' fees', href: '#/fees?child=' + k.id }); }
      });
    }
    return out.slice(0, 12);
  }
  function bindShell() {
    const side = $('#side'), ov = $('#overlay');
    const closeSide = () => { side.classList.remove('open'); ov.classList.remove('show'); };
    $('#burger').onclick = () => { side.classList.add('open'); ov.classList.add('show'); };
    ov.onclick = closeSide;
    $$('#side nav a').forEach(a => a.addEventListener('click', closeSide));
    $('#p-theme').onclick = U.toggleTheme;
    const dd = (btn, menu) => {
      btn.onclick = e => { e.stopPropagation(); const open = menu.classList.contains('hidden'); $$('.dropdown').forEach(d => d.classList.add('hidden')); menu.classList.toggle('hidden', !open); btn.setAttribute('aria-expanded', String(open)); };
    };
    dd($('#bell'), $('#bell-dd')); dd($('#userchip'), $('#user-dd'));
    $('#logout').onclick = P.logout;
    const gs = $('#gsearch');
    if (gs) {
      const box = $('#gsearch-results');
      gs.addEventListener('input', () => {
        const t = gs.value.trim().toLowerCase();
        if (t.length < 2) { box.classList.add('hidden'); return; }
        const ids = P.myClassIds();
        const hits = S.all('students').filter(s => ids.includes(s.classId) && (S.studentName(s) + ' ' + s.otherName + ' ' + s.admNo).toLowerCase().includes(t)).slice(0, 8);
        box.innerHTML = hits.length ? hits.map(s => '<a href="' + P.href('students', s.id) + '">' + P.avatar(S.studentName(s), s.gender) + '<span><b>' + esc(S.studentName(s)) + '</b><br><small class="muted">' + esc(s.admNo) + ' · ' + esc((S.classOf(s) || {}).name || '') + '</small></span></a>').join('') : '<p class="empty" style="padding:16px">No students found.</p>';
        box.classList.remove('hidden');
      });
      gs.addEventListener('keydown', e => { if (e.key === 'Escape') { gs.value = ''; box.classList.add('hidden'); } if (e.key === 'Enter') { const a = $('a', box); if (a) a.click(); } });
      box.addEventListener('click', () => { box.classList.add('hidden'); gs.value = ''; });
    }
  }
  document.addEventListener('click', e => { if (!e.target.closest('.dropdown')) $$('.dropdown').forEach(d => d.classList.add('hidden')); if (!e.target.closest('.gsearch')) { const b = $('#gsearch-results'); if (b) b.classList.add('hidden'); } });

  /* ---------- account view (all roles) ---------- */
  P.views.account = {
    render(ctx) {
      const me = ctx.me;
      ctx.mount(() => {
        P.bindForm($('#acc-form'), d => {
          if (d.current !== me.password) { U.toast('Your current password is incorrect.', 'bad'); return; }
          if (d.next.length < 6) { U.toast('Use at least 6 characters.', 'warn'); return; }
          if (d.next !== d.confirm) { U.toast('The new passwords do not match.', 'warn'); return; }
          S.update('users', me.id, { password: d.next }); S.log(me.id, 'Changed password.');
          U.toast('Password updated.'); $('#acc-form').reset();
        });
        P.bindForm($('#prof-form'), d => { S.update('users', me.id, { phone: d.phone, email: d.email }); U.toast('Contact details saved.'); });
      });
      return P.pageHead('My account', 'Manage your sign-in and contact details.') + '<div class="grid k2"><form class="panel" id="prof-form"><h3>Profile</h3><dl class="dl" style="margin-bottom:16px"><dt>Name</dt><dd>' + esc(S.userName(me)) + '</dd><dt>Role</dt><dd style="text-transform:capitalize">' + esc(me.role) + '</dd><dt>Username</dt><dd>' + esc(me.username) + '</dd>' + (me.lastLogin ? '<dt>Last sign-in</dt><dd>' + U.fmtDate(me.lastLogin, 'datetime') + '</dd>' : '') + '</dl><div class="form-grid">' +
        U.field('phone', 'Phone', { type: 'tel', value: me.phone }) + U.field('email', 'Email', { type: 'email', value: me.email }) + '</div><div class="form-actions"><button class="btn">Save details</button></div></form>' +
        '<form class="panel" id="acc-form"><h3>Change password</h3><div class="form-grid" style="grid-template-columns:1fr">' + U.field('current', 'Current password', { type: 'password', required: true, autocomplete: 'current-password' }) + U.field('next', 'New password', { type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 6 characters.' }) + U.field('confirm', 'Confirm new password', { type: 'password', required: true, autocomplete: 'new-password' }) + '</div><div class="form-actions"><button class="btn">Update password</button></div></form></div>';
    }
  };

  /* ---------- render ---------- */
  function render() {
    const me = P.me();
    if (!me) { renderLogin(); return; }
    const { view, arg, q } = parseHash();
    const v = P.views[view];
    const mounts = [];
    const ctx = { me, role: me.role, arg, q, view, mount: fn => mounts.push(fn) };
    let inner;
    if (!v || !P.allowed(view, me.role)) inner = P.empty('This page is not available for your account.', '<a class="btn" href="#/dashboard">Go to dashboard</a>');
    else {
      try { inner = v.render(ctx); }
      catch (err) { console.error(err); inner = '<div class="notice-box warn">Something went wrong showing this page: ' + esc(err.message) + '</div>'; }
    }
    const scrollY = window.scrollY;
    const keepScroll = P._keepScroll; P._keepScroll = false;
    app.innerHTML = shell(me, view, inner);
    document.title = (v && v.title ? v.title + ' · ' : '') + 'Portal | ' + S.settings.schoolName;
    bindShell();
    mounts.forEach(fn => { try { fn(); } catch (err) { console.error(err); } });
    window.scrollTo(0, keepScroll ? scrollY : 0);
  }
  /** Re-render without jumping to the top (after in-page actions). */
  P.rerender = () => { P._keepScroll = true; render(); };

  window.addEventListener('hashchange', () => { U.closeModal(); render(); });
  window.addEventListener('storage', e => { if (e.key === 'epiphany.db.v1') { S.load(); P.rerender(); } });
  document.addEventListener('DOMContentLoaded', render);
  P.start = render;
})();
