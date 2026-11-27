/* =====================================================================
   Epiphany Schools — portal views: dashboards, people & academics
   ===================================================================== */
(function () {
  'use strict';
  const EPS = window.EPS, P = EPS.Portal, S = P.S, U = P.U, $ = P.$, $$ = P.$$;
  const { esc, attr, fmtDate, money, num, ordinal } = U;
  const V = P.views;
  const today = EPS.today;

  /* =================== DASHBOARD =================== */
  V.dashboard = {
    title: 'Dashboard',
    render(ctx) {
      const fn = { admin: adminDash, teacher: teacherDash, parent: familyDash, student: familyDash }[ctx.role];
      return fn(ctx);
    }
  };
  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  const annFor = role => S.all('announcements').filter(a => a.audience === 'all' || a.audience === role || role === 'admin').sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date));
  const annList = (role, n) => { const list = annFor(role).slice(0, n); return list.length ? '<div class="list">' + list.map(a => '<div class="list-item"><div class="grow"><h4>' + (a.pinned ? '<span class="pin-tag">📌</span> ' : '') + esc(a.title) + '</h4><p>' + esc(a.body.length > 140 ? a.body.slice(0, 140) + '…' : a.body) + '</p></div><span class="meta">' + fmtDate(a.date, 'short') + '</span></div>').join('') + '</div>' : P.empty('No announcements yet.'); };
  const eventsList = n => { const ev = S.all('events').filter(e => (e.endDate || e.date) >= today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n); return ev.length ? '<div class="list">' + ev.map(e => '<div class="list-item"><div class="grow"><h4>' + esc(e.title) + '</h4><p>' + fmtDate(e.date, 'day') + (e.time ? ' · ' + esc(e.time) : '') + (e.location ? ' · ' + esc(e.location) : '') + '</p></div><span class="badge">' + esc(e.category) + '</span></div>').join('') + '</div>' : P.empty('No upcoming events.'); };
  P.eventsList = eventsList; P.annList = annList;

  function latestAttendanceDate(classIds) {
    const dates = S.all('attendance').filter(a => !classIds || classIds.includes(a.classId)).map(a => a.date).sort();
    return dates[dates.length - 1] || null;
  }
  function attendanceOn(date, classIds) {
    let p = 0, t = 0;
    S.all('attendance').filter(a => a.date === date && (!classIds || classIds.includes(a.classId))).forEach(a => Object.values(a.records).forEach(v => { t++; if (v !== 'A') p++; }));
    return t ? p / t * 100 : null;
  }

  function adminDash(ctx) {
    const st = S.settings;
    const active = S.all('students').filter(s => s.status === 'Active');
    const staff = S.all('users').filter(u => u.role === 'teacher' && u.active !== false);
    let due = 0, paid = 0, owing = 0;
    const bySection = { nursery: [0, 0], primary: [0, 0], junior: [0, 0], senior: [0, 0] };
    active.forEach(s => { const f = S.feeStatus(s.id); const g = (S.classOf(s) || {}).group; due += f.due; paid += Math.min(f.paid, f.due); if (f.balance > 0) owing++; if (bySection[g]) { bySection[g][0] += f.due; bySection[g][1] += Math.min(f.paid, f.due); } });
    const lastDate = latestAttendanceDate();
    const attPct = lastDate ? attendanceOn(lastDate) : null;
    const trend = [...new Set(S.all('attendance').map(a => a.date))].sort().slice(-10).map(d => ({ label: fmtDate(d, 'day'), value: Math.round(attendanceOn(d) || 0) }));
    const enrol = S.sortedClasses().map(c => ({ label: c.name, value: S.classStudents(c.id).length }));
    const unmarked = lastDate === today() ? S.sortedClasses().filter(c => S.classStudents(c.id).length && !S.get('attendance', c.id + '|' + today())).length : null;
    const resultsDone = (() => { let tot = 0, done = 0; S.sortedClasses().forEach(c => { const subs = S.subjectsFor(c.id); S.classStudents(c.id).forEach(s => subs.forEach(sub => { tot++; const sc = S.scoreFor(s.id, sub); if (sc && sc.ca1 != null && sc.ca2 != null && sc.exam != null) done++; })); }); return tot ? done / tot * 100 : 0; })();
    const log = S.all('log').slice(0, 8);
    return P.pageHead(greeting() + ', ' + ctx.me.firstName, esc(st.session) + ' session · ' + esc(S.termLabel()) + ' · ' + fmtDate(new Date()), '<a class="btn" href="#/students?new=1">+ Add student</a><a class="btn ghost" href="#/fees?pay=1">Record payment</a><a class="btn ghost" href="#/announcements?new=1">Post announcement</a>') +
      '<div class="grid k4">' +
      P.kpi('🎓', 'Active students', active.length, S.all('classes').length + ' classes', '#/students') +
      P.kpi('👩‍🏫', 'Teaching staff', staff.length, S.all('users').filter(u => u.role === 'parent').length + ' parent accounts', '#/staff') +
      P.kpi('✅', 'Attendance', attPct == null ? '—' : Math.round(attPct) + '%', lastDate ? (lastDate === today() ? 'Today' : 'Last taken ' + fmtDate(lastDate, 'short')) + (unmarked ? ' · ' + unmarked + ' classes unmarked' : '') : 'Not taken yet', '#/attendance') +
      P.kpi('💳', 'Fees collected', money(paid), due ? Math.round(paid / due * 100) + '% of ' + money(due) + ' · ' + owing + ' owing' : '', '#/fees?tab=debtors') +
      '</div>' +
      '<div class="grid k4" style="margin-top:18px">' +
      P.kpi('📥', 'New applications', S.all('applications').filter(a => a.status === 'Submitted').length, S.all('applications').length + ' this session', '#/admissions') +
      P.kpi('☎️', 'New enquiries', S.all('enquiries').filter(e => e.status === 'New').length, 'From the website', '#/enquiries') +
      P.kpi('📝', 'Results entered', Math.round(resultsDone) + '%', 'Scores for ' + esc(S.termLabel()), '#/gradebook') +
      P.kpi('💬', 'Unread messages', P.unreadThreads(), 'Parent & staff', '#/messages') +
      '</div>' +
      '<div class="grid main-side" style="margin-top:18px"><div class="grid">' +
      '<div class="panel"><div class="panel-head"><h3>Fee collection by section</h3><a class="link-btn" href="#/fees?tab=debtors">View debtors →</a></div><div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">' + U.donut(due ? paid / due * 100 : 0, 'collected', 'var(--green)') + '<div style="flex:1;min-width:220px">' +
      U.barChart([['Nursery', 'nursery'], ['Primary', 'primary'], ['JSS', 'junior'], ['SS', 'senior']].map(([l, g]) => ({ label: l, value: bySection[g][0] ? Math.round(bySection[g][1] / bySection[g][0] * 100) : 0, color: 'var(--green)' })), { format: v => v + '%' }) + '</div></div></div>' +
      '<div class="panel"><div class="panel-head"><h3>Attendance — last 10 school days</h3><a class="link-btn" href="#/attendance">Take attendance →</a></div>' + (trend.length ? U.barChart(trend, { format: v => v + '%' }) : P.empty('No attendance recorded yet.')) + '</div>' +
      '<div class="panel"><h3>Enrolment by class</h3>' + U.barChart(enrol, { format: v => v }) + '</div>' +
      '</div><div class="grid">' +
      '<div class="panel"><div class="panel-head"><h3>Announcements</h3><a class="link-btn" href="#/announcements">All →</a></div>' + annList('admin', 3) + '</div>' +
      '<div class="panel"><div class="panel-head"><h3>Upcoming events</h3><a class="link-btn" href="#/website?tab=events">Manage →</a></div>' + eventsList(5) + '</div>' +
      '<div class="panel"><div class="panel-head"><h3>Recent activity</h3><a class="link-btn" href="#/activity">All →</a></div><div class="list">' + log.map(l => '<div class="list-item"><div class="grow"><p style="color:var(--ink)">' + esc(l.text) + '</p><p>' + esc(l.user === 'public' ? 'Website visitor' : l.user === 'system' ? 'System' : S.userName(l.user)) + '</p></div><span class="meta">' + U.relTime(l.at) + '</span></div>').join('') + '</div></div>' +
      '</div></div>';
  }

  function teacherDash(ctx) {
    const ids = P.myClassIds();
    const classes = ids.map(id => S.get('classes', id));
    const t = today();
    const hw = S.where('homework', h => ids.includes(h.classId) && h.due >= t).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5);
    return P.pageHead(greeting() + ', ' + ctx.me.title + ' ' + ctx.me.lastName, esc(S.settings.session) + ' · ' + esc(S.termLabel()) + ' · ' + fmtDate(new Date()), '<a class="btn" href="#/attendance">Take attendance</a><a class="btn ghost" href="#/gradebook">Enter scores</a><a class="btn ghost" href="#/homework?new=1">Set homework</a>') +
      '<div class="grid k3">' + (classes.length ? classes.map(c => {
        const studs = S.classStudents(c.id);
        const marked = !!S.get('attendance', c.id + '|' + t);
        const res = S.classResults(c.id);
        const subs = res.subjects.length * studs.length;
        const done = res.rows.reduce((a, r) => a + r.subjects.filter(x => x.complete).length, 0);
        return '<div class="panel"><div class="panel-head"><h3>' + esc(c.name) + '</h3>' + (c.teacherId === ctx.me.id ? '<span class="badge gold">Class teacher</span>' : '<span class="badge">Subject teacher</span>') + '</div>' +
          '<dl class="dl" style="grid-template-columns:1fr auto"><dt>Students</dt><dd>' + studs.length + '</dd><dt>Attendance today</dt><dd>' + (marked ? '<span class="badge ok">Taken</span>' : '<a class="badge bad" href="#/attendance?class=' + c.id + '">Not taken</a>') + '</dd><dt>Scores entered</dt><dd>' + (subs ? Math.round(done / subs * 100) : 0) + '%</dd><dt>Class average</dt><dd>' + num(res.classAvg) + '%</dd></dl>' +
          '<div class="form-actions" style="margin-top:14px"><a class="btn sm" href="#/attendance?class=' + c.id + '">Attendance</a><a class="btn sm ghost" href="#/gradebook?class=' + c.id + '">Gradebook</a><a class="btn sm ghost" href="#/students?class=' + c.id + '">Students</a></div></div>';
      }).join('') : '<div class="panel">' + P.empty('You have not been assigned to any class yet. Please contact the school administrator.') + '</div>') + '</div>' +
      '<div class="grid k2" style="margin-top:18px"><div class="panel"><div class="panel-head"><h3>Homework due soon</h3><a class="link-btn" href="#/homework">All →</a></div>' + (hw.length ? '<div class="list">' + hw.map(h => '<div class="list-item"><div class="grow"><h4>' + esc(h.title) + '</h4><p>' + esc((S.get('classes', h.classId) || {}).name) + ' · ' + esc(h.subject) + ' · ' + h.doneBy.length + '/' + S.classStudents(h.classId).length + ' done</p></div><span class="meta">' + fmtDate(h.due, 'short') + '</span></div>').join('') + '</div>' : P.empty('No homework due.')) + '</div>' +
      '<div class="panel"><div class="panel-head"><h3>Staff announcements</h3><a class="link-btn" href="#/announcements">All →</a></div>' + annList('teacher', 4) + '</div></div>' +
      '<div class="panel" style="margin-top:18px"><h3>Upcoming events</h3>' + eventsList(5) + '</div>';
  }

  function familyDash(ctx) {
    const kids = P.myChildren();
    const isParent = ctx.role === 'parent';
    if (!kids.length) return P.pageHead('Welcome, ' + ctx.me.firstName) + '<div class="panel">' + P.empty('No student is linked to your account yet. Please contact the school office.') + '</div>';
    const cur = P.currentChild(ctx.q);
    const t = today();
    const cards = '<div class="child-cards">' + kids.map(k => {
      const r = S.studentResult(k.id); const a = S.attendanceSummary(k.id); const f = S.feeStatus(k.id);
      return '<a class="child-card' + (k.id === cur.id ? ' active' : '') + '" href="' + P.href('dashboard', null, { child: k.id }) + '"><div class="top">' + P.avatar(S.studentName(k), k.gender, 'lg') + '<div><h3>' + esc(S.studentName(k)) + '</h3><small class="muted">' + esc((S.classOf(k) || {}).name) + ' · ' + esc(k.admNo) + '</small></div></div>' +
        '<div class="mini"><div><b>' + (r && r.row.average != null ? num(r.row.average) + '%' : '—') + '</b><span>Average</span></div><div><b>' + (r && r.row.position ? ordinal(r.row.position) : '—') + '</b><span>Position</span></div><div><b>' + (a.pct != null ? Math.round(a.pct) + '%' : '—') + '</b><span>Attendance</span></div></div>' +
        (isParent ? '<div style="display:flex;justify-content:space-between;align-items:center"><small class="muted">' + esc(S.termLabel()) + ' fees</small>' + (f.balance > 0 ? '<span class="badge bad">Balance ' + money(f.balance) + '</span>' : '<span class="badge ok">Fully paid</span>') + '</div>' : '') + '</a>';
    }).join('') + '</div>';
    const hw = S.where('homework', h => h.classId === cur.classId).sort((a, b) => a.due.localeCompare(b.due)).filter(h => h.due >= t || !h.doneBy.includes(cur.id)).slice(0, 5);
    const tt = S.get('timetables', cur.classId);
    const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
    const todayLessons = tt && tt.grid[dayName] ? tt.grid[dayName].map((s, i) => ({ s, p: S.all('periods')[i] })).filter(x => x.s && !x.p.isBreak) : [];
    return P.pageHead(greeting() + ', ' + ctx.me.firstName, isParent ? 'Here is how your ' + (kids.length > 1 ? 'children are' : 'child is') + ' doing this term.' : 'Here is your day at school.', isParent ? '<a class="btn" href="#/results?child=' + cur.id + '">View report card</a><a class="btn ghost" href="#/messages?new=1">Message a teacher</a>' : '<a class="btn" href="#/homework">My homework</a>') +
      cards +
      '<div class="grid k3" style="margin-top:18px">' +
      '<div class="panel"><div class="panel-head"><h3>Homework · ' + esc(cur.firstName) + '</h3><a class="link-btn" href="#/homework?child=' + cur.id + '">All →</a></div>' + (hw.length ? '<div class="list">' + hw.map(h => { const done = h.doneBy.includes(cur.id); return '<div class="list-item"><div class="grow"><h4>' + esc(h.title) + '</h4><p>' + esc(h.subject) + '</p></div>' + (done ? '<span class="badge ok">Done</span>' : h.due < t ? '<span class="badge bad">Overdue</span>' : '<span class="meta">Due ' + fmtDate(h.due, 'short') + '</span>') + '</div>'; }).join('') + '</div>' : P.empty('No homework right now.')) + '</div>' +
      '<div class="panel"><div class="panel-head"><h3>Today\'s lessons</h3><a class="link-btn" href="#/timetable?child=' + cur.id + '">Timetable →</a></div>' + (todayLessons.length ? '<div class="list">' + todayLessons.map(x => '<div class="list-item"><div class="grow"><h4>' + esc(x.s) + '</h4></div><span class="meta">' + esc(x.p.time) + '</span></div>').join('') + '</div>' : P.empty('No lessons today — enjoy the weekend!')) + '</div>' +
      '<div class="panel"><div class="panel-head"><h3>Announcements</h3><a class="link-btn" href="#/announcements">All →</a></div>' + annList(ctx.role, 3) + '</div>' +
      '</div><div class="panel" style="margin-top:18px"><h3>Upcoming events</h3>' + eventsList(5) + '</div>';
  }

  /* =================== STUDENTS =================== */
  const STATUSES = ['Active', 'Suspended', 'Withdrawn', 'Graduated'];
  V.students = {
    title: 'Students',
    render(ctx) {
      if (ctx.arg) return studentProfile(ctx);
      const ids = P.myClassIds();
      const q = ctx.q;
      const isAdmin = ctx.role === 'admin';
      const status = q.status || 'Active';
      let list = S.all('students').filter(s => ids.includes(s.classId) && (status === 'All' || s.status === status) && (!q.class || s.classId === q.class) && (!q.gender || s.gender === q.gender));
      if (q.q) { const t = q.q.toLowerCase(); list = list.filter(s => (S.studentName(s) + ' ' + s.otherName + ' ' + s.admNo + ' ' + s.guardianName + ' ' + s.guardianPhone).toLowerCase().includes(t)); }
      list.sort((a, b) => (S.classOf(a).order - S.classOf(b).order) || (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName));
      ctx.mount(() => {
        const tb = $('#stu-toolbar');
        $('#stu-q', tb).addEventListener('change', e => P.setQuery({ q: e.target.value }));
        ['class', 'status', 'gender'].forEach(k => { const el = $('#stu-' + k, tb); if (el) el.onchange = e => P.setQuery({ [k]: e.target.value }); });
        $('#stu-export').onclick = () => U.downloadCSV('students.csv', [['Admission no', 'Surname', 'First name', 'Other name', 'Gender', 'Date of birth', 'Class', 'Status', 'Guardian', 'Guardian phone', 'House', 'Fees status'], ...list.map(s => [s.admNo, s.lastName, s.firstName, s.otherName, s.gender, s.dob, S.classOf(s).name, s.status, s.guardianName, s.guardianPhone, s.house, S.feeStatus(s.id).status])]);
        if (isAdmin) {
          $('#stu-add').onclick = () => studentForm();
          $('#stu-import').onclick = importStudents;
          $('#stu-ids').onclick = () => U.printHTML('ID cards', '<div class="id-sheet">' + list.map(idCard).join('') + '</div>');
        }
        $$('[data-edit]').forEach(b => b.onclick = () => studentForm(S.get('students', b.dataset.edit)));
        if (q.new && isAdmin) { studentForm(); history.replaceState(null, '', P.href('students')); }
      });
      return P.pageHead('Students', list.length + ' student' + (list.length === 1 ? '' : 's') + ' shown', (isAdmin ? '<button class="btn" id="stu-add">+ Add student</button><button class="btn ghost" id="stu-import">Import CSV</button><button class="btn ghost" id="stu-ids">Print ID cards</button>' : '') + '<button class="btn ghost" id="stu-export">Export CSV</button>') +
        '<div class="toolbar" id="stu-toolbar"><label class="sr-only" for="stu-q">Search</label><input class="input grow" id="stu-q" type="search" placeholder="Search name, admission no, guardian… (press Enter)" value="' + attr(q.q || '') + '">' +
        '<label class="sr-only" for="stu-class">Class</label><select class="select" id="stu-class">' + P.classOptions(ids, q.class, { all: 'All classes' }) + '</select>' +
        '<label class="sr-only" for="stu-gender">Gender</label><select class="select" id="stu-gender"><option value="">All genders</option><option' + (q.gender === 'Female' ? ' selected' : '') + '>Female</option><option' + (q.gender === 'Male' ? ' selected' : '') + '>Male</option></select>' +
        '<label class="sr-only" for="stu-status">Status</label><select class="select" id="stu-status">' + ['All', ...STATUSES].map(s => '<option' + (s === status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></div>' +
        '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Admission no.</th><th>Class</th><th>Gender</th><th>Guardian</th><th>Fees</th><th>Status</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(s => '<tr><td><div style="display:flex;gap:10px;align-items:center">' + P.avatar(S.studentName(s), s.gender) + P.studentLink(s) + '</div></td><td>' + esc(s.admNo) + '</td><td>' + esc(S.classOf(s).name) + '</td><td>' + esc(s.gender) + '</td><td>' + esc(s.guardianName) + '<br><small class="muted">' + esc(s.guardianPhone) + '</small></td><td>' + P.statusBadge(S.feeStatus(s.id).status) + '</td><td>' + P.statusBadge(s.status) + '</td><td class="r"><a class="btn sm ghost" href="' + P.href('students', s.id) + '">View</a>' + (isAdmin ? ' <button class="btn sm ghost" data-edit="' + s.id + '">Edit</button>' : '') + '</td></tr>').join('') : '<tr><td colspan="8">' + P.empty('No students match these filters.') + '</td></tr>') +
        '</tbody></table></div></div>';
    }
  };

  function studentForm(s) {
    const isNew = !s;
    s = s || { admNo: S.nextAdmissionNo(), status: 'Active', admittedOn: today(), address: S.settings.town + ', ' + S.settings.state };
    const f = U.field;
    const m = U.modal({
      title: isNew ? 'Add student' : 'Edit ' + S.studentName(s), size: 'lg',
      body: '<form id="stu-form"><div class="form-grid three">' +
        f('firstName', 'First name', { required: true, value: s.firstName }) + f('otherName', 'Other name', { value: s.otherName }) + f('lastName', 'Surname', { required: true, value: s.lastName }) +
        f('admNo', 'Admission no.', { required: true, value: s.admNo }) + f('classId', 'Class', { type: 'select', required: true, options: S.sortedClasses().map(c => ({ value: c.id, label: c.name })), value: s.classId }) + f('gender', 'Gender', { type: 'select', required: true, options: ['Female', 'Male'], value: s.gender }) +
        f('dob', 'Date of birth', { type: 'date', value: s.dob }) + f('admittedOn', 'Date admitted', { type: 'date', value: s.admittedOn }) + f('status', 'Status', { type: 'select', options: STATUSES, value: s.status, placeholder: false }) +
        f('house', 'House', { type: 'select', options: ['St. Peter', 'St. Paul', 'St. Mary', 'St. Joseph'], value: s.house }) + f('bloodGroup', 'Blood group', { type: 'select', options: ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'], value: s.bloodGroup }) + f('genotype', 'Genotype', { type: 'select', options: ['AA', 'AS', 'SS', 'AC', 'SC'], value: s.genotype }) +
        f('guardianName', 'Parent / guardian', { required: true, value: s.guardianName }) + f('guardianPhone', 'Guardian phone', { type: 'tel', required: true, value: s.guardianPhone }) + f('guardianEmail', 'Guardian email', { type: 'email', value: s.guardianEmail }) +
        f('stateOfOrigin', 'State of origin', { value: s.stateOfOrigin }) + f('religion', 'Religion', { value: s.religion }) + f('address', 'Home address', { value: s.address }) +
        f('medical', 'Medical notes / allergies', { type: 'textarea', value: s.medical, full: true, rows: 2 }) +
        '</div></form>',
      foot: (isNew ? '' : '<button class="btn danger" id="stu-del" style="margin-right:auto">Delete</button>') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="stu-save">' + (isNew ? 'Add student' : 'Save changes') + '</button>'
    });
    const form = $('#stu-form', m);
    $('#stu-save', m).onclick = () => {
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const d = U.formData(form);
      const dup = S.find('students', x => x.admNo.toUpperCase() === d.admNo.toUpperCase() && x.id !== s.id);
      if (dup) { U.toast('Admission number ' + d.admNo + ' is already used by ' + S.studentName(dup) + '.', 'bad'); return; }
      if (isNew) { const ns = S.insert('students', Object.assign({ parentIds: [] }, d)); S.log(P.me().id, 'Added student ' + S.studentName(ns) + ' (' + ns.admNo + ').'); U.toast('Student added.'); }
      else { S.update('students', s.id, d); S.log(P.me().id, 'Updated student ' + d.firstName + ' ' + d.lastName + '.'); U.toast('Changes saved.'); }
      U.closeModal(); P.rerender();
    };
    const del = $('#stu-del', m);
    if (del) del.onclick = () => U.confirmBox('Delete ' + S.studentName(s) + ' permanently? This also removes their scores, attendance marks and payments. To keep records, set status to Withdrawn instead.', () => {
      S.data.scores = S.all('scores').filter(x => x.studentId !== s.id);
      S.data.reports = S.all('reports').filter(x => x.studentId !== s.id);
      S.data.payments = S.all('payments').filter(x => x.studentId !== s.id);
      S.all('attendance').forEach(a => { delete a.records[s.id]; });
      S.all('users').forEach(u => { if (u.childIds) u.childIds = u.childIds.filter(id => id !== s.id); });
      S.remove('students', s.id); S.log(P.me().id, 'Deleted student ' + S.studentName(s) + '.');
      U.toast('Student deleted.'); P.go('students');
    }, { danger: true, yes: 'Delete' });
  }

  function importStudents() {
    const m = U.modal({
      title: 'Import students from CSV', size: 'lg',
      body: '<p>Upload a CSV file (e.g. exported from Excel) with a header row. Recognised columns:</p><p><code>Surname, First name, Other name, Gender, Date of birth, Class, Guardian, Guardian phone, Admission no</code></p><p class="hint">Class names must match exactly, e.g. "Primary 4" or "JSS 2". Missing admission numbers are generated automatically.</p>' +
        '<div class="form-actions"><button class="btn ghost" id="csv-tpl">Download template</button></div><div class="field" style="margin-top:14px"><label for="csv-file">CSV file</label><input type="file" id="csv-file" accept=".csv,text/csv"></div><div id="csv-preview"></div>',
      foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="csv-go" disabled>Import</button>'
    });
    let parsed = [];
    $('#csv-tpl', m).onclick = () => U.downloadCSV('students-template.csv', [['Surname', 'First name', 'Other name', 'Gender', 'Date of birth', 'Class', 'Guardian', 'Guardian phone', 'Admission no'], ['Okeke', 'Amaka', 'Grace', 'Female', '2016-04-12', 'Primary 4', 'Mrs. Ifeoma Okeke', '08030000000', '']]);
    $('#csv-file', m).onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      file.text().then(text => {
        const rows = U.parseCSV(text.replace(/^﻿/, ''));
        if (rows.length < 2) { $('#csv-preview', m).innerHTML = '<div class="notice-box warn">No data rows found.</div>'; return; }
        const head = rows[0].map(h => h.trim().toLowerCase());
        const col = names => head.findIndex(h => names.includes(h));
        const c = { last: col(['surname', 'last name', 'lastname']), first: col(['first name', 'firstname']), other: col(['other name', 'other names', 'middle name']), gender: col(['gender', 'sex']), dob: col(['date of birth', 'dob']), cls: col(['class']), g: col(['guardian', 'parent', 'guardian name']), gp: col(['guardian phone', 'phone', 'parent phone']), adm: col(['admission no', 'admission number', 'adm no']) };
        const problems = [];
        parsed = rows.slice(1).map((r, i) => {
          const cls = S.find('classes', x => x.name.toLowerCase() === String(r[c.cls] || '').trim().toLowerCase());
          const rec = { lastName: (r[c.last] || '').trim(), firstName: (r[c.first] || '').trim(), otherName: c.other >= 0 ? (r[c.other] || '').trim() : '', gender: /^f/i.test(r[c.gender] || '') ? 'Female' : 'Male', dob: c.dob >= 0 ? (r[c.dob] || '').trim() : '', classId: cls ? cls.id : null, guardianName: c.g >= 0 ? (r[c.g] || '').trim() : '', guardianPhone: c.gp >= 0 ? (r[c.gp] || '').trim() : '', admNo: c.adm >= 0 ? (r[c.adm] || '').trim() : '' };
          if (!rec.firstName || !rec.lastName) problems.push('Row ' + (i + 2) + ': missing name');
          else if (!rec.classId) problems.push('Row ' + (i + 2) + ': unknown class "' + (r[c.cls] || '') + '"');
          return rec;
        }).filter(r => r.firstName && r.lastName && r.classId);
        $('#csv-preview', m).innerHTML = '<div class="notice-box ' + (problems.length ? 'warn' : 'ok') + '" style="margin-top:14px"><b>' + parsed.length + '</b> students ready to import.' + (problems.length ? '<br>' + problems.slice(0, 6).map(esc).join('<br>') + (problems.length > 6 ? '<br>…and ' + (problems.length - 6) + ' more' : '') : '') + '</div>';
        $('#csv-go', m).disabled = !parsed.length;
      });
    };
    $('#csv-go', m).onclick = () => {
      parsed.forEach(rec => {
        if (!rec.admNo || S.find('students', x => x.admNo === rec.admNo)) rec.admNo = S.nextAdmissionNo();
        S.all('students').push(Object.assign({ id: EPS.uid('stu'), status: 'Active', admittedOn: today(), parentIds: [], house: '', address: '', medical: '' }, rec));
      });
      S.save(); S.log(P.me().id, 'Imported ' + parsed.length + ' students from CSV.');
      U.closeModal(); U.toast(parsed.length + ' students imported.'); P.rerender();
    };
  }

  function idCard(s) {
    const st = S.settings; const c = S.classOf(s) || {};
    return '<div class="id-card"><div class="idh">' + U.crest(26) + '<div><b>' + esc(st.schoolName.toUpperCase()) + '</b><small>' + esc((st.town + ', ' + st.state).toUpperCase()) + '</small></div></div><div class="idb">' + P.avatar(S.studentName(s), s.gender) + '<div><b>' + esc(S.studentName(s, { formal: true })) + '</b>Adm. no: <strong>' + esc(s.admNo) + '</strong><br>Class: ' + esc(c.name) + ' · House: ' + esc(s.house || '—') + '<br>Blood group: ' + esc(s.bloodGroup || '—') + ' · Genotype: ' + esc(s.genotype || '—') + '<br>Emergency: ' + esc(s.guardianPhone || '—') + '</div></div><div class="idf">STUDENT ID · ' + esc(st.session) + '</div></div>';
  }

  function studentProfile(ctx) {
    const s = S.get('students', ctx.arg);
    if (!s || !P.canSeeStudent(s.id)) return P.empty('Student not found.', '<a class="btn" href="#/students">Back to students</a>');
    const tab = ctx.q.tab || 'profile';
    const c = S.classOf(s);
    const isAdmin = ctx.role === 'admin';
    const parents = S.all('users').filter(u => u.role === 'parent' && (u.childIds || []).includes(s.id));
    ctx.mount(() => {
      const e = $('#sp-edit'); if (e) e.onclick = () => studentForm(s);
      const idb = $('#sp-id'); if (idb) idb.onclick = () => U.printHTML('ID card — ' + S.studentName(s), idCard(s));
      const pr = $('#sp-print'); if (pr) pr.onclick = () => U.printHTML('Report card — ' + S.studentName(s), U.reportCard(s.id));
      const pa = $('#sp-parent'); if (pa) pa.onclick = () => P.parentAccountFor(s);
      $$('[data-receipt]').forEach(b => b.onclick = () => U.printHTML('Receipt', U.receipt(b.dataset.receipt)));
      $$('[data-record]').forEach(b => b.onclick = () => P.paymentForm(b.dataset.record));
    });
    const tabs = [['profile', 'Profile'], ['results', 'Results'], ['attendance', 'Attendance'], ['fees', 'Fees']];
    let body = '';
    if (tab === 'profile') body = '<div class="grid k2"><div class="panel"><h3>Personal details</h3><dl class="dl">' +
      [['Full name', S.studentName(s, { formal: true })], ['Gender', s.gender], ['Date of birth', s.dob ? fmtDate(s.dob) + ' (' + U.ageFrom(s.dob) + ' yrs)' : ''], ['State of origin', s.stateOfOrigin], ['Religion', s.religion], ['Address', s.address], ['House', s.house], ['Blood group', s.bloodGroup], ['Genotype', s.genotype], ['Medical notes', s.medical]].map(([k, v]) => '<dt>' + k + '</dt><dd>' + (v ? esc(v) : '<span class="tbc">—</span>') + '</dd>').join('') + '</dl></div>' +
      '<div class="grid"><div class="panel"><h3>School record</h3><dl class="dl">' + [['Admission no.', s.admNo], ['Class', c.name], ['Class teacher', c.teacherId ? S.userName(c.teacherId) : ''], ['Admitted', s.admittedOn ? fmtDate(s.admittedOn) : ''], ['Status', s.status]].map(([k, v]) => '<dt>' + k + '</dt><dd>' + (v ? esc(v) : '<span class="tbc">—</span>') + '</dd>').join('') + '</dl></div>' +
      '<div class="panel"><div class="panel-head"><h3>Parent / guardian</h3>' + (isAdmin ? '<button class="btn sm ghost" id="sp-parent">' + (parents.length ? 'Manage portal access' : 'Create portal login') + '</button>' : '') + '</div><dl class="dl"><dt>Name</dt><dd>' + esc(s.guardianName || '—') + '</dd><dt>Phone</dt><dd>' + (s.guardianPhone ? '<a class="link-btn" href="tel:' + attr(s.guardianPhone) + '">' + esc(s.guardianPhone) + '</a> · <a class="link-btn" target="_blank" rel="noopener" href="' + attr(P.waLink(s.guardianPhone, 'Good day, this is ' + S.settings.schoolName + ' regarding ' + S.studentName(s) + '.')) + '">WhatsApp</a>' : '—') + '</dd><dt>Email</dt><dd>' + esc(s.guardianEmail || '—') + '</dd><dt>Portal accounts</dt><dd>' + (parents.length ? parents.map(p => esc(S.userName(p)) + ' (' + esc(p.username) + ')').join(', ') : '<span class="tbc">None yet</span>') + '</dd></dl></div></div></div>';
    if (tab === 'results') body = '<div class="form-actions" style="margin-bottom:14px"><button class="btn" id="sp-print">🖨 Print report card</button></div>' + U.reportCard(s.id);
    if (tab === 'attendance') body = attendancePanel(s);
    if (tab === 'fees') body = P.feesPanel(s, isAdmin);
    return '<p><a class="link-btn" href="#/students">← All students</a></p><div class="panel" style="margin-bottom:18px"><div class="profile-head">' + P.avatar(S.studentName(s), s.gender, 'xl') + '<div style="flex:1;min-width:200px"><h2>' + esc(S.studentName(s, { formal: true })) + '</h2><p class="muted" style="margin:4px 0">' + esc(s.admNo) + ' · ' + esc(c.name) + ' · ' + esc(s.gender) + '</p>' + P.statusBadge(s.status) + '</div><div class="form-actions">' + (isAdmin ? '<button class="btn ghost" id="sp-edit">Edit</button>' : '') + '<button class="btn ghost" id="sp-id">Print ID card</button></div></div></div>' +
      '<div class="tabs">' + tabs.map(([k, l]) => '<a href="' + P.href('students', s.id, { tab: k }) + '" class="' + (k === tab ? 'active' : '') + '">' + l + '</a>').join('') + '</div>' + body;
  }

  function attendancePanel(s) {
    const a = S.attendanceSummary(s.id);
    return '<div class="grid k2"><div class="panel"><h3>' + esc(S.termLabel()) + ' summary</h3><div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">' + U.donut(a.pct || 0, 'attendance', a.pct >= 90 ? 'var(--green)' : a.pct >= 75 ? 'var(--gold)' : 'var(--red)') + '<dl class="dl" style="grid-template-columns:auto auto"><dt>Days recorded</dt><dd>' + a.total + '</dd><dt>Present</dt><dd>' + a.present + '</dd><dt>Late</dt><dd>' + a.late + '</dd><dt>Absent</dt><dd>' + a.absent + '</dd></dl></div></div>' +
      '<div class="panel"><h3>Daily record</h3>' + (a.days.length ? '<div class="att-days">' + a.days.slice().reverse().map(d => '<div><span class="mark ' + d.mark + '" title="' + attr(fmtDate(d.date)) + '">' + d.mark + '</span><br>' + esc(fmtDate(d.date, 'day').replace(/^\w+,?\s/, '')) + '</div>').join('') + '</div><p class="hint" style="margin-top:12px"><span class="mark P">P</span> Present · <span class="mark L">L</span> Late · <span class="mark A">A</span> Absent</p>' : P.empty('No attendance recorded yet.')) + '</div></div>';
  }
  P.attendancePanel = attendancePanel;
  P.idCard = idCard;

  /* =================== STAFF & USERS =================== */
  V.staff = {
    title: 'Staff & users',
    render(ctx) {
      const role = ctx.q.role || 'teacher';
      const list = S.all('users').filter(u => u.role === role).sort((a, b) => a.lastName.localeCompare(b.lastName));
      ctx.mount(() => {
        $('#u-add').onclick = () => userForm({ role });
        $$('[data-u]').forEach(b => b.onclick = () => userForm(S.get('users', b.dataset.u)));
        $('#u-export').onclick = () => U.downloadCSV(role + '-accounts.csv', [['Name', 'Username', 'Role', 'Position', 'Phone', 'Email', 'Active'], ...list.map(u => [S.userName(u), u.username, u.role, u.position || '', u.phone || '', u.email || '', u.active !== false ? 'Yes' : 'No'])]);
      });
      const tabs = [['teacher', 'Teachers'], ['admin', 'Administrators'], ['parent', 'Parents'], ['student', 'Student logins']];
      return P.pageHead('Staff & user accounts', 'Create logins, assign classes and reset passwords.', '<button class="btn" id="u-add">+ Add ' + ({ teacher: 'teacher', admin: 'administrator', parent: 'parent', student: 'student login' }[role]) + '</button><button class="btn ghost" id="u-export">Export CSV</button>') +
        '<div class="tabs">' + tabs.map(([k, l]) => '<a href="' + P.href('staff', null, { role: k }) + '" class="' + (k === role ? 'active' : '') + '">' + l + ' (' + S.all('users').filter(u => u.role === k).length + ')</a>').join('') + '</div>' +
        '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Name</th><th>Username</th><th>' + (role === 'parent' ? 'Children' : role === 'student' ? 'Student' : role === 'teacher' ? 'Classes' : 'Position') + '</th><th>Phone</th><th>Last sign-in</th><th>Status</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(u => '<tr><td><div style="display:flex;gap:10px;align-items:center">' + P.avatar(S.userName(u)) + '<span><b>' + esc(S.userName(u)) + '</b>' + (u.position ? '<br><small class="muted">' + esc(u.position) + '</small>' : '') + '</span></div></td><td>' + esc(u.username) + '</td><td>' +
          (role === 'parent' ? (u.childIds || []).map(id => { const s = S.get('students', id); return s ? P.studentLink(s) : ''; }).join(', ') : role === 'student' ? (S.get('students', u.studentId) ? P.studentLink(S.get('students', u.studentId)) : '—') : role === 'teacher' ? classNamesFor(u) : esc(u.position || '')) +
          '</td><td>' + esc(u.phone || '—') + '</td><td>' + (u.lastLogin ? U.relTime(u.lastLogin) : '<span class="muted">Never</span>') + '</td><td>' + (u.active !== false ? '<span class="badge ok">Active</span>' : '<span class="badge bad">Disabled</span>') + '</td><td class="r"><button class="btn sm ghost" data-u="' + u.id + '">Edit</button></td></tr>').join('') : '<tr><td colspan="7">' + P.empty('No accounts yet.') + '</td></tr>') +
        '</tbody></table></div></div>';
    }
  };
  function classNamesFor(u) {
    const ids = new Set(u.classIds || []);
    S.all('classes').forEach(c => { if (c.teacherId === u.id) ids.add(c.id); });
    return S.sortedClasses().filter(c => ids.has(c.id)).map(c => esc(c.name) + (c.teacherId === u.id ? ' ★' : '')).join(', ') || '<span class="muted">None</span>';
  }
  function userForm(u) {
    const isNew = !u.id;
    const role = u.role;
    const f = U.field;
    const classes = S.sortedClasses();
    const students = S.all('students').filter(s => s.status === 'Active').sort((a, b) => a.lastName.localeCompare(b.lastName));
    const pass = isNew ? Math.random().toString(36).slice(2, 8) : '';
    const m = U.modal({
      title: isNew ? 'New ' + role + ' account' : 'Edit ' + S.userName(u), size: 'lg',
      body: '<form id="u-form"><div class="form-grid three">' +
        f('title', 'Title', { type: 'select', options: ['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Rev.', 'Rev. Fr.', 'Rev. Sr.', 'Chief', 'Barr.', 'Engr.'], value: u.title }) + f('firstName', 'First name', { required: true, value: u.firstName }) + f('lastName', 'Surname', { required: true, value: u.lastName }) +
        f('username', 'Username', { required: true, value: u.username, hint: 'Used to sign in.' }) + f('password', isNew ? 'Password' : 'New password', { value: pass, hint: isNew ? 'Share this with the user — they can change it.' : 'Leave blank to keep the current password.' }) + f('active', 'Status', { type: 'select', options: [{ value: 'yes', label: 'Active' }, { value: 'no', label: 'Disabled' }], value: u.active === false ? 'no' : 'yes', placeholder: false }) +
        f('phone', 'Phone', { type: 'tel', value: u.phone }) + f('email', 'Email', { type: 'email', value: u.email }) + (role === 'admin' || role === 'teacher' ? f('position', 'Position / role', { value: u.position, placeholder: role === 'teacher' ? 'e.g. Mathematics teacher' : 'e.g. Bursar' }) : '<div></div>') +
        '</div>' +
        (role === 'teacher' ? '<fieldset class="field full" style="border:1px solid var(--line);border-radius:8px;padding:12px;margin-top:14px"><legend style="font-size:11px;font-weight:800;letter-spacing:.6px">CLASSES THIS TEACHER CAN ACCESS</legend><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px">' + classes.map(c => '<label class="check"><input type="checkbox" name="cls" value="' + c.id + '"' + ((u.classIds || []).includes(c.id) || c.teacherId === u.id && u.id ? ' checked' : '') + '> ' + esc(c.name) + '</label>').join('') + '</div><small class="hint">Class-teacher roles are set on the Classes page.</small></fieldset>' : '') +
        (role === 'parent' ? '<div class="field full" style="margin-top:14px"><label for="u-kids">Children (hold Ctrl / ⌘ to select several)</label><select id="u-kids" name="kids" multiple size="8" class="input" style="height:auto">' + students.map(s => '<option value="' + s.id + '"' + ((u.childIds || []).includes(s.id) ? ' selected' : '') + '>' + esc(S.studentName(s, { formal: true }) + ' — ' + S.classOf(s).name + ' (' + s.admNo + ')') + '</option>').join('') + '</select></div>' : '') +
        (role === 'student' ? '<div class="field full" style="margin-top:14px"><label for="u-stu">Student</label><select id="u-stu" name="studentId" required class="input"><option value="">Select…</option>' + students.map(s => '<option value="' + s.id + '"' + (u.studentId === s.id ? ' selected' : '') + '>' + esc(S.studentName(s, { formal: true }) + ' — ' + S.classOf(s).name) + '</option>').join('') + '</select></div>' : '') +
        '</form>',
      foot: (!isNew && u.id !== P.me().id ? '<button class="btn danger" id="u-del" style="margin-right:auto">Delete</button>' : '') + (!isNew && (u.phone) ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + attr(P.waLink(u.phone, 'Your ' + S.settings.schoolName + ' portal username is ' + u.username + '.')) + '">Send login via WhatsApp</a>' : '') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="u-save">' + (isNew ? 'Create account' : 'Save') + '</button>'
    });
    const form = $('#u-form', m);
    $('#u-save', m).onclick = async () => {
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const d = U.formData(form);
      d.username = d.username.toLowerCase();
      if (S.cloud && !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(d.username)) { U.toast('Username must be 3–40 letters, numbers, dots, dashes or underscores.', 'warn'); return; }
      if (S.cloud && d.password && d.password.length < 6) { U.toast('Use a password of at least 6 characters.', 'warn'); return; }
      const before = { username: u.username, active: u.active !== false };
      if (S.find('users', x => x.username.toLowerCase() === d.username.toLowerCase() && x.id !== u.id)) { U.toast('That username is already taken.', 'bad'); return; }
      if (isNew && !d.password) { U.toast('Please set a password.', 'warn'); return; }
      if (u.id === P.me().id && d.active === 'no') { U.toast('You cannot disable your own account.', 'warn'); return; }
      const rec = { title: d.title, firstName: d.firstName, lastName: d.lastName, username: d.username, phone: d.phone, email: d.email, position: d.position || '', active: d.active !== 'no', role };
      if (d.password && !S.cloud) rec.password = d.password;
      if (role === 'teacher') rec.classIds = $$('input[name=cls]:checked', form).map(i => i.value);
      if (role === 'parent') rec.childIds = Array.from($('#u-kids', form).selectedOptions).map(o => o.value);
      if (role === 'student') rec.studentId = d.studentId;
      let saved;
      if (isNew) saved = S.insert('users', rec); else saved = S.update('users', u.id, rec);
      if (role === 'parent') S.all('students').forEach(s => { s.parentIds = (s.parentIds || []).filter(id => id !== saved.id); if (rec.childIds.includes(s.id)) s.parentIds.push(saved.id); });
      S.save(); S.log(P.me().id, (isNew ? 'Created' : 'Updated') + ' ' + role + ' account ' + S.userName(saved) + '.');
      if (S.cloud) {
        // Logins live in Supabase Auth and are managed by the admin-users server function.
        const btn = $('#u-save', m); btn.disabled = true; btn.textContent = 'Saving…';
        try {
          await EPS.Cloud.flush();
          if (!saved.authId) {
            if (d.password) { const r = await EPS.Cloud.admin('create', { userId: saved.id, username: saved.username, password: d.password }); saved.authId = r.authId; EPS.Cloud.markSynced('users', saved.id); }
          } else {
            const patch = {};
            if (saved.username !== before.username) patch.username = saved.username;
            if (d.password) patch.password = d.password;
            if ((saved.active !== false) !== before.active) patch.active = saved.active !== false;
            if (Object.keys(patch).length) await EPS.Cloud.admin('update', Object.assign({ userId: saved.id }, patch));
          }
        } catch (e) {
          btn.disabled = false; btn.textContent = 'Save';
          U.toast('The account was saved, but its login could not be updated: ' + e.message, 'bad');
          return;
        }
      }
      U.closeModal();
      if (isNew) U.modal({ title: 'Account created', size: 'sm', body: '<p>Share these sign-in details with <b>' + esc(S.userName(saved)) + '</b>:</p><div class="notice-box">Portal: <b>' + esc(location.href.split('#')[0]) + '</b><br>Username: <b>' + esc(saved.username) + '</b><br>Password: <b>' + esc(d.password) + '</b></div>' + (saved.phone ? '<p style="margin-top:12px"><a class="btn" target="_blank" rel="noopener" href="' + attr(P.waLink(saved.phone, 'Welcome to the ' + S.settings.schoolName + ' portal. Sign in at ' + location.href.split('#')[0] + ' — username: ' + saved.username + ', password: ' + d.password + '. Please change your password after signing in.')) + '">Send via WhatsApp</a></p>' : ''), foot: '<button class="btn" data-close>Done</button>' });
      else U.toast('Account saved.');
      P.rerender();
    };
    const del = $('#u-del', m);
    if (del) del.onclick = () => U.confirmBox('Delete the account for ' + S.userName(u) + '? They will no longer be able to sign in.', async () => {
      if (S.cloud && u.authId) { try { await EPS.Cloud.admin('delete', { userId: u.id }); } catch (e) { U.toast('Could not remove the login: ' + e.message, 'bad'); return; } }
      S.all('classes').forEach(c => { if (c.teacherId === u.id) c.teacherId = null; });
      S.all('students').forEach(s => { if (s.parentIds) s.parentIds = s.parentIds.filter(id => id !== u.id); });
      S.remove('users', u.id); S.log(P.me().id, 'Deleted account ' + S.userName(u) + '.'); U.toast('Account deleted.'); P.rerender();
    }, { danger: true, yes: 'Delete' });
  }
  /** Quick parent-login creation from a student's guardian details. */
  P.parentAccountFor = s => {
    const existing = S.all('users').find(u => u.role === 'parent' && (u.childIds || []).includes(s.id));
    if (existing) { userForm(existing); return; }
    const phoneMatch = S.find('users', u => u.role === 'parent' && u.phone && u.phone.replace(/\D/g, '') === String(s.guardianPhone).replace(/\D/g, ''));
    if (phoneMatch) { U.confirmBox('A parent account with phone ' + s.guardianPhone + ' already exists (' + S.userName(phoneMatch) + '). Link ' + s.firstName + ' to it?', () => { phoneMatch.childIds = [...new Set([...(phoneMatch.childIds || []), s.id])]; s.parentIds = [...new Set([...(s.parentIds || []), phoneMatch.id])]; S.save(); U.toast('Linked to ' + S.userName(phoneMatch) + '.'); P.rerender(); }, { yes: 'Link' }); return; }
    const parts = String(s.guardianName || '').split(/\s+/);
    const title = /^(mr|mrs|miss|ms|dr|chief|rev)\.?$/i.test(parts[0]) ? parts.shift() : 'Mr.';
    const last = parts.pop() || s.lastName;
    let base = (parts[0] || 'parent').toLowerCase() + '.' + last.toLowerCase(), uname = base, i = 1;
    while (S.find('users', u => u.username === uname)) uname = base + (++i);
    userForm({ role: 'parent', title: title.replace(/^(\w)/, c => c.toUpperCase()).replace(/\.?$/, '.'), firstName: parts.join(' ') || 'Parent', lastName: last, username: uname, phone: s.guardianPhone, email: s.guardianEmail, childIds: [s.id] });
  };

  /* =================== CLASSES =================== */
  V.classes = {
    title: 'Classes',
    render(ctx) {
      const teachers = S.all('users').filter(u => u.role === 'teacher' && u.active !== false);
      ctx.mount(() => {
        $$('[data-ct]').forEach(sel => sel.onchange = () => { const c = S.get('classes', sel.dataset.ct); S.update('classes', c.id, { teacherId: sel.value || null }); S.log(P.me().id, 'Set class teacher of ' + c.name + ' to ' + (sel.value ? S.userName(sel.value) : 'none') + '.'); U.toast('Class teacher updated.'); });
        $$('[data-subj]').forEach(b => b.onclick = () => editSubjects(b.dataset.subj));
        $('#promote').onclick = promote;
        $('#cls-add').onclick = () => {
          const m = U.modal({ title: 'Add class / arm', size: 'sm', body: '<form id="cf"><div class="form-grid" style="grid-template-columns:1fr">' + U.field('name', 'Class name', { required: true, placeholder: 'e.g. JSS 1 B' }) + U.field('group', 'Curriculum', { type: 'select', required: true, options: [{ value: 'nursery', label: 'Nursery' }, { value: 'primary', label: 'Primary' }, { value: 'junior', label: 'Junior Secondary' }, { value: 'senior', label: 'Senior Secondary' }] }) + U.field('after', 'Position after', { type: 'select', options: S.sortedClasses().map(c => ({ value: c.id, label: c.name })), placeholder: 'At the end' }) + '</div></form>', foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="cf-save">Add</button>' });
          $('#cf-save', m).onclick = () => {
            const form = $('#cf', m); if (!form.checkValidity()) { form.reportValidity(); return; }
            const d = U.formData(form);
            const after = d.after ? S.get('classes', d.after) : null;
            const order = after ? after.order + 0.5 : S.all('classes').length;
            const id = EPS.uid('cls');
            S.all('classes').push({ id, name: d.name, group: d.group, section: d.group === 'junior' || d.group === 'senior' ? 'secondary' : d.group, arm: '', teacherId: null, order, capacity: 30 });
            S.sortedClasses().forEach((c, i) => { c.order = i; });
            const subs = S.data.subjects[d.group];
            S.all('timetables').push({ id, classId: id, grid: Object.fromEntries(EPS.DAYS.map(day => [day, S.all('periods').map((p, pi) => p.isBreak ? '' : subs[(pi + day.length) % subs.length])])) });
            S.save(); U.closeModal(); U.toast('Class added.'); P.rerender();
          };
        };
      });
      const groups = [['nursery', 'Nursery'], ['primary', 'Primary'], ['junior', 'Junior Secondary'], ['senior', 'Senior Secondary']];
      return P.pageHead('Classes', S.all('classes').length + ' classes · assign class teachers and manage subjects.', '<button class="btn ghost" id="cls-add">+ Add class / arm</button><button class="btn ghost" id="promote">End of session: promote students</button>') +
        groups.map(([g, label]) => '<div class="panel" style="margin-bottom:18px"><div class="panel-head"><h3>' + label + '</h3><button class="btn sm ghost" data-subj="' + g + '">Subjects (' + (S.data.subjects[g] || []).length + ')</button></div><div class="table-wrap"><table><thead><tr><th>Class</th><th>Students</th><th>Girls / boys</th><th>Class teacher</th><th>Class average</th><th>Fees paid</th><th></th></tr></thead><tbody>' +
          S.sortedClasses().filter(c => c.group === g).map(c => {
            const st = S.classStudents(c.id); const res = S.classResults(c.id);
            const paid = st.filter(s => S.feeStatus(s.id).balance <= 0).length;
            return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + st.length + ' / ' + (c.capacity || 30) + '</td><td>' + st.filter(s => s.gender === 'Female').length + ' / ' + st.filter(s => s.gender === 'Male').length + '</td><td><label class="sr-only" for="ct-' + c.id + '">Class teacher for ' + attr(c.name) + '</label><select class="select" id="ct-' + c.id + '" data-ct="' + c.id + '"><option value="">— None —</option>' + teachers.map(t => '<option value="' + t.id + '"' + (t.id === c.teacherId ? ' selected' : '') + '>' + esc(S.userName(t)) + '</option>').join('') + '</select></td><td>' + num(res.classAvg) + '%</td><td>' + paid + ' / ' + st.length + '</td><td class="r"><a class="btn sm ghost" href="#/students?class=' + c.id + '">Students</a> <a class="btn sm ghost" href="#/reports?class=' + c.id + '">Results</a></td></tr>';
          }).join('') + '</tbody></table></div></div>').join('');
    }
  };
  function editSubjects(group) {
    const m = U.modal({ title: 'Subjects — ' + group, body: '<p class="hint">One subject per line. Removing a subject hides it from gradebooks and report cards (existing scores are kept).</p><div class="field"><label for="subj-ta">Subjects</label><textarea id="subj-ta" rows="14">' + esc((S.data.subjects[group] || []).join('\n')) + '</textarea></div>', foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="subj-save">Save subjects</button>' });
    $('#subj-save', m).onclick = () => {
      const list = [...new Set($('#subj-ta', m).value.split('\n').map(s => s.trim()).filter(Boolean))];
      if (!list.length) { U.toast('Add at least one subject.', 'warn'); return; }
      S.data.subjects[group] = list; S.save(); S.log(P.me().id, 'Updated ' + group + ' subjects.');
      U.closeModal(); U.toast('Subjects saved.'); P.rerender();
    };
  }
  function promote() {
    const classes = S.sortedClasses();
    const last = classes.filter(c => c.group === 'senior').pop();
    U.confirmBox('Promote every active student to the next class? Students in ' + (last ? last.name : 'the final class') + ' will be marked Graduated. Make sure report cards are finalised and download a backup first. This cannot be undone automatically.', () => {
      const next = {};
      // Group arms by base name order: each class moves to the next class in order with the same arm letter if one exists
      classes.forEach((c, i) => { next[c.id] = classes[i + 1] ? classes[i + 1].id : null; });
      let moved = 0, grad = 0;
      S.all('students').filter(s => s.status === 'Active').forEach(s => {
        const n = next[s.classId];
        if (s.classId === (last && last.id) || !n) { s.status = 'Graduated'; grad++; } else { s.classId = n; moved++; }
      });
      S.save(); S.log(P.me().id, 'Promoted ' + moved + ' students; ' + grad + ' graduated.');
      U.toast(moved + ' promoted, ' + grad + ' graduated. Remember to update the session in Settings.'); P.rerender();
    }, { yes: 'Promote students', danger: true, title: 'End of session promotion' });
  }

  /* =================== ATTENDANCE =================== */
  V.attendance = {
    title: 'Attendance',
    render(ctx) {
      if (ctx.role === 'parent' || ctx.role === 'student') {
        const kid = P.currentChild(ctx.q);
        if (!kid) return P.empty('No student linked.');
        return P.pageHead('Attendance', esc(S.studentName(kid)) + ' · ' + esc(S.termLabel())) + P.childSwitcher(ctx.q, 'attendance') + attendancePanel(kid);
      }
      const ids = P.myClassIds();
      if (!ids.length) return P.pageHead('Attendance') + P.empty('You are not assigned to any class.');
      const classId = ids.includes(ctx.q.class) ? ctx.q.class : ids[0];
      const date = ctx.q.date || today();
      const mode = ctx.q.mode || 'register';
      const students = S.classStudents(classId);
      const rec = S.get('attendance', classId + '|' + date);
      const marks = Object.assign({}, rec ? rec.records : {});
      const dow = U.parseDate(date).getDay();
      ctx.mount(() => {
        $('#att-class').onchange = e => P.setQuery({ class: e.target.value });
        const dt = $('#att-date'); if (dt) dt.onchange = e => P.setQuery({ date: e.target.value });
        $$('.att-btn').forEach(b => b.onclick = () => {
          marks[b.dataset.s] = b.dataset.v;
          $$('.att-btn[data-s="' + b.dataset.s + '"]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          updateCount();
        });
        const all = $('#att-all'); if (all) all.onclick = () => { students.forEach(s => { marks[s.id] = 'P'; }); $$('.att-btn').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.v === 'P'))); updateCount(); };
        const save = $('#att-save');
        if (save) save.onclick = () => {
          const missing = students.filter(s => !marks[s.id]);
          if (missing.length) { U.toast(missing.length + ' student(s) not marked yet.', 'warn'); return; }
          S.upsert('attendance', { id: classId + '|' + date, classId, date, records: marks, takenBy: P.me().id, takenAt: new Date().toISOString() });
          S.log(P.me().id, 'Took attendance for ' + S.get('classes', classId).name + ' on ' + fmtDate(date, 'short') + '.');
          U.toast('Attendance saved.');
          P.rerender();
        };
        const exp = $('#att-export'); if (exp) exp.onclick = () => {
          const days = [...new Set(S.where('attendance', a => a.classId === classId).map(a => a.date))].sort();
          U.downloadCSV('attendance-' + S.get('classes', classId).name.replace(/\s/g, '') + '.csv', [['Student', 'Admission no', ...days, 'Present', 'Late', 'Absent', '%'], ...students.map(s => { const a = S.attendanceSummary(s.id); return [S.studentName(s, { formal: true }), s.admNo, ...days.map(d => (S.get('attendance', classId + '|' + d) || { records: {} }).records[s.id] || ''), a.present, a.late, a.absent, a.pct == null ? '' : Math.round(a.pct)]; })]);
        };
        function updateCount() { const c = { P: 0, L: 0, A: 0 }; Object.values(marks).forEach(v => c[v]++); const el = $('#att-count'); if (el) el.textContent = c.P + ' present · ' + c.L + ' late · ' + c.A + ' absent · ' + (students.length - c.P - c.L - c.A) + ' unmarked'; }
        updateCount();
      });
      const head = P.pageHead('Attendance', 'Daily class register', '<button class="btn ghost" id="att-export">Export CSV</button>') +
        '<div class="tabs"><a class="' + (mode === 'register' ? 'active' : '') + '" href="' + P.href('attendance', null, { class: classId, date, mode: 'register' }) + '">Take register</a><a class="' + (mode === 'history' ? 'active' : '') + '" href="' + P.href('attendance', null, { class: classId, mode: 'history' }) + '">Term summary</a></div>' +
        '<div class="toolbar"><label for="att-class">Class</label><select class="select" id="att-class">' + P.classOptions(ids, classId) + '</select>' + (mode === 'register' ? '<label for="att-date">Date</label><input class="input" type="date" id="att-date" value="' + attr(date) + '" max="' + today() + '">' : '') + '</div>';
      if (mode === 'history') {
        const days = [...new Set(S.where('attendance', a => a.classId === classId).map(a => a.date))].sort().slice(-15);
        return head + '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Student</th>' + days.map(d => '<th class="c">' + esc(fmtDate(d, 'day').replace(/^\w+,?\s/, '')) + '</th>').join('') + '<th class="c">Present</th><th class="c">Absent</th><th class="c">%</th></tr></thead><tbody>' +
          students.map(s => { const a = S.attendanceSummary(s.id); return '<tr><td>' + P.studentLink(s) + '</td>' + days.map(d => { const v = (S.get('attendance', classId + '|' + d) || { records: {} }).records[s.id]; return '<td class="c">' + (v ? '<span class="mark ' + v + '">' + v + '</span>' : '') + '</td>'; }).join('') + '<td class="c">' + (a.present + a.late) + '</td><td class="c">' + a.absent + '</td><td class="c"><b style="color:' + (a.pct < 75 ? 'var(--red)' : 'inherit') + '">' + (a.pct == null ? '—' : Math.round(a.pct)) + '</b></td></tr>'; }).join('') +
          '</tbody></table></div></div>';
      }
      if (dow === 0 || dow === 6) return head + '<div class="notice-box warn">' + fmtDate(date) + ' is a weekend. Choose a school day.</div>';
      const absentToday = rec ? students.filter(s => rec.records[s.id] === 'A') : [];
      return head + (rec ? '<div class="notice-box ok" style="margin-bottom:14px">Register already taken' + (rec.takenBy ? ' by ' + esc(S.userName(rec.takenBy)) : '') + '. You can update it below.</div>' : '') +
        (absentToday.length ? '<div class="panel" style="margin-bottom:14px"><h3>Absent today — notify parents</h3><div class="list">' + absentToday.map(s => '<div class="list-item"><div class="grow"><h4>' + esc(S.studentName(s)) + '</h4><p>' + esc(s.guardianName) + ' · ' + esc(s.guardianPhone) + '</p></div>' + (s.guardianPhone ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + attr(P.waLink(s.guardianPhone, 'Good day. This is to inform you that ' + S.studentName(s) + ' was marked absent from school today, ' + fmtDate(date) + '. Kindly let us know the reason. — ' + S.settings.schoolName)) + '">WhatsApp parent</a>' : '') + '</div>').join('') + '</div></div>' : '') +
        '<div class="panel flush"><div class="panel-head" style="padding:14px 16px 0"><span id="att-count" class="muted" aria-live="polite"></span><button class="btn sm ghost" id="att-all">Mark all present</button></div><div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>#</th><th>Student</th><th>Admission no.</th><th>Mark</th><th>Term %</th></tr></thead><tbody>' +
        (students.length ? students.map((s, i) => { const a = S.attendanceSummary(s.id); return '<tr><td>' + (i + 1) + '</td><td><div style="display:flex;gap:10px;align-items:center">' + P.avatar(S.studentName(s), s.gender) + esc(S.studentName(s, { formal: true })) + '</div></td><td>' + esc(s.admNo) + '</td><td><div class="att-row" role="group" aria-label="Attendance for ' + attr(S.studentName(s)) + '">' + [['P', 'Present'], ['L', 'Late'], ['A', 'Absent']].map(([v, l]) => '<button type="button" class="att-btn ' + v + '" data-s="' + s.id + '" data-v="' + v + '" aria-pressed="' + (marks[s.id] === v) + '" title="' + l + '">' + v + '</button>').join('') + '</div></td><td>' + (a.pct == null ? '—' : Math.round(a.pct) + '%') + '</td></tr>'; }).join('') : '<tr><td colspan="5">' + P.empty('No students in this class.') + '</td></tr>') +
        '</tbody></table></div><div style="padding:14px 16px"><button class="btn" id="att-save">Save register</button></div></div>';
    }
  };

  /* =================== GRADEBOOK =================== */
  V.gradebook = {
    title: 'Gradebook',
    render(ctx) {
      const ids = P.myClassIds();
      if (!ids.length) return P.pageHead('Gradebook') + P.empty('You are not assigned to any class.');
      const classId = ids.includes(ctx.q.class) ? ctx.q.class : ids[0];
      const cls = S.get('classes', classId);
      const subjects = S.subjectsFor(classId);
      const mode = ctx.q.mode || 'scores';
      const subject = subjects.includes(ctx.q.subject) ? ctx.q.subject : subjects[0];
      const students = S.classStudents(classId);
      const A = EPS.ASSESSMENT;
      ctx.mount(() => {
        $('#gb-class').onchange = e => P.setQuery({ class: e.target.value, subject: '' });
        const sj = $('#gb-subject'); if (sj) sj.onchange = e => P.setQuery({ subject: e.target.value });
        $$('.score-input').forEach(inp => {
          inp.addEventListener('change', () => {
            const max = Number(inp.max), v = inp.value.trim();
            if (v !== '' && (isNaN(v) || Number(v) < 0 || Number(v) > max)) { inp.classList.add('bad'); U.toast('Score must be between 0 and ' + max + '.', 'warn'); return; }
            inp.classList.remove('bad');
            S.setScore(inp.dataset.s, subject, inp.dataset.f, v);
            const sc = S.scoreFor(inp.dataset.s, subject);
            const row = inp.closest('tr');
            const complete = sc.ca1 != null && sc.ca2 != null && sc.exam != null;
            const total = (sc.ca1 || 0) + (sc.ca2 || 0) + (sc.exam || 0);
            $('.tot', row).textContent = complete ? total : '–';
            $('.grd', row).textContent = complete ? EPS.gradeFor(total, cls.section).grade : '–';
            const flag = $('#gb-saved'); flag.textContent = '✓ Saved ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          });
          inp.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const all = $$('.score-input[data-f="' + inp.dataset.f + '"]');
              const i = all.indexOf(inp) + (e.key === 'ArrowUp' ? -1 : 1);
              if (all[i]) { all[i].focus(); all[i].select(); }
            }
          });
        });
        const exp = $('#gb-export'); if (exp) exp.onclick = () => {
          const res = S.classResults(classId);
          U.downloadCSV('broadsheet-' + cls.name.replace(/\s/g, '') + '.csv', [['Student', 'Admission no', ...res.subjects, 'Total', 'Average', 'Position'], ...res.rows.map(r => [S.studentName(r.student, { formal: true }), r.student.admNo, ...r.subjects.map(x => x.complete ? x.total : ''), Math.round(r.total), r.average == null ? '' : r.average.toFixed(1), r.position || ''])]);
        };
        const tpl = $('#gb-tpl'); if (tpl) tpl.onclick = () => U.downloadCSV('scores-' + cls.name.replace(/\s/g, '') + '-' + subject.replace(/\W+/g, '') + '.csv', [['Admission no', 'Student', 'CA1', 'CA2', 'Exam'], ...students.map(s => { const sc = S.scoreFor(s.id, subject) || {}; return [s.admNo, S.studentName(s, { formal: true }), sc.ca1 ?? '', sc.ca2 ?? '', sc.exam ?? '']; })]);
        const imp = $('#gb-import'); if (imp) imp.onchange = e => {
          const file = e.target.files[0]; if (!file) return;
          file.text().then(text => {
            const rows = U.parseCSV(text.replace(/^﻿/, '')).slice(1);
            let n = 0, bad = 0;
            rows.forEach(r => {
              const s = students.find(x => x.admNo === String(r[0]).trim());
              if (!s) { bad++; return; }
              [['ca1', 2, A.ca1], ['ca2', 3, A.ca2], ['exam', 4, A.exam]].forEach(([f, i, max]) => { const v = String(r[i] ?? '').trim(); if (v !== '' && !isNaN(v) && +v >= 0 && +v <= max) { const sc = S.scoreFor(s.id, subject); if (!sc) S.setScore(s.id, subject, f, v); else sc[f] = +v; } });
              n++;
            });
            S.save(); U.toast('Imported scores for ' + n + ' students' + (bad ? ' (' + bad + ' rows not matched)' : '') + '.', bad ? 'warn' : 'ok'); P.rerender();
          });
        };
      });
      const head = P.pageHead('Gradebook', esc(S.settings.session) + ' · ' + esc(S.termLabel()) + ' · CA1 /' + A.ca1 + ', CA2 /' + A.ca2 + ', Exam /' + A.exam, mode === 'broadsheet' ? '<button class="btn ghost" id="gb-export">Export broadsheet CSV</button>' : '<button class="btn ghost" id="gb-tpl">Download sheet</button><label class="btn ghost" for="gb-import" style="cursor:pointer">Upload sheet<input type="file" id="gb-import" accept=".csv" class="sr-only"></label>') +
        '<div class="tabs"><a class="' + (mode === 'scores' ? 'active' : '') + '" href="' + P.href('gradebook', null, { class: classId, subject, mode: 'scores' }) + '">Enter scores</a><a class="' + (mode === 'broadsheet' ? 'active' : '') + '" href="' + P.href('gradebook', null, { class: classId, mode: 'broadsheet' }) + '">Broadsheet</a></div>' +
        '<div class="toolbar"><label for="gb-class">Class</label><select class="select" id="gb-class">' + P.classOptions(ids, classId) + '</select>' + (mode === 'scores' ? '<label for="gb-subject">Subject</label><select class="select" id="gb-subject">' + subjects.map(s => '<option' + (s === subject ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select><span class="saved-flag" id="gb-saved" aria-live="polite"></span>' : '') + '</div>';
      if (mode === 'broadsheet') {
        const res = S.classResults(classId);
        return head + '<div class="panel flush"><div class="table-wrap"><table class="broadsheet"><thead><tr><th>Pos.</th><th>Student</th>' + res.subjects.map(s => '<th><span class="rot">' + esc(s) + '</span></th>').join('') + '<th>Total</th><th>Avg</th></tr></thead><tbody>' +
          res.rows.slice().sort((a, b) => (a.position || 999) - (b.position || 999)).map(r => '<tr><td><b>' + (r.position ? ordinal(r.position) : '–') + '</b></td><td>' + P.studentLink(r.student) + '</td>' + r.subjects.map(x => '<td class="' + (x.complete && x.total < 40 ? 'g-F' : '') + '">' + (x.complete ? x.total : '<span class="muted">–</span>') + '</td>').join('') + '<td><b>' + Math.round(r.total) + '</b></td><td><b>' + num(r.average) + '</b></td></tr>').join('') +
          '<tr><td></td><td><b>Subject average</b></td>' + res.subjects.map(s => '<td><b>' + num(res.stats[s].avg, 0) + '</b></td>').join('') + '<td></td><td><b>' + num(res.classAvg) + '</b></td></tr></tbody></table></div></div>';
      }
      return head + '<p class="hint">Scores save automatically. Press Enter or ↓ to move to the next student.</p><div class="panel flush"><div class="table-wrap"><table><thead><tr><th>#</th><th>Student</th><th class="c">CA 1 <small>/' + A.ca1 + '</small></th><th class="c">CA 2 <small>/' + A.ca2 + '</small></th><th class="c">Exam <small>/' + A.exam + '</small></th><th class="c">Total</th><th class="c">Grade</th></tr></thead><tbody>' +
        (students.length ? students.map((s, i) => {
          const sc = S.scoreFor(s.id, subject) || {};
          const complete = sc.ca1 != null && sc.ca2 != null && sc.exam != null;
          const total = (sc.ca1 || 0) + (sc.ca2 || 0) + (sc.exam || 0);
          const inp = (f, max) => '<input class="score-input" type="number" inputmode="decimal" min="0" max="' + max + '" step="0.5" data-s="' + s.id + '" data-f="' + f + '" value="' + attr(sc[f] ?? '') + '" aria-label="' + attr(f.toUpperCase() + ' for ' + S.studentName(s)) + '">';
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(S.studentName(s, { formal: true })) + '<br><small class="muted">' + esc(s.admNo) + '</small></td><td class="c">' + inp('ca1', A.ca1) + '</td><td class="c">' + inp('ca2', A.ca2) + '</td><td class="c">' + inp('exam', A.exam) + '</td><td class="c"><b class="tot">' + (complete ? total : '–') + '</b></td><td class="c"><b class="grd">' + (complete ? EPS.gradeFor(total, cls.section).grade : '–') + '</b></td></tr>';
        }).join('') : '<tr><td colspan="7">' + P.empty('No students in this class.') + '</td></tr>') + '</tbody></table></div></div>';
    }
  };

  /* =================== REPORT CARDS (staff) =================== */
  V.reports = {
    title: 'Report cards',
    render(ctx) {
      const ids = P.myClassIds();
      if (!ids.length) return P.pageHead('Report cards') + P.empty('You are not assigned to any class.');
      const classId = ids.includes(ctx.q.class) ? ctx.q.class : ids[0];
      const res = S.classResults(classId);
      const isAdmin = ctx.role === 'admin';
      const open = ctx.q.student;
      ctx.mount(() => {
        $('#rp-class').onchange = e => P.setQuery({ class: e.target.value, student: '' });
        $('#rp-print-all').onclick = () => U.printHTML('Report cards — ' + res.cls.name, res.rows.map(r => U.reportCard(r.student.id)).join(''));
        $$('[data-view]').forEach(b => b.onclick = () => { const m = U.modal({ title: 'Report card', size: 'xl', body: U.reportCard(b.dataset.view), foot: '<button class="btn" id="rc-print">🖨 Print</button>' }); $('#rc-print', m).onclick = () => U.printHTML('Report card', U.reportCard(b.dataset.view)); });
        $$('[data-remarks]').forEach(b => b.onclick = () => remarksForm(b.dataset.remarks, isAdmin));
        $('#rp-auto').onclick = () => U.confirmBox('Fill empty teacher remarks for ' + res.cls.name + ' with suggestions based on each student\'s average? Existing remarks are kept.', () => {
          let n = 0; res.rows.forEach(r => { const rep = S.report(r.student.id, null, null, true); if (!rep.teacherRemark && r.average != null) { rep.teacherRemark = EPS.autoRemark(r.average); n++; } }); S.save(); U.toast(n + ' remarks added.'); P.rerender();
        }, { yes: 'Fill remarks' });
        if (open) { const b = $('[data-remarks="' + open + '"]'); if (b) b.click(); }
      });
      return P.pageHead('Report cards', esc(res.cls.name) + ' · ' + esc(S.termLabel()) + ' ' + esc(S.settings.session) + ' · class average ' + num(res.classAvg) + '%', '<button class="btn ghost" id="rp-auto">Suggest remarks</button><button class="btn" id="rp-print-all">🖨 Print all (' + res.rows.length + ')</button>') +
        '<div class="toolbar"><label for="rp-class">Class</label><select class="select" id="rp-class">' + P.classOptions(ids, classId) + '</select></div>' +
        '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Pos.</th><th>Student</th><th class="c">Subjects scored</th><th class="c">Average</th><th>Teacher\'s remark</th><th class="c">Conduct</th><th></th></tr></thead><tbody>' +
        res.rows.slice().sort((a, b) => (a.position || 999) - (b.position || 999)).map(r => {
          const rep = S.report(r.student.id);
          const rated = Object.keys(rep.affective || {}).length > 0;
          return '<tr><td><b>' + (r.position ? ordinal(r.position) : '–') + '</b></td><td>' + P.studentLink(r.student) + '</td><td class="c">' + r.count + ' / ' + res.subjects.length + '</td><td class="c"><b>' + num(r.average) + '%</b></td><td>' + (rep.teacherRemark ? '<small>' + esc(rep.teacherRemark) + '</small>' : '<span class="badge warn">Not written</span>') + '</td><td class="c">' + (rated ? '<span class="badge ok">Rated</span>' : '<span class="badge warn">Pending</span>') + '</td><td class="r" style="white-space:nowrap"><button class="btn sm ghost" data-remarks="' + r.student.id + '">Remarks</button> <button class="btn sm" data-view="' + r.student.id + '">View</button></td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }
  };
  function remarksForm(studentId, isAdmin) {
    const s = S.get('students', studentId);
    const rep = S.report(studentId, null, null, true);
    const r = S.studentResult(studentId);
    const rating = (group, traits) => '<div style="display:grid;gap:8px">' + traits.map(t => '<label style="display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:13px">' + esc(t) + '<select class="select" data-g="' + group + '" data-t="' + attr(t) + '">' + [5, 4, 3, 2, 1].map(n => '<option value="' + n + '"' + (Number((rep[group] || {})[t] || 4) === n ? ' selected' : '') + '>' + n + ' — ' + ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][n] + '</option>').join('') + '</select></label>').join('') + '</div>';
    const m = U.modal({
      title: 'Remarks — ' + S.studentName(s), size: 'lg',
      body: '<p class="muted">Average: <b>' + num(r.row.average) + '%</b> · Position: <b>' + (r.row.position ? ordinal(r.row.position) + ' of ' + r.count : '—') + '</b></p>' +
        '<div class="field"><label for="rm-t">Class teacher\'s remark</label><textarea id="rm-t" rows="3" placeholder="' + attr(r.row.average != null ? EPS.autoRemark(r.row.average) : '') + '">' + esc(rep.teacherRemark) + '</textarea><small class="hint">Leave empty to use the suggested remark shown.</small></div>' +
        (isAdmin ? '<div class="field" style="margin-top:12px"><label for="rm-p">Principal / head teacher\'s remark</label><textarea id="rm-p" rows="2">' + esc(rep.principalRemark) + '</textarea></div>' : '') +
        '<div class="grid k2" style="margin-top:16px"><div><h4 style="margin:0 0 10px">Affective domain</h4>' + rating('affective', EPS.AFFECTIVE_TRAITS) + '</div><div><h4 style="margin:0 0 10px">Psychomotor skills</h4>' + rating('psychomotor', EPS.PSYCHOMOTOR_SKILLS) + '</div></div>',
      foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="rm-save">Save</button>'
    });
    $('#rm-save', m).onclick = () => {
      rep.teacherRemark = $('#rm-t', m).value.trim();
      if (isAdmin) rep.principalRemark = $('#rm-p', m).value.trim();
      rep.affective = rep.affective || {}; rep.psychomotor = rep.psychomotor || {};
      $$('select[data-g]', m).forEach(sel => { rep[sel.dataset.g][sel.dataset.t] = Number(sel.value); });
      S.save(); U.closeModal(); U.toast('Remarks saved.'); P.rerender();
    };
  }

  /* =================== RESULTS (parent / student) =================== */
  V.results = {
    title: 'Results',
    render(ctx) {
      const kid = P.currentChild(ctx.q);
      if (!kid) return P.empty('No student linked.');
      const st = S.settings;
      const res = S.studentResult(kid.id);
      const owing = ctx.role !== 'admin' && st.blockResultsIfOwing && S.feeStatus(kid.id).balance > 0;
      ctx.mount(() => { const b = $('#res-print'); if (b) b.onclick = () => U.printHTML('Report card — ' + S.studentName(kid), U.reportCard(kid.id)); });
      if (owing) return P.pageHead('Results', esc(S.studentName(kid))) + P.childSwitcher(ctx.q, 'results') + '<div class="notice-box warn">The report card for this term will be available once the fees balance is cleared. <a href="#/fees?child=' + kid.id + '">View fees</a>.</div>';
      const subj = res ? res.row.subjects.filter(x => x.complete) : [];
      return P.pageHead('Results', esc(S.studentName(kid)) + ' · ' + esc((S.classOf(kid) || {}).name) + ' · ' + esc(S.termLabel()) + ' ' + esc(st.session), '<button class="btn" id="res-print">🖨 Print / save PDF</button>') + P.childSwitcher(ctx.q, 'results') +
        (res ? '<div class="grid k4" style="margin-bottom:18px">' + P.kpi('📊', 'Average', num(res.row.average) + '%', 'Class average ' + num(res.classAvg) + '%') + P.kpi('🏅', 'Position', res.row.position ? ordinal(res.row.position) : '—', 'out of ' + res.count) + P.kpi('⭐', 'Best subject', subj.length ? esc(subj.slice().sort((a, b) => b.total - a.total)[0].subject) : '—', '') + P.kpi('🎯', 'Needs attention', subj.filter(x => x.total < 50).length, 'subjects below 50') + '</div>' +
          '<div class="panel" style="margin-bottom:18px"><h3>Subject performance</h3>' + U.barChart(subj.map(x => ({ label: x.subject, value: x.total, color: x.total >= 70 ? 'var(--green)' : x.total >= 50 ? 'var(--blue)' : 'var(--red)' })), { format: v => v + '%' }) + '</div>' : '') +
        U.reportCard(kid.id);
    }
  };

  /* =================== HOMEWORK =================== */
  V.homework = {
    title: 'Homework',
    render(ctx) {
      const t = today();
      if (ctx.role === 'parent' || ctx.role === 'student') {
        const kid = P.currentChild(ctx.q);
        if (!kid) return P.empty('No student linked.');
        const list = S.where('homework', h => h.classId === kid.classId).sort((a, b) => b.due.localeCompare(a.due));
        ctx.mount(() => $$('[data-done]').forEach(b => b.onclick = async () => {
          const h = S.get('homework', b.dataset.done);
          if (S.cloud) {
            b.disabled = true;
            try { h.doneBy = await EPS.Cloud.rpc('toggle_homework', { p_homework: h.id, p_student: kid.id }); EPS.Cloud.markSynced('homework', h.id); }
            catch (e) { U.toast(e.message, 'bad'); }
            P.rerender(); return;
          }
          const i = h.doneBy.indexOf(kid.id); if (i >= 0) h.doneBy.splice(i, 1); else h.doneBy.push(kid.id); S.save(); P.rerender();
        }));
        return P.pageHead('Homework', esc(S.studentName(kid)) + ' · ' + esc((S.classOf(kid) || {}).name)) + P.childSwitcher(ctx.q, 'homework') +
          (list.length ? '<div class="grid">' + list.map(h => { const done = h.doneBy.includes(kid.id); const over = !done && h.due < t; return '<div class="panel hw' + (done ? ' done' : over ? ' overdue' : '') + '"><div class="panel-head"><div><small class="muted">' + esc(h.subject) + ' · set by ' + esc(S.userName(h.teacherId)) + '</small><h3>' + esc(h.title) + '</h3></div>' + (done ? '<span class="badge ok">Done</span>' : over ? '<span class="badge bad">Overdue</span>' : '<span class="badge info">Due ' + fmtDate(h.due, 'day') + '</span>') + '</div><p style="margin:0 0 12px">' + esc(h.details) + '</p><button class="btn sm ' + (done ? 'ghost' : 'ok') + '" data-done="' + h.id + '">' + (done ? 'Mark as not done' : '✓ Mark as done') + '</button></div>'; }).join('') + '</div>' : P.empty('No homework has been set yet.'));
      }
      const ids = P.myClassIds();
      const classId = ctx.q.class && ids.includes(ctx.q.class) ? ctx.q.class : '';
      const list = S.where('homework', h => ids.includes(h.classId) && (!classId || h.classId === classId)).sort((a, b) => b.due.localeCompare(a.due));
      ctx.mount(() => {
        $('#hw-class').onchange = e => P.setQuery({ class: e.target.value });
        $('#hw-add').onclick = () => hwForm(null, ids, classId);
        $$('[data-hw]').forEach(b => b.onclick = () => hwForm(S.get('homework', b.dataset.hw), ids));
        if (ctx.q.new) { hwForm(null, ids, classId); history.replaceState(null, '', P.href('homework')); }
      });
      return P.pageHead('Homework', 'Set assignments and see who has completed them.', '<button class="btn" id="hw-add">+ Set homework</button>') +
        '<div class="toolbar"><label for="hw-class">Class</label><select class="select" id="hw-class">' + P.classOptions(ids, classId, { all: 'All my classes' }) + '</select></div>' +
        '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Homework</th><th>Class</th><th>Subject</th><th>Due</th><th>Completed</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(h => { const n = S.classStudents(h.classId).length; return '<tr><td><b>' + esc(h.title) + '</b><br><small class="muted">' + esc(h.details.slice(0, 80)) + (h.details.length > 80 ? '…' : '') + '</small></td><td>' + esc((S.get('classes', h.classId) || {}).name) + '</td><td>' + esc(h.subject) + '</td><td>' + fmtDate(h.due, 'short') + (h.due < t ? ' <span class="badge">Past</span>' : '') + '</td><td>' + h.doneBy.length + ' / ' + n + '</td><td class="r"><button class="btn sm ghost" data-hw="' + h.id + '">Edit</button></td></tr>'; }).join('') : '<tr><td colspan="6">' + P.empty('No homework set yet.') + '</td></tr>') +
        '</tbody></table></div></div>';
    }
  };
  function hwForm(h, ids, classId) {
    const isNew = !h;
    h = h || { classId: classId || ids[0], due: EPS.isoDate(new Date(Date.now() + 2 * 864e5)), doneBy: [] };
    const m = U.modal({
      title: isNew ? 'Set homework' : 'Edit homework', size: 'lg',
      body: '<form id="hw-form"><div class="form-grid">' + U.field('classId', 'Class', { type: 'select', required: true, options: S.sortedClasses().filter(c => ids.includes(c.id)).map(c => ({ value: c.id, label: c.name })), value: h.classId, placeholder: false }) +
        '<div class="field"><label for="hw-subj">Subject</label><select id="hw-subj" name="subject" required></select></div>' +
        U.field('title', 'Title', { required: true, value: h.title, full: true }) + U.field('details', 'Instructions', { type: 'textarea', required: true, value: h.details, full: true, rows: 5 }) + U.field('due', 'Due date', { type: 'date', required: true, value: h.due }) + '</div></form>',
      foot: (isNew ? '' : '<button class="btn danger" id="hw-del" style="margin-right:auto">Delete</button>') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="hw-save">' + (isNew ? 'Set homework' : 'Save') + '</button>'
    });
    const form = $('#hw-form', m);
    const fillSubj = () => { $('#hw-subj', m).innerHTML = S.subjectsFor(form.classId.value).map(s => '<option' + (s === h.subject ? ' selected' : '') + '>' + esc(s) + '</option>').join(''); };
    form.classId.onchange = fillSubj; fillSubj();
    $('#hw-save', m).onclick = () => {
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const d = U.formData(form);
      if (isNew) { S.insert('homework', Object.assign(d, { teacherId: P.me().id, created: today(), doneBy: [] })); S.log(P.me().id, 'Set homework "' + d.title + '" for ' + S.get('classes', d.classId).name + '.'); }
      else S.update('homework', h.id, d);
      U.closeModal(); U.toast(isNew ? 'Homework set. Parents and students can see it now.' : 'Saved.'); P.rerender();
    };
    const del = $('#hw-del', m); if (del) del.onclick = () => U.confirmBox('Delete this homework?', () => { S.remove('homework', h.id); U.toast('Deleted.'); P.rerender(); }, { danger: true, yes: 'Delete' });
  }

  /* =================== TIMETABLE =================== */
  V.timetable = {
    title: 'Timetable',
    render(ctx) {
      if (ctx.role === 'parent' || ctx.role === 'student') {
        const kid = P.currentChild(ctx.q);
        if (!kid) return P.empty('No student linked.');
        ctx.mount(() => { $('#tt-print').onclick = () => U.printHTML('Timetable', U.schoolHeader('CLASS TIMETABLE · ' + S.classOf(kid).name) + U.timetableHTML(kid.classId)); });
        return P.pageHead('Timetable', esc((S.classOf(kid) || {}).name) + ' · ' + esc(S.termLabel()), '<button class="btn ghost" id="tt-print">🖨 Print</button>') + P.childSwitcher(ctx.q, 'timetable') + '<div class="panel">' + U.timetableHTML(kid.classId, true) + '</div>';
      }
      const ids = ctx.role === 'admin' ? S.sortedClasses().map(c => c.id) : P.myClassIds();
      if (!ids.length) return P.empty('You are not assigned to any class.');
      const classId = ids.includes(ctx.q.class) ? ctx.q.class : ids[0];
      const edit = ctx.q.edit && ctx.role === 'admin';
      const tt = S.get('timetables', classId);
      const periods = S.all('periods');
      ctx.mount(() => {
        $('#tt-class').onchange = e => P.setQuery({ class: e.target.value });
        $('#tt-print').onclick = () => U.printHTML('Timetable', U.schoolHeader('CLASS TIMETABLE · ' + S.get('classes', classId).name) + U.timetableHTML(classId));
        $$('[data-cell]').forEach(sel => sel.onchange = () => { const [day, i] = sel.dataset.cell.split('|'); tt.grid[day][+i] = sel.value; S.save(); $('#tt-saved').textContent = '✓ Saved'; });
      });
      const subjects = [...S.subjectsFor(classId), 'Clubs & Societies', 'Mass / Assembly', 'Library', 'Free period', ''];
      return P.pageHead('Timetables', 'Weekly lesson timetable', '<button class="btn ghost" id="tt-print">🖨 Print</button>' + (ctx.role === 'admin' ? (edit ? '<a class="btn" href="' + P.href('timetable', null, { class: classId }) + '">Done editing</a>' : '<a class="btn" href="' + P.href('timetable', null, { class: classId, edit: 1 }) + '">Edit timetable</a>') : '')) +
        '<div class="toolbar"><label for="tt-class">Class</label><select class="select" id="tt-class">' + P.classOptions(ids, classId) + '</select><span class="saved-flag" id="tt-saved" aria-live="polite"></span></div>' +
        '<div class="panel">' + (edit && tt ? '<div class="table-wrap"><table class="timetable"><thead><tr><th>Day</th>' + periods.map(p => '<th class="' + (p.isBreak ? 'brk' : '') + '">' + esc(p.isBreak ? p.label : 'P' + p.label) + '<small>' + esc(p.time) + '</small></th>').join('') + '</tr></thead><tbody>' +
          EPS.DAYS.map(day => '<tr><th>' + day + '</th>' + periods.map((p, i) => p.isBreak ? '<td class="brk"></td>' : '<td><select class="select" style="min-width:120px;font-size:12px;padding:6px" data-cell="' + day + '|' + i + '" aria-label="' + attr(day + ' period ' + p.label) + '">' + subjects.map(s => '<option' + (s === tt.grid[day][i] ? ' selected' : '') + ' value="' + attr(s) + '">' + esc(s || '—') + '</option>').join('') + '</select></td>').join('') + '</tr>').join('') + '</tbody></table></div>' : U.timetableHTML(classId, true)) + '</div>';
    }
  };

  /* =================== CALENDAR (portal) =================== */
  V.calendar = {
    title: 'School calendar',
    render(ctx) {
      const all = S.all('events').slice().sort((a, b) => a.date.localeCompare(b.date));
      const st = S.settings;
      ctx.mount(() => { $('#cal-ics').onclick = () => U.download('school-calendar.ics', U.icsFor(all.filter(e => (e.endDate || e.date) >= today())), 'text/calendar'); });
      return P.pageHead('School calendar', esc(S.termLabel()) + ': ' + fmtDate(st.termStart) + ' – ' + fmtDate(st.termEnd) + ' · Next term begins ' + fmtDate(st.nextTermBegins), '<button class="btn ghost" id="cal-ics">⬇ Add to my calendar</button>') +
        '<div class="panel">' + (all.length ? '<div class="list">' + all.map(e => { const past = (e.endDate || e.date) < today(); return '<div class="list-item" style="' + (past ? 'opacity:.55' : '') + '"><div class="grow"><h4>' + esc(e.title) + '</h4><p>' + (e.endDate ? fmtDate(e.date) + ' – ' + fmtDate(e.endDate) : fmtDate(e.date)) + (e.time ? ' · ' + esc(e.time) : '') + (e.location ? ' · ' + esc(e.location) : '') + '</p>' + (e.desc ? '<p>' + esc(e.desc) + '</p>' : '') + '</div><span class="badge">' + esc(e.category) + '</span></div>'; }).join('') + '</div>' : P.empty('No events yet.')) + '</div>';
    }
  };
})();
