/* =====================================================================
   Epiphany Schools — portal views: office, communication, website & system
   ===================================================================== */
(function () {
  'use strict';
  const EPS = window.EPS, P = EPS.Portal, S = P.S, U = P.U, $ = P.$, $$ = P.$$;
  const { esc, attr, fmtDate, money } = U;
  const V = P.views;
  const today = EPS.today;
  const me = () => P.me();

  /* =================== FEES =================== */
  P.feesPanel = (s, canRecord) => {
    const f = S.feeStatus(s.id);
    const st = S.settings;
    return '<div class="grid k2"><div class="panel"><div class="panel-head"><h3>' + esc(S.termLabel()) + ' ' + esc(st.session) + '</h3>' + P.statusBadge(f.status) + '</div><div class="table-wrap"><table><tbody>' + f.items.map(i => '<tr><td>' + esc(i.name) + '</td><td class="r">' + money(i.amount) + '</td></tr>').join('') +
      '<tr><td><b>Total due</b></td><td class="r"><b>' + money(f.due) + '</b></td></tr><tr><td>Paid</td><td class="r">' + money(f.paid) + '</td></tr><tr><td><b>Balance</b></td><td class="r"><b style="color:' + (f.balance > 0 ? 'var(--red)' : 'var(--green)') + '">' + money(Math.max(0, f.balance)) + '</b>' + (f.balance < 0 ? '<br><small class="muted">Credit ' + money(-f.balance) + '</small>' : '') + '</td></tr></tbody></table></div>' +
      (canRecord ? '<div class="form-actions" style="margin-top:14px"><button class="btn" data-record="' + s.id + '">Record payment</button>' + (f.balance > 0 && s.guardianPhone ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + attr(P.waLink(s.guardianPhone, reminderText(s, f))) + '">Send reminder</a>' : '') + '</div>' : '') + '</div>' +
      '<div class="panel"><h3>Payment history</h3>' + (f.payments.length ? '<div class="list">' + f.payments.slice().sort((a, b) => b.date.localeCompare(a.date)).map(p => '<div class="list-item"><div class="grow"><h4>' + money(p.amount) + '</h4><p>' + esc(p.receipt) + ' · ' + esc(p.method) + ' · ' + fmtDate(p.date, 'short') + '</p></div><button class="btn sm ghost" data-receipt="' + p.id + '">Receipt</button></div>').join('') + '</div>' : P.empty('No payments recorded this term.')) + '</div></div>';
  };
  const reminderText = (s, f) => 'Good day ' + (s.guardianName || 'Parent') + '. This is a friendly reminder from ' + S.settings.schoolName + ' that ' + S.studentName(s) + '\'s ' + S.termLabel() + ' fees balance is ' + money(f.balance) + '. Kindly use admission number ' + s.admNo + ' as payment reference. Thank you.';

  P.paymentForm = studentId => paymentForm(studentId);
  function paymentForm(studentId) {
    const pre = studentId ? S.get('students', studentId) : null;
    const m = U.modal({
      title: 'Record payment', size: 'lg',
      body: '<form id="pay-form"><div class="form-grid">' +
        '<div class="field"><label for="pf-class">Class</label><select id="pf-class" class="input">' + P.classOptions(null, pre ? pre.classId : null) + '</select></div>' +
        '<div class="field"><label for="pf-stu">Student <span class="req">*</span></label><select id="pf-stu" name="studentId" required class="input"></select></div>' +
        '<div id="pf-bal" class="field full"></div>' +
        U.field('amount', 'Amount (' + S.settings.currency + ')', { type: 'number', required: true, min: 1, step: 'any', inputmode: 'numeric' }) +
        U.field('method', 'Method', { type: 'select', required: true, options: ['Bank transfer', 'POS', 'Cash', 'Online (card)', 'Cheque'], value: 'Bank transfer', placeholder: false }) +
        U.field('date', 'Date', { type: 'date', required: true, value: today(), max: today() }) + U.field('note', 'Reference / note', { placeholder: 'e.g. bank teller no.' }) +
        '</div></form>',
      foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="pf-save">Save & issue receipt</button>'
    });
    const form = $('#pay-form', m), cls = $('#pf-class', m), stu = $('#pf-stu', m);
    const fillStudents = () => { stu.innerHTML = '<option value="">Select…</option>' + S.classStudents(cls.value).map(s => '<option value="' + s.id + '"' + (pre && s.id === pre.id ? ' selected' : '') + '>' + esc(S.studentName(s, { formal: true }) + ' (' + s.admNo + ')') + '</option>').join(''); showBal(); };
    const showBal = () => { const id = stu.value; if (!id) { $('#pf-bal', m).innerHTML = ''; return; } const f = S.feeStatus(id); $('#pf-bal', m).innerHTML = '<div class="notice-box ' + (f.balance > 0 ? 'warn' : 'ok') + '">Due ' + money(f.due) + ' · Paid ' + money(f.paid) + ' · <b>Balance ' + money(Math.max(0, f.balance)) + '</b></div>'; if (f.balance > 0) form.amount.value = f.balance; };
    cls.onchange = fillStudents; stu.onchange = showBal; fillStudents();
    $('#pf-save', m).onclick = () => {
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const d = U.formData(form);
      const p = S.insert('payments', { receipt: S.nextReceiptNo(), studentId: d.studentId, session: S.settings.session, term: S.settings.term, amount: Number(d.amount), method: d.method, date: d.date, note: d.note, receivedBy: me().id });
      const s = S.get('students', d.studentId);
      S.log(me().id, 'Recorded ' + money(p.amount) + ' payment for ' + S.studentName(s) + ' (' + p.receipt + ').');
      U.closeModal();
      const mm = U.modal({ title: 'Payment recorded', size: 'lg', body: U.receipt(p.id), foot: (s.guardianPhone ? '<a class="btn ghost" target="_blank" rel="noopener" href="' + attr(P.waLink(s.guardianPhone, 'Payment received: ' + money(p.amount) + ' for ' + S.studentName(s) + ' (' + p.receipt + '). Balance: ' + money(Math.max(0, S.feeStatus(s.id).balance)) + '. Thank you — ' + S.settings.schoolName)) + '">Send WhatsApp confirmation</a>' : '') + '<button class="btn" id="rc-print">🖨 Print receipt</button>' });
      $('#rc-print', mm).onclick = () => U.printHTML('Receipt ' + p.receipt, U.receipt(p.id));
      P.rerender();
    };
  }

  V.fees = {
    title: 'Fees',
    render(ctx) {
      if (ctx.role === 'parent') return parentFees(ctx);
      const tab = ctx.q.tab || 'payments';
      const st = S.settings;
      const active = S.all('students').filter(s => s.status === 'Active');
      const statuses = active.map(s => ({ s, f: S.feeStatus(s.id) }));
      const due = statuses.reduce((a, x) => a + x.f.due, 0), paid = statuses.reduce((a, x) => a + Math.min(x.f.paid, x.f.due), 0);
      ctx.mount(() => {
        $('#fee-pay').onclick = () => paymentForm();
        $$('[data-record]').forEach(b => b.onclick = () => paymentForm(b.dataset.record));
        $$('[data-receipt]').forEach(b => b.onclick = () => { const mm = U.modal({ title: 'Receipt', size: 'lg', body: U.receipt(b.dataset.receipt), foot: '<button class="btn" id="rc-print">🖨 Print</button>' }); $('#rc-print', mm).onclick = () => U.printHTML('Receipt', U.receipt(b.dataset.receipt)); });
        $$('[data-void]').forEach(b => b.onclick = () => U.confirmBox('Delete this payment record? Use this only to correct a mistake.', () => { const p = S.get('payments', b.dataset.void); S.remove('payments', p.id); S.log(me().id, 'Deleted payment ' + p.receipt + '.'); U.toast('Payment deleted.'); P.rerender(); }, { danger: true, yes: 'Delete' }));
        const f = $('#fee-filter'); if (f) f.onchange = e => P.setQuery({ class: e.target.value });
        const fq = $('#fee-q'); if (fq) fq.onchange = e => P.setQuery({ q: e.target.value });
        const ex = $('#fee-export'); if (ex) ex.onclick = () => {
          if (tab === 'debtors') U.downloadCSV('fee-debtors.csv', [['Student', 'Admission no', 'Class', 'Guardian', 'Phone', 'Due', 'Paid', 'Balance'], ...debtors.map(x => [S.studentName(x.s, { formal: true }), x.s.admNo, S.classOf(x.s).name, x.s.guardianName, x.s.guardianPhone, x.f.due, x.f.paid, x.f.balance])]);
          else U.downloadCSV('payments.csv', [['Receipt', 'Date', 'Student', 'Admission no', 'Class', 'Amount', 'Method', 'Note', 'Received by'], ...pays.map(p => { const s = S.get('students', p.studentId) || {}; return [p.receipt, p.date, S.studentName(s), s.admNo, (S.classOf(s) || {}).name, p.amount, p.method, p.note, S.userName(p.receivedBy)]; })]);
        };
        $$('[data-sched]').forEach(b => b.onclick = () => scheduleForm(b.dataset.sched));
        if (ctx.q.pay) { paymentForm(); history.replaceState(null, '', P.href('fees')); }
      });
      const tabs = [['payments', 'Payments'], ['debtors', 'Outstanding balances'], ['schedule', 'Fee schedule'], ['summary', 'Summary by class']];
      let body = '';
      let pays = [], debtors = [];
      const filterBar = '<div class="toolbar"><label class="sr-only" for="fee-q">Search</label><input class="input grow" id="fee-q" type="search" placeholder="Search student or receipt… (Enter)" value="' + attr(ctx.q.q || '') + '"><label class="sr-only" for="fee-filter">Class</label><select class="select" id="fee-filter">' + P.classOptions(null, ctx.q.class, { all: 'All classes' }) + '</select></div>';
      const match = s => s && (!ctx.q.class || s.classId === ctx.q.class) && (!ctx.q.q || (S.studentName(s) + ' ' + s.admNo).toLowerCase().includes(ctx.q.q.toLowerCase()));
      if (tab === 'payments') {
        pays = S.where('payments', p => p.session === st.session && Number(p.term) === Number(st.term)).filter(p => { const s = S.get('students', p.studentId); return match(s) || (ctx.q.q && p.receipt.toLowerCase().includes(ctx.q.q.toLowerCase())); }).sort((a, b) => b.date.localeCompare(a.date) || b.receipt.localeCompare(a.receipt));
        body = filterBar + '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Student</th><th>Class</th><th class="r">Amount</th><th>Method</th><th></th></tr></thead><tbody>' +
          (pays.length ? pays.map(p => { const s = S.get('students', p.studentId); return '<tr><td>' + esc(p.receipt) + '</td><td>' + fmtDate(p.date, 'short') + '</td><td>' + (s ? P.studentLink(s) : '—') + '</td><td>' + esc((S.classOf(s) || {}).name || '') + '</td><td class="r"><b>' + money(p.amount) + '</b></td><td>' + esc(p.method) + '</td><td class="r" style="white-space:nowrap"><button class="btn sm ghost" data-receipt="' + p.id + '">Receipt</button> <button class="link-btn danger" data-void="' + p.id + '" aria-label="Delete payment ' + attr(p.receipt) + '">Delete</button></td></tr>'; }).join('') : '<tr><td colspan="7">' + P.empty('No payments found.') + '</td></tr>') +
          '</tbody><tfoot><tr><td colspan="4"><b>Total (' + pays.length + ' payments)</b></td><td class="r"><b>' + money(pays.reduce((a, p) => a + p.amount, 0)) + '</b></td><td colspan="2"></td></tr></tfoot></table></div></div>';
      }
      if (tab === 'debtors') {
        debtors = statuses.filter(x => x.f.balance > 0 && match(x.s)).sort((a, b) => b.f.balance - a.f.balance);
        body = filterBar + '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Student</th><th>Class</th><th>Guardian</th><th class="r">Due</th><th class="r">Paid</th><th class="r">Balance</th><th></th></tr></thead><tbody>' +
          (debtors.length ? debtors.map(x => '<tr><td>' + P.studentLink(x.s) + '<br><small class="muted">' + esc(x.s.admNo) + '</small></td><td>' + esc(S.classOf(x.s).name) + '</td><td>' + esc(x.s.guardianName) + '<br><small class="muted">' + esc(x.s.guardianPhone) + '</small></td><td class="r">' + money(x.f.due) + '</td><td class="r">' + money(x.f.paid) + '</td><td class="r"><b style="color:var(--red)">' + money(x.f.balance) + '</b></td><td class="r" style="white-space:nowrap">' + (x.s.guardianPhone ? '<a class="btn sm ghost" target="_blank" rel="noopener" href="' + attr(P.waLink(x.s.guardianPhone, reminderText(x.s, x.f))) + '">Remind</a> ' : '') + '<button class="btn sm" data-record="' + x.s.id + '">Record</button></td></tr>').join('') : '<tr><td colspan="7">' + P.empty('No outstanding balances. 🎉') + '</td></tr>') +
          '</tbody><tfoot><tr><td colspan="5"><b>' + debtors.length + ' students owing</b></td><td class="r"><b>' + money(debtors.reduce((a, x) => a + x.f.balance, 0)) + '</b></td><td></td></tr></tfoot></table></div></div>';
      }
      if (tab === 'schedule') {
        body = (st.demoMode ? '<div class="notice-box warn" style="margin-bottom:14px">These are <b>sample</b> amounts. Replace them with the fees approved by school management — the public Admissions page updates automatically.</div>' : '') + '<div class="grid k2">' +
          [['nursery', 'Nursery'], ['primary', 'Primary'], ['junior', 'Junior Secondary'], ['senior', 'Senior Secondary']].map(([g, l]) => { const f = S.find('feeSchedule', x => x.group === g) || { items: [] }; return '<div class="panel"><div class="panel-head"><h3>' + l + '</h3><button class="btn sm ghost" data-sched="' + g + '">Edit</button></div><div class="table-wrap"><table><tbody>' + f.items.map(i => '<tr><td>' + esc(i.name) + '</td><td class="r">' + money(i.amount) + '</td></tr>').join('') + '<tr><td><b>Total per term</b></td><td class="r"><b>' + money(f.items.reduce((a, b) => a + Number(b.amount), 0)) + '</b></td></tr></tbody></table></div></div>'; }).join('') + '</div>';
      }
      if (tab === 'summary') {
        body = '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Class</th><th class="r">Students</th><th class="r">Expected</th><th class="r">Collected</th><th class="r">Outstanding</th><th>Progress</th></tr></thead><tbody>' +
          S.sortedClasses().map(c => { const xs = statuses.filter(x => x.s.classId === c.id); const d = xs.reduce((a, x) => a + x.f.due, 0), p = xs.reduce((a, x) => a + Math.min(x.f.paid, x.f.due), 0); return '<tr><td><b>' + esc(c.name) + '</b></td><td class="r">' + xs.length + '</td><td class="r">' + money(d) + '</td><td class="r">' + money(p) + '</td><td class="r">' + money(d - p) + '</td><td style="min-width:140px"><span class="bar-track" style="display:block"><span class="bar-fill" style="width:' + (d ? p / d * 100 : 0).toFixed(0) + '%;background:var(--green)"></span></span></td></tr>'; }).join('') + '</tbody></table></div></div>';
      }
      return P.pageHead('Fees & payments', esc(S.termLabel()) + ' ' + esc(st.session) + ' · collected ' + money(paid) + ' of ' + money(due) + ' (' + (due ? Math.round(paid / due * 100) : 0) + '%)', '<button class="btn" id="fee-pay">+ Record payment</button>' + (tab === 'payments' || tab === 'debtors' ? '<button class="btn ghost" id="fee-export">Export CSV</button>' : '')) +
        '<div class="grid k4" style="margin-bottom:18px">' + P.kpi('💰', 'Expected', money(due), active.length + ' students') + P.kpi('✅', 'Collected', money(paid), (due ? Math.round(paid / due * 100) : 0) + '%') + P.kpi('⏳', 'Outstanding', money(due - paid), statuses.filter(x => x.f.balance > 0).length + ' students') + P.kpi('🧾', 'Payments', S.where('payments', p => p.session === st.session && Number(p.term) === Number(st.term)).length, 'this term') + '</div>' +
        '<div class="tabs">' + tabs.map(([k, l]) => '<a href="' + P.href('fees', null, { tab: k }) + '" class="' + (k === tab ? 'active' : '') + '">' + l + '</a>').join('') + '</div>' + body;
    }
  };
  function scheduleForm(group) {
    let f = S.find('feeSchedule', x => x.group === group);
    if (!f) { f = { id: 'f_' + group, group, items: [] }; S.all('feeSchedule').push(f); }
    const rows = () => f.items.map((i, k) => '<div class="form-grid" style="grid-template-columns:1fr 160px 40px;margin-bottom:8px;align-items:end"><div class="field"><label for="fi-n' + k + '">Item</label><input id="fi-n' + k + '" data-n="' + k + '" value="' + attr(i.name) + '"></div><div class="field"><label for="fi-a' + k + '">Amount</label><input id="fi-a' + k + '" data-a="' + k + '" type="number" min="0" step="any" value="' + attr(i.amount) + '"></div><button type="button" class="icon-btn" data-rm="' + k + '" aria-label="Remove item">✕</button></div>').join('');
    const m = U.modal({ title: 'Fee schedule — ' + group, size: 'lg', body: '<div id="fi-rows">' + rows() + '</div><button type="button" class="btn sm ghost" id="fi-add">+ Add item</button>', foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="fi-save">Save schedule</button>' });
    const items = f.items.map(i => Object.assign({}, i));
    const sync = () => { $$('[data-n]', m).forEach(i => { items[i.dataset.n].name = i.value; }); $$('[data-a]', m).forEach(i => { items[i.dataset.a].amount = Number(i.value || 0); }); };
    const redraw = () => { const tmp = f.items; f.items = items; $('#fi-rows', m).innerHTML = rows(); f.items = tmp; bind(); };
    const bind = () => $$('[data-rm]', m).forEach(b => b.onclick = () => { sync(); items.splice(+b.dataset.rm, 1); redraw(); });
    bind();
    $('#fi-add', m).onclick = () => { sync(); items.push({ name: '', amount: 0 }); redraw(); };
    $('#fi-save', m).onclick = () => { sync(); f.items = items.filter(i => i.name.trim()); S.save(); S.log(me().id, 'Updated ' + group + ' fee schedule.'); U.closeModal(); U.toast('Fee schedule saved.'); P.rerender(); };
  }
  function parentFees(ctx) {
    const kid = P.currentChild(ctx.q);
    if (!kid) return P.empty('No student linked.');
    const st = S.settings;
    const kids = P.myChildren();
    const total = kids.reduce((a, k) => a + Math.max(0, S.feeStatus(k.id).balance), 0);
    ctx.mount(() => {
      $$('[data-receipt]').forEach(b => b.onclick = () => U.printHTML('Receipt', U.receipt(b.dataset.receipt)));
      $('#fee-how').onclick = () => {
        const b = st.bank || {};
        const m = U.modal({ title: 'How to pay', body: (b.accountNumber ? '<div class="notice-box"><b>Bank:</b> ' + esc(b.name) + '<br><b>Account name:</b> ' + esc(b.accountName) + '<br><b>Account number:</b> <b>' + esc(b.accountNumber) + '</b></div>' : '<div class="notice-box warn">The school\'s bank details will appear here once published by the bursary. Meanwhile you can pay at the school bursary.</div>') +
          '<p>Use <b>' + esc(kid.admNo) + '</b> as the payment reference. After paying, tell the bursary below so your payment can be confirmed and a receipt issued.</p><form id="paid-form"><div class="form-grid">' + U.field('amount', 'Amount paid', { type: 'number', required: true, min: 1 }) + U.field('date', 'Date paid', { type: 'date', required: true, value: today(), max: today() }) + U.field('ref', 'Bank / teller reference', { required: true, full: true }) + '</div></form>' +
          '<p class="hint">Online card payments (e.g. Paystack or Flutterwave) can be switched on when the school connects a payment account.</p>', foot: '<button class="btn ghost" data-close>Close</button><button class="btn" id="paid-send">Notify the bursary</button>' });
        $('#paid-send', m).onclick = () => {
          const form = $('#paid-form', m); if (!form.checkValidity()) { form.reportValidity(); return; }
          const d = U.formData(form);
          P.sendMessage({ subject: 'Payment notification — ' + S.studentName(kid), to: ['office'], studentId: kid.id, text: 'I have paid ' + money(d.amount) + ' on ' + fmtDate(d.date) + ' for ' + S.studentName(kid) + ' (' + kid.admNo + '). Reference: ' + d.ref + '. Kindly confirm and issue a receipt.' });
          U.closeModal(); U.toast('Thank you — the bursary has been notified.');
        };
      };
    });
    return P.pageHead('Fees & receipts', esc(S.termLabel()) + ' ' + esc(st.session) + (kids.length > 1 ? ' · total balance for all children ' + money(total) : ''), '<button class="btn" id="fee-how">How to pay / I have paid</button>') + P.childSwitcher(ctx.q, 'fees') + P.feesPanel(kid, false);
  }

  /* =================== ADMISSIONS =================== */
  const APP_STATUSES = ['Submitted', 'Under review', 'Exam scheduled', 'Admitted', 'Waitlisted', 'Declined', 'Enrolled'];
  V.admissions = {
    title: 'Admissions',
    render(ctx) {
      const status = ctx.q.status || '';
      const list = S.all('applications').filter(a => !status || a.status === status).sort((a, b) => b.created.localeCompare(a.created));
      ctx.mount(() => {
        $$('[data-app]').forEach(b => b.onclick = () => appModal(b.dataset.app));
        $('#app-export').onclick = () => U.downloadCSV('applications.csv', [['Reference', 'Date', 'Child', 'Gender', 'Date of birth', 'Class sought', 'Parent', 'Phone', 'Email', 'Status', 'Exam date'], ...list.map(a => [a.ref, a.created, a.child.firstName + ' ' + a.child.lastName, a.child.gender, a.child.dob, a.classSought, a.parent.name, a.parent.phone, a.parent.email, a.status, a.examDate])]);
        if (ctx.arg) appModal(ctx.arg);
      });
      const counts = {}; S.all('applications').forEach(a => { counts[a.status] = (counts[a.status] || 0) + 1; });
      return P.pageHead('Admissions', 'Applications from the website and the school office.', '<a class="btn ghost" href="index.html#/apply" target="_blank">Open application form ↗</a><button class="btn ghost" id="app-export">Export CSV</button>') +
        '<div class="tabs"><a href="#/admissions" class="' + (!status ? 'active' : '') + '">All (' + S.all('applications').length + ')</a>' + APP_STATUSES.map(s => '<a href="' + P.href('admissions', null, { status: s }) + '" class="' + (s === status ? 'active' : '') + '">' + s + ' (' + (counts[s] || 0) + ')</a>').join('') + '</div>' +
        '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Reference</th><th>Child</th><th>Class sought</th><th>Parent / guardian</th><th>Received</th><th>Status</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(a => '<tr><td>' + esc(a.ref) + '</td><td><b>' + esc(a.child.firstName + ' ' + a.child.lastName) + '</b><br><small class="muted">' + esc(a.child.gender) + ' · age ' + U.ageFrom(a.child.dob) + '</small></td><td>' + esc(a.classSought) + '</td><td>' + esc(a.parent.name) + '<br><small class="muted">' + esc(a.parent.phone) + '</small></td><td>' + fmtDate(a.created, 'short') + '</td><td>' + P.statusBadge(a.status) + (a.examDate ? '<br><small class="muted">Exam ' + fmtDate(a.examDate, 'short') + '</small>' : '') + '</td><td class="r"><button class="btn sm" data-app="' + a.id + '">Open</button></td></tr>').join('') : '<tr><td colspan="7">' + P.empty('No applications.') + '</td></tr>') +
        '</tbody></table></div></div>';
    }
  };
  function appModal(id) {
    const a = S.get('applications', id); if (!a) return;
    const row = (k, v) => '<dt>' + esc(k) + '</dt><dd>' + (v ? esc(v) : '<span class="tbc">—</span>') + '</dd>';
    const m = U.modal({
      title: a.ref + ' · ' + a.child.firstName + ' ' + a.child.lastName, size: 'lg',
      body: '<div class="grid k2"><div><h4 style="margin-top:0">Child</h4><dl class="dl">' + row('Name', [a.child.firstName, a.child.otherName, a.child.lastName].filter(Boolean).join(' ')) + row('Gender', a.child.gender) + row('Date of birth', a.child.dob ? fmtDate(a.child.dob) + ' (age ' + U.ageFrom(a.child.dob) + ')' : '') + row('Class sought', a.classSought) + row('Previous school', a.prevSchool) + row('Medical', a.medical) + row('Notes', a.notes) + '</dl></div>' +
        '<div><h4 style="margin-top:0">Parent / guardian</h4><dl class="dl">' + row('Name', a.parent.name) + row('Relationship', a.parent.relationship) + row('Phone', a.parent.phone) + row('Email', a.parent.email) + row('Address', a.parent.address) + row('Occupation', a.parent.occupation) + '</dl>' +
        '<div class="form-actions" style="margin-top:12px">' + (a.parent.phone ? '<a class="btn sm ghost" href="tel:' + attr(a.parent.phone) + '">Call</a><a class="btn sm ghost" target="_blank" rel="noopener" href="' + attr(P.waLink(a.parent.phone, 'Good day ' + a.parent.name + '. This is ' + S.settings.schoolName + ' regarding application ' + a.ref + ' for ' + a.child.firstName + '. ')) + '">WhatsApp</a>' : '') + (a.parent.email ? '<a class="btn sm ghost" href="mailto:' + attr(a.parent.email) + '?subject=' + encodeURIComponent('Application ' + a.ref) + '">Email</a>' : '') + '</div></div></div>' +
        '<h4>History</h4><ul class="timeline" style="margin-top:8px">' + a.history.slice().reverse().map(h => '<li><b>' + esc(h.status) + '</b> <small style="display:inline">' + fmtDate(h.at) + '</small><br>' + esc(h.note || '') + '</li>').join('') + '</ul>' +
        (a.status !== 'Enrolled' ? '<form id="app-form" class="panel" style="margin-top:12px"><h4 style="margin-top:0">Update status</h4><div class="form-grid">' + U.field('status', 'New status', { type: 'select', required: true, options: APP_STATUSES.filter(s => s !== 'Enrolled'), value: a.status, placeholder: false }) + U.field('examDate', 'Assessment / exam date', { type: 'date', value: a.examDate }) + U.field('note', 'Note (visible to parent when tracking)', { full: true, placeholder: 'e.g. Please bring birth certificate on exam day.' }) + '</div></form>' : '<div class="notice-box ok">Enrolled as a student.</div>'),
      foot: '<button class="btn danger" id="app-del" style="margin-right:auto">Delete</button>' + (a.status === 'Admitted' ? '<button class="btn ok" id="app-enrol">Enrol as student</button>' : '') + (a.status !== 'Enrolled' ? '<button class="btn" id="app-save">Save update</button>' : '<button class="btn ghost" data-close>Close</button>')
    });
    const save = $('#app-save', m);
    if (save) save.onclick = () => {
      const d = U.formData($('#app-form', m));
      if (d.status === 'Exam scheduled' && !d.examDate) { U.toast('Please set the exam date.', 'warn'); return; }
      const note = d.note || (d.status === 'Exam scheduled' ? 'Assessment scheduled for ' + fmtDate(d.examDate) + '.' : d.status === 'Admitted' ? 'Admission offered. Please visit the school office to accept.' : '');
      a.history.push({ at: today(), status: d.status, note });
      a.status = d.status; a.examDate = d.examDate;
      S.save(); S.log(me().id, 'Application ' + a.ref + ' → ' + d.status + '.');
      U.closeModal(); U.toast('Application updated. The parent will see this when they track the application.'); P.go('admissions');
    };
    const enrol = $('#app-enrol', m);
    if (enrol) enrol.onclick = () => {
      const cls = S.find('classes', c => c.name === a.classSought);
      const s = S.insert('students', { admNo: S.nextAdmissionNo(), firstName: a.child.firstName, otherName: a.child.otherName || '', lastName: a.child.lastName, gender: a.child.gender, dob: a.child.dob, classId: cls ? cls.id : S.sortedClasses()[0].id, status: 'Active', admittedOn: today(), guardianName: a.parent.name, guardianPhone: a.parent.phone, guardianEmail: a.parent.email, address: a.parent.address, stateOfOrigin: a.child.stateOfOrigin || '', religion: a.child.religion || '', medical: a.medical, parentIds: [], house: '' });
      a.status = 'Enrolled'; a.studentId = s.id; a.history.push({ at: today(), status: 'Enrolled', note: 'Admission number ' + s.admNo + ' issued.' });
      S.save(); S.log(me().id, 'Enrolled ' + S.studentName(s) + ' from application ' + a.ref + ' (' + s.admNo + ').');
      U.closeModal(); U.toast(S.studentName(s) + ' enrolled with admission no. ' + s.admNo + '.');
      P.go('students', s.id);
    };
    $('#app-del', m).onclick = () => U.confirmBox('Delete application ' + a.ref + '?', () => { S.remove('applications', a.id); U.toast('Deleted.'); P.go('admissions'); }, { danger: true, yes: 'Delete' });
  }

  /* =================== ENQUIRIES =================== */
  V.enquiries = {
    title: 'Enquiries',
    render(ctx) {
      const list = S.all('enquiries').slice().sort((a, b) => b.created.localeCompare(a.created));
      ctx.mount(() => $$('[data-enq]').forEach(b => b.onclick = () => {
        const e = S.get('enquiries', b.dataset.enq);
        const m = U.modal({ title: 'Enquiry from ' + e.name, body: '<p class="muted">' + fmtDate(e.created, 'datetime') + ' · ' + esc(e.level) + '</p><blockquote style="margin:0 0 14px;padding:12px 16px;background:var(--surface-2);border-radius:8px">' + esc(e.message) + '</blockquote><p>📞 <a class="link-btn" href="tel:' + attr(e.phone) + '">' + esc(e.phone) + '</a>' + (e.email ? ' · ✉ <a class="link-btn" href="mailto:' + attr(e.email) + '">' + esc(e.email) + '</a>' : '') + '</p>' +
          U.field('reply', 'Reply / notes', { type: 'textarea', value: e.reply, rows: 4, placeholder: 'Write your reply, then send it by WhatsApp or email, or note what was discussed by phone.' }),
          foot: '<button class="btn danger" id="eq-del" style="margin-right:auto">Delete</button><button class="btn ghost" id="eq-wa">Send by WhatsApp</button><button class="btn ghost" id="eq-close">Mark closed</button><button class="btn" id="eq-save">Save as replied</button>' });
        const txt = () => $('textarea', m).value.trim();
        const upd = st => { S.update('enquiries', e.id, { reply: txt(), status: st, handledBy: me().id }); U.closeModal(); P.rerender(); };
        $('#eq-save', m).onclick = () => upd('Replied');
        $('#eq-close', m).onclick = () => upd('Closed');
        $('#eq-wa', m).onclick = () => { const url = P.waLink(e.phone, txt() || 'Good day ' + e.name + ', thank you for your enquiry to ' + S.settings.schoolName + '. '); if (url) window.open(url, '_blank', 'noopener'); upd('Replied'); };
        $('#eq-del', m).onclick = () => { S.remove('enquiries', e.id); U.closeModal(); P.rerender(); };
      }));
      return P.pageHead('Enquiries', 'Messages sent from the website contact form.') +
        '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>From</th><th>Level</th><th>Message</th><th>Received</th><th>Status</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(e => '<tr><td><b>' + esc(e.name) + '</b><br><small class="muted">' + esc(e.phone) + '</small></td><td>' + esc(e.level) + '</td><td style="max-width:360px"><small>' + esc(e.message.length > 110 ? e.message.slice(0, 110) + '…' : e.message) + '</small></td><td>' + U.relTime(e.created) + '</td><td>' + P.statusBadge(e.status) + '</td><td class="r"><button class="btn sm" data-enq="' + e.id + '">Open</button></td></tr>').join('') : '<tr><td colspan="6">' + P.empty('No enquiries yet.') + '</td></tr>') +
        '</tbody></table></div></div>';
    }
  };

  /* =================== ANNOUNCEMENTS =================== */
  V.announcements = {
    title: 'Announcements',
    render(ctx) {
      const role = ctx.role;
      const canPost = role === 'admin' || role === 'teacher';
      const list = S.all('announcements').filter(a => role === 'admin' || a.audience === 'all' || a.audience === role || a.author === ctx.me.id).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date.localeCompare(a.date));
      const AUD = { all: 'Everyone', parent: 'Parents', teacher: 'Staff', student: 'Students' };
      ctx.mount(() => {
        const add = $('#ann-add');
        const open = a => {
          a = a || { audience: 'all' };
          const m = U.modal({ title: a.id ? 'Edit announcement' : 'New announcement', body: '<form id="an-form"><div class="form-grid">' + U.field('title', 'Title', { required: true, value: a.title, full: true }) + U.field('body', 'Message', { type: 'textarea', required: true, value: a.body, full: true, rows: 6 }) + U.field('audience', 'Audience', { type: 'select', options: Object.entries(AUD).filter(([k]) => role === 'admin' || k !== 'teacher').map(([value, label]) => ({ value, label })), value: a.audience, placeholder: false }) + (role === 'admin' ? U.field('pinned', 'Pin to top', { type: 'select', options: [{ value: '', label: 'No' }, { value: '1', label: 'Yes' }], value: a.pinned ? '1' : '', placeholder: false }) : '') + '</div></form>', foot: (a.id ? '<button class="btn danger" id="an-del" style="margin-right:auto">Delete</button>' : '') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="an-save">' + (a.id ? 'Save' : 'Publish') + '</button>' });
          $('#an-save', m).onclick = () => {
            const form = $('#an-form', m); if (!form.checkValidity()) { form.reportValidity(); return; }
            const d = U.formData(form);
            const rec = { title: d.title, body: d.body, audience: d.audience, pinned: d.pinned === '1' };
            if (a.id) S.update('announcements', a.id, rec); else { S.insert('announcements', Object.assign(rec, { date: today(), author: ctx.me.id })); S.log(ctx.me.id, 'Posted announcement "' + d.title + '".'); }
            U.closeModal(); U.toast('Announcement published.'); P.rerender();
          };
          const del = $('#an-del', m); if (del) del.onclick = () => { S.remove('announcements', a.id); U.closeModal(); P.rerender(); };
        };
        if (add) add.onclick = () => open();
        $$('[data-an]').forEach(b => b.onclick = () => open(S.get('announcements', b.dataset.an)));
        if (ctx.q.new && canPost) { open(); history.replaceState(null, '', P.href('announcements')); }
      });
      return P.pageHead('Announcements', 'Notices for parents, students and staff.', canPost ? '<button class="btn" id="ann-add">+ New announcement</button>' : '') +
        (list.length ? '<div class="grid">' + list.map(a => '<div class="panel"><div class="panel-head"><div><small class="muted">' + fmtDate(a.date) + ' · ' + esc(S.userName(a.author)) + ' · to ' + esc(AUD[a.audience] || a.audience) + '</small><h3>' + (a.pinned ? '📌 ' : '') + esc(a.title) + '</h3></div>' + (role === 'admin' || a.author === ctx.me.id ? '<button class="btn sm ghost" data-an="' + a.id + '">Edit</button>' : '') + '</div><div>' + U.paragraphs(a.body) + '</div></div>').join('') + '</div>' : P.empty('No announcements yet.'));
    }
  };

  /* =================== MESSAGES =================== */
  const visible = P.threadVisible;
  const nameOf = id => id === 'office' ? 'School office' : S.userName(id);
  P.sendMessage = ({ subject, to, text, studentId }) => {
    const u = me();
    const t = S.insert('messages', { subject, participants: [u.id, ...to], studentId: studentId || null, updated: new Date().toISOString(), readBy: [u.id], messages: [{ from: u.id, at: new Date().toISOString(), text }] });
    S.log(u.id, 'Sent a message: ' + subject);
    return t;
  };
  function recipientsFor(u) {
    const out = [];
    if (u.role === 'parent') {
      out.push({ value: 'office', label: 'School office (administration & bursary)' });
      const seen = new Set();
      P.myChildren().forEach(k => {
        S.all('users').filter(t => t.role === 'teacher' && t.active !== false && ((t.classIds || []).includes(k.classId) || S.get('classes', k.classId).teacherId === t.id)).forEach(t => {
          if (seen.has(t.id)) return; seen.add(t.id);
          out.push({ value: t.id, label: S.userName(t) + ' — ' + (S.get('classes', k.classId).teacherId === t.id ? 'class teacher, ' : '') + S.get('classes', k.classId).name });
        });
      });
    } else if (u.role === 'teacher') {
      out.push({ value: 'office', label: 'School office' });
      const ids = P.myClassIds();
      S.all('users').filter(p => p.role === 'parent' && (p.childIds || []).some(cid => { const s = S.get('students', cid); return s && ids.includes(s.classId); })).forEach(p => out.push({ value: p.id, label: S.userName(p) + ' — parent of ' + (p.childIds || []).map(cid => (S.get('students', cid) || {}).firstName).join(', ') }));
      S.all('users').filter(t => t.role === 'teacher' && t.id !== u.id).forEach(t => out.push({ value: t.id, label: S.userName(t) + ' — staff' }));
    } else {
      S.all('users').filter(x => x.id !== u.id && (x.role === 'parent' || x.role === 'teacher' || x.role === 'admin') && x.active !== false).sort((a, b) => a.role.localeCompare(b.role) || a.lastName.localeCompare(b.lastName)).forEach(x => out.push({ value: x.id, label: S.userName(x) + ' — ' + x.role + (x.role === 'parent' ? ' of ' + (x.childIds || []).map(cid => (S.get('students', cid) || {}).firstName).join(', ') : '') }));
    }
    return out;
  }
  V.messages = {
    title: 'Messages',
    render(ctx) {
      const u = ctx.me;
      const threads = S.all('messages').filter(t => visible(t, u)).sort((a, b) => b.updated.localeCompare(a.updated));
      const cur = ctx.arg ? threads.find(t => t.id === ctx.arg) : null;
      if (cur && !(cur.readBy || []).includes(u.id)) { cur.readBy = [...(cur.readBy || []), u.id]; S.save(); }
      ctx.mount(() => {
        $('#msg-new').onclick = () => {
          const opts = recipientsFor(u);
          const m = U.modal({ title: 'New message', body: '<form id="nm-form"><div class="form-grid">' + U.field('to', 'To', { type: 'select', required: true, options: opts, full: true }) + U.field('subject', 'Subject', { required: true, full: true }) + U.field('text', 'Message', { type: 'textarea', required: true, full: true, rows: 6 }) + '</div></form>', foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="nm-send">Send</button>' });
          $('#nm-send', m).onclick = () => {
            const form = $('#nm-form', m); if (!form.checkValidity()) { form.reportValidity(); return; }
            const d = U.formData(form);
            const kid = u.role === 'parent' ? P.currentChild({}) : null;
            const t = P.sendMessage({ subject: d.subject, to: [d.to], text: d.text, studentId: kid ? kid.id : null });
            U.closeModal(); U.toast('Message sent.'); P.go('messages', t.id);
          };
        };
        const rf = $('#reply-form');
        if (rf) {
          const ta = $('textarea', rf);
          ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) rf.requestSubmit(); });
          rf.addEventListener('submit', e => {
            e.preventDefault();
            const text = ta.value.trim(); if (!text) return;
            cur.messages.push({ from: u.id, at: new Date().toISOString(), text });
            cur.updated = new Date().toISOString(); cur.readBy = [u.id];
            S.save(); P.rerender();
            setTimeout(() => { const b = $('.bubbles'); if (b) b.scrollTop = b.scrollHeight; const t = $('#reply-form textarea'); if (t) t.focus(); });
          });
          const b = $('.bubbles'); if (b) b.scrollTop = b.scrollHeight;
        }
        if (ctx.q.new) { $('#msg-new').click(); history.replaceState(null, '', P.href('messages')); }
      });
      const others = t => t.participants.filter(p => p !== u.id && !(p === 'office' && u.role === 'admin')).map(nameOf).join(', ') || nameOf(t.participants[0]);
      return P.pageHead('Messages', 'Private conversations between families and the school.', '<button class="btn" id="msg-new">+ New message</button>') +
        '<div class="panel flush"><div class="msg-layout"><div class="msg-list">' + (threads.length ? threads.map(t => { const last = t.messages[t.messages.length - 1]; return '<a href="' + P.href('messages', t.id) + '" class="' + (cur && cur.id === t.id ? 'active ' : '') + ((t.readBy || []).includes(u.id) ? '' : 'unread') + '"><h4>' + esc(t.subject) + '</h4><p>' + esc(others(t)) + ' · ' + U.relTime(t.updated) + '</p><p>' + esc(last ? last.text : '') + '</p></a>'; }).join('') : P.empty('No conversations yet.')) + '</div>' +
        '<div class="thread">' + (cur ? '<div class="thread-head"><h3>' + esc(cur.subject) + '</h3><small class="muted">With ' + esc(others(cur)) + (cur.studentId && S.get('students', cur.studentId) ? ' · about ' + esc(S.studentName(S.get('students', cur.studentId))) : '') + '</small></div><div class="bubbles">' +
          cur.messages.map(mm => '<div class="bubble' + (mm.from === u.id ? ' me' : '') + '">' + (mm.from !== u.id ? '<b style="font-size:12px">' + esc(nameOf(mm.from)) + '</b><br>' : '') + esc(mm.text).replace(/\n/g, '<br>') + '<small>' + fmtDate(mm.at, 'datetime') + '</small></div>').join('') + '</div>' +
          '<form class="reply" id="reply-form"><label class="sr-only" for="reply-ta">Reply</label><textarea id="reply-ta" placeholder="Write a reply… (Ctrl+Enter to send)"></textarea><button class="btn">Send</button></form>'
          : '<div class="empty" style="margin:auto">Select a conversation or start a new one.</div>') + '</div></div></div>';
    }
  };

  /* =================== WEBSITE CONTENT =================== */
  V.website = {
    title: 'Website content',
    render(ctx) {
      const tab = ctx.q.tab || 'news';
      const tabs = [['news', 'News'], ['events', 'Events & calendar'], ['gallery', 'Gallery'], ['faqs', 'FAQs'], ['homepage', 'Homepage & banner']];
      const cfg = CMS[tab];
      ctx.mount(() => { if (cfg.mount) cfg.mount(ctx); });
      return P.pageHead('Website content', 'Changes appear on the public website straight away.', '<a class="btn ghost" href="index.html" target="_blank">View website ↗</a>') +
        '<div class="tabs">' + tabs.map(([k, l]) => '<a href="' + P.href('website', null, { tab: k }) + '" class="' + (k === tab ? 'active' : '') + '">' + l + '</a>').join('') + '</div>' + cfg.render(ctx);
    }
  };
  const imageField = (value) => '<div class="field full"><label for="img-url">Image</label><div class="img-preview" id="img-prev" style="background-image:url(\'' + attr(value || '') + '\')"></div><div class="form-grid" style="grid-template-columns:1fr auto;margin-top:8px"><input id="img-url" name="image" placeholder="Paste an image link, or upload →" value="' + attr(value || '') + '"><label class="btn ghost sm" style="cursor:pointer">Upload photo<input type="file" accept="image/*" id="img-file" class="sr-only"></label></div><small class="hint">Uploaded photos are resized automatically.</small></div>';
  const bindImage = m => {
    const url = $('#img-url', m), prev = $('#img-prev', m);
    url.oninput = () => { prev.style.backgroundImage = 'url("' + url.value.replace(/"/g, '') + '")'; };
    $('#img-file', m).onchange = e => P.readImage(e.target.files[0], 1400).then(data => { url.value = data; prev.style.backgroundImage = 'url("' + data + '")'; }).catch(err => U.toast(err.message, 'bad'));
  };
  const slugify = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  const CMS = {
    news: {
      render() {
        const list = S.all('news').slice().sort((a, b) => b.date.localeCompare(a.date));
        return '<div class="form-actions" style="margin-bottom:14px"><button class="btn" id="cms-add">+ New article</button></div><div class="panel flush"><div class="table-wrap"><table><thead><tr><th></th><th>Title</th><th>Category</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody>' +
          (list.length ? list.map(n => '<tr><td><span class="thumb" style="background-image:url(\'' + attr(n.image || '') + '\')"></span></td><td><b>' + esc(n.title) + '</b><br><small class="muted">' + esc(n.summary.slice(0, 90)) + '</small></td><td>' + esc(n.category) + '</td><td>' + fmtDate(n.date, 'short') + '</td><td>' + (n.published !== false ? '<span class="badge ok">Published</span>' : '<span class="badge">Draft</span>') + '</td><td class="r"><button class="btn sm ghost" data-edit="' + n.id + '">Edit</button></td></tr>').join('') : '<tr><td colspan="6">' + P.empty('No articles yet.') + '</td></tr>') + '</tbody></table></div></div>';
      },
      mount() {
        const open = n => {
          n = n || { date: today(), category: 'Announcement', published: true };
          const m = U.modal({ title: n.id ? 'Edit article' : 'New article', size: 'lg', body: '<form id="nf"><div class="form-grid">' + U.field('title', 'Title', { required: true, value: n.title, full: true }) + U.field('category', 'Category', { type: 'select', options: ['Announcement', 'Academics', 'Achievement', 'Sports', 'Community', 'Faith', 'Events'], value: n.category, placeholder: false }) + U.field('date', 'Date', { type: 'date', required: true, value: n.date }) + U.field('summary', 'Summary (shown on cards)', { required: true, value: n.summary, full: true }) + U.field('body', 'Article', { type: 'textarea', required: true, value: n.body, full: true, rows: 9, hint: 'Leave a blank line between paragraphs.' }) + imageField(n.image) + U.field('published', 'Status', { type: 'select', options: [{ value: '1', label: 'Published' }, { value: '', label: 'Draft (hidden)' }], value: n.published !== false ? '1' : '', placeholder: false }) + '</div></form>', foot: (n.id ? '<button class="btn danger" id="nf-del" style="margin-right:auto">Delete</button>' : '') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="nf-save">Save</button>' });
          bindImage(m);
          $('#nf-save', m).onclick = () => {
            const form = $('#nf', m); if (!form.checkValidity()) { form.reportValidity(); return; }
            const d = U.formData(form); d.published = d.published === '1';
            try {
              if (n.id) S.update('news', n.id, d); else { let slug = slugify(d.title) || EPS.uid('n'); if (S.find('news', x => x.slug === slug)) slug += '-' + Date.now().toString(36).slice(-4); S.insert('news', Object.assign(d, { slug })); }
              S.log(me().id, (n.id ? 'Updated' : 'Published') + ' news "' + d.title + '".'); U.closeModal(); U.toast('Article saved.'); P.rerender();
            } catch (e) { U.toast('Could not save — storage may be full. Use a smaller photo.', 'bad'); }
          };
          const del = $('#nf-del', m); if (del) del.onclick = () => U.confirmBox('Delete this article?', () => { S.remove('news', n.id); P.rerender(); }, { danger: true, yes: 'Delete' });
        };
        $('#cms-add').onclick = () => open();
        $$('[data-edit]').forEach(b => b.onclick = () => open(S.get('news', b.dataset.edit)));
      }
    },
    events: {
      render() {
        const list = S.all('events').slice().sort((a, b) => a.date.localeCompare(b.date));
        const st = S.settings;
        return '<div class="notice-box" style="margin-bottom:14px">Term dates (' + fmtDate(st.termStart) + ' – ' + fmtDate(st.termEnd) + ', next term ' + fmtDate(st.nextTermBegins) + ') are set in <a class="link-btn" href="#/settings">Settings</a>.</div><div class="form-actions" style="margin-bottom:14px"><button class="btn" id="cms-add">+ New event</button></div><div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Category</th><th>Location</th><th></th></tr></thead><tbody>' +
          (list.length ? list.map(e => '<tr style="' + ((e.endDate || e.date) < today() ? 'opacity:.55' : '') + '"><td>' + fmtDate(e.date, 'short') + (e.endDate ? ' – ' + fmtDate(e.endDate, 'short') : '') + (e.time ? '<br><small class="muted">' + esc(e.time) + '</small>' : '') + '</td><td><b>' + esc(e.title) + '</b></td><td>' + esc(e.category) + '</td><td>' + esc(e.location || '') + '</td><td class="r"><button class="btn sm ghost" data-edit="' + e.id + '">Edit</button></td></tr>').join('') : '<tr><td colspan="5">' + P.empty('No events yet.') + '</td></tr>') + '</tbody></table></div></div>';
      },
      mount() {
        const open = e => {
          e = e || { date: today(), category: 'Academic' };
          const m = U.modal({ title: e.id ? 'Edit event' : 'New event', body: '<form id="ef"><div class="form-grid">' + U.field('title', 'Title', { required: true, value: e.title, full: true }) + U.field('date', 'Start date', { type: 'date', required: true, value: e.date }) + U.field('endDate', 'End date (optional)', { type: 'date', value: e.endDate }) + U.field('time', 'Time', { type: 'time', value: e.time }) + U.field('category', 'Category', { type: 'select', options: ['Academic', 'Holiday', 'Faith', 'Parents', 'Sports', 'Admissions'], value: e.category, placeholder: false }) + U.field('location', 'Location', { value: e.location, full: true }) + U.field('desc', 'Description', { type: 'textarea', value: e.desc, full: true, rows: 3 }) + '</div></form>', foot: (e.id ? '<button class="btn danger" id="ef-del" style="margin-right:auto">Delete</button>' : '') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="ef-save">Save</button>' });
          $('#ef-save', m).onclick = () => {
            const form = $('#ef', m); if (!form.checkValidity()) { form.reportValidity(); return; }
            const d = U.formData(form);
            if (d.endDate && d.endDate < d.date) { U.toast('End date is before the start date.', 'warn'); return; }
            if (!d.endDate) delete d.endDate;
            if (e.id) { const ex = S.get('events', e.id); if (!d.endDate) delete ex.endDate; S.update('events', e.id, d); } else S.insert('events', d);
            U.closeModal(); U.toast('Event saved.'); P.rerender();
          };
          const del = $('#ef-del', m); if (del) del.onclick = () => { S.remove('events', e.id); U.closeModal(); P.rerender(); };
        };
        $('#cms-add').onclick = () => open();
        $$('[data-edit]').forEach(b => b.onclick = () => open(S.get('events', b.dataset.edit)));
      }
    },
    gallery: {
      render() {
        const list = S.all('gallery');
        return '<div class="form-actions" style="margin-bottom:14px"><button class="btn" id="cms-add">+ Add photo</button></div>' + (S.settings.demoMode ? '<div class="notice-box warn" style="margin-bottom:14px">These are stock photos. Replace them with approved photographs of the school (with the necessary permissions for any children shown).</div>' : '') +
          '<div class="grid k4">' + list.map(g => '<div class="panel" style="padding:10px"><div class="img-preview" style="background-image:url(\'' + attr(g.image.replace('w=1200', 'w=400')) + '\');border-style:solid;height:130px"></div><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px"><span><b style="font-size:13px">' + esc(g.title) + '</b><br><small class="muted">' + esc(g.album) + '</small></span><button class="btn sm ghost" data-edit="' + g.id + '">Edit</button></div></div>').join('') + '</div>';
      },
      mount() {
        const open = g => {
          g = g || { album: 'Classroom' };
          const albums = [...new Set(['Classroom', 'Nursery', 'Science', 'Sports', 'Events', 'Faith', ...S.all('gallery').map(x => x.album)])];
          const m = U.modal({ title: g.id ? 'Edit photo' : 'Add photo', body: '<form id="gf"><div class="form-grid">' + imageField(g.image) + U.field('title', 'Caption', { required: true, value: g.title }) + U.field('album', 'Album', { type: 'select', options: albums, value: g.album, placeholder: false }) + '</div></form>', foot: (g.id ? '<button class="btn danger" id="gf-del" style="margin-right:auto">Delete</button>' : '') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="gf-save">Save</button>' });
          bindImage(m);
          $('#gf-save', m).onclick = () => {
            const form = $('#gf', m); if (!form.checkValidity()) { form.reportValidity(); return; }
            const d = U.formData(form); if (!d.image) { U.toast('Please add an image.', 'warn'); return; }
            try { if (g.id) S.update('gallery', g.id, d); else S.insert('gallery', d); U.closeModal(); U.toast('Photo saved.'); P.rerender(); }
            catch (e) { U.toast('Could not save — browser storage is full.', 'bad'); }
          };
          const del = $('#gf-del', m); if (del) del.onclick = () => { S.remove('gallery', g.id); U.closeModal(); P.rerender(); };
        };
        $('#cms-add').onclick = () => open();
        $$('[data-edit]').forEach(b => b.onclick = () => open(S.get('gallery', b.dataset.edit)));
      }
    },
    faqs: {
      render() {
        const list = S.all('faqs').slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        return '<div class="form-actions" style="margin-bottom:14px"><button class="btn" id="cms-add">+ New FAQ</button></div><div class="panel"><div class="list">' + list.map(f => '<div class="list-item"><div class="grow"><h4>' + esc(f.q) + '</h4><p>' + esc(f.a) + '</p></div><button class="btn sm ghost" data-edit="' + f.id + '">Edit</button></div>').join('') + '</div></div>';
      },
      mount() {
        const open = f => {
          f = f || { order: S.all('faqs').length };
          const m = U.modal({ title: f.id ? 'Edit FAQ' : 'New FAQ', body: '<form id="ff"><div class="form-grid">' + U.field('q', 'Question', { required: true, value: f.q, full: true }) + U.field('a', 'Answer', { type: 'textarea', required: true, value: f.a, full: true, rows: 5 }) + U.field('order', 'Order', { type: 'number', value: f.order, min: 0 }) + '</div></form>', foot: (f.id ? '<button class="btn danger" id="ff-del" style="margin-right:auto">Delete</button>' : '') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="ff-save">Save</button>' });
          $('#ff-save', m).onclick = () => { const form = $('#ff', m); if (!form.checkValidity()) { form.reportValidity(); return; } const d = U.formData(form); d.order = Number(d.order || 0); if (f.id) S.update('faqs', f.id, d); else S.insert('faqs', d); U.closeModal(); P.rerender(); };
          const del = $('#ff-del', m); if (del) del.onclick = () => { S.remove('faqs', f.id); U.closeModal(); P.rerender(); };
        };
        $('#cms-add').onclick = () => open();
        $$('[data-edit]').forEach(b => b.onclick = () => open(S.get('faqs', b.dataset.edit)));
      }
    },
    homepage: {
      render() {
        const a = S.settings.announcement || {};
        return '<div class="grid k2"><form class="panel" id="banner-form"><h3>Announcement banner</h3><p class="hint">A gold strip at the top of every page of the website.</p><div class="form-grid" style="grid-template-columns:1fr">' + U.field('text', 'Banner text', { type: 'textarea', value: a.text, rows: 3 }) + U.field('link', 'Link (optional)', { value: a.link, placeholder: '#/admissions' }) + U.field('active', 'Show banner', { type: 'select', options: [{ value: '1', label: 'Yes' }, { value: '', label: 'No' }], value: a.active ? '1' : '', placeholder: false }) + '</div><div class="form-actions"><button class="btn">Save banner</button></div></form>' +
          '<div class="panel"><div class="panel-head"><h3>Testimonials</h3><button class="btn sm" id="t-add">+ Add</button></div><div class="list">' + S.all('testimonials').map(t => '<div class="list-item"><div class="grow"><p style="color:var(--ink)">“' + esc(t.quote) + '”</p><p>— ' + esc(t.name) + (t.sample ? ' <span class="sample-tag">Sample</span>' : '') + '</p></div><button class="btn sm ghost" data-t="' + t.id + '">Edit</button></div>').join('') + '</div></div></div>';
      },
      mount() {
        P.bindForm($('#banner-form'), d => { S.setSettings({ announcement: { text: d.text, link: d.link, active: d.active === '1' } }); U.toast('Banner saved.'); });
        const open = t => {
          t = t || {};
          const m = U.modal({ title: t.id ? 'Edit testimonial' : 'New testimonial', body: '<form id="tf"><div class="form-grid" style="grid-template-columns:1fr">' + U.field('quote', 'Quote', { type: 'textarea', required: true, value: t.quote, rows: 4 }) + U.field('name', 'Attribution', { required: true, value: t.name, placeholder: 'e.g. Parent of a Primary 3 pupil' }) + '</div><p class="hint">Only publish real testimonials with the person\'s permission.</p></form>', foot: (t.id ? '<button class="btn danger" id="tf-del" style="margin-right:auto">Delete</button>' : '') + '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="tf-save">Save</button>' });
          $('#tf-save', m).onclick = () => { const form = $('#tf', m); if (!form.checkValidity()) { form.reportValidity(); return; } const d = U.formData(form); d.sample = false; if (t.id) S.update('testimonials', t.id, d); else S.insert('testimonials', d); U.closeModal(); P.rerender(); };
          const del = $('#tf-del', m); if (del) del.onclick = () => { S.remove('testimonials', t.id); U.closeModal(); P.rerender(); };
        };
        $('#t-add').onclick = () => open();
        $$('[data-t]').forEach(b => b.onclick = () => open(S.get('testimonials', b.dataset.t)));
      }
    }
  };

  /* =================== RESULT PINS =================== */
  V.pins = {
    title: 'Result PINs',
    render(ctx) {
      const list = S.all('pins').slice().sort((a, b) => a.serial.localeCompare(b.serial));
      ctx.mount(() => {
        $('#pin-gen').onclick = () => {
          const m = U.modal({ title: 'Generate result PINs', size: 'sm', body: '<form id="pg"><div class="form-grid" style="grid-template-columns:1fr">' + U.field('count', 'How many PINs?', { type: 'number', required: true, min: 1, max: 1000, value: 50 }) + U.field('maxUses', 'Uses allowed per PIN', { type: 'number', required: true, min: 1, max: 20, value: S.settings.pinMaxUses || 5 }) + '</div><p class="hint">Each PIN locks to the first student it is used for.</p></form>', foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn" id="pg-go">Generate</button>' });
          $('#pg-go', m).onclick = () => {
            const d = U.formData($('#pg', m));
            const n = Math.min(1000, Math.max(1, +d.count));
            let max = list.reduce((a, p) => Math.max(a, parseInt(p.serial.replace(/\D/g, ''), 10) || 0), 0);
            const existing = new Set(S.all('pins').map(p => p.pin));
            const arr = new Uint32Array(2);
            for (let i = 0; i < n; i++) {
              let pin;
              do { (window.crypto || window.msCrypto).getRandomValues(arr); pin = String(arr[0] % 1e6).padStart(6, '0') + String(arr[1] % 1e6).padStart(6, '0'); } while (existing.has(pin));
              existing.add(pin);
              S.all('pins').push({ id: EPS.uid('pin'), serial: S.settings.admissionPrefix + String(++max).padStart(5, '0'), pin, studentId: null, uses: 0, maxUses: +d.maxUses, session: S.settings.session, term: S.settings.term, created: today() });
            }
            S.save(); S.log(me().id, 'Generated ' + n + ' result PINs.'); U.closeModal(); U.toast(n + ' PINs generated.'); P.rerender();
          };
        };
        $('#pin-export').onclick = () => U.downloadCSV('result-pins.csv', [['Serial', 'PIN', 'Uses', 'Max uses', 'Student', 'Admission no', 'Session', 'Term'], ...list.map(p => { const s = S.get('students', p.studentId); return [p.serial, p.pin, p.uses, p.maxUses, s ? S.studentName(s) : '', s ? s.admNo : '', p.session, p.term]; })]);
        $('#pin-print').onclick = () => {
          const unused = list.filter(p => !p.studentId);
          U.printHTML('Result PIN slips', '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">' + unused.map(p => '<div style="border:1px dashed #999;padding:12px;border-radius:8px;font-size:12px"><b>' + esc(S.settings.schoolName) + '</b><br>Result checker PIN<br><span style="font-size:18px;letter-spacing:2px;font-weight:800">' + esc(p.pin.replace(/(\d{4})(?=\d)/g, '$1 ')) + '</span><br>Serial: ' + esc(p.serial) + ' · ' + p.maxUses + ' uses<br><small>' + esc(location.href.split('portal.html')[0]) + 'index.html#/results</small></div>').join('') + '</div>');
        };
        $$('[data-unlink]').forEach(b => b.onclick = () => { S.update('pins', b.dataset.unlink, { studentId: null, uses: 0 }); U.toast('PIN reset.'); P.rerender(); });
      });
      const used = list.filter(p => p.studentId).length;
      return P.pageHead('Result PINs', list.length + ' PINs · ' + used + ' in use · parents use them on the public Result Checker.', '<button class="btn" id="pin-gen">Generate PINs</button><button class="btn ghost" id="pin-print">Print unused slips</button><button class="btn ghost" id="pin-export">Export CSV</button>') +
        '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>Serial</th><th>PIN</th><th>Student</th><th>Uses</th><th>Created</th><th></th></tr></thead><tbody>' +
        (list.length ? list.map(p => { const s = S.get('students', p.studentId); return '<tr><td>' + esc(p.serial) + '</td><td><code>' + esc(p.pin) + '</code></td><td>' + (s ? P.studentLink(s) : '<span class="muted">Unused</span>') + '</td><td>' + p.uses + ' / ' + p.maxUses + '</td><td>' + fmtDate(p.created, 'short') + '</td><td class="r">' + (s ? '<button class="btn sm ghost" data-unlink="' + p.id + '">Reset</button>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="6">' + P.empty('No PINs yet.') + '</td></tr>') + '</tbody></table></div></div>';
    }
  };

  /* =================== SETTINGS =================== */
  V.settings = {
    title: 'Settings',
    render(ctx) {
      const s = S.settings;
      const f = U.field;
      ctx.mount(() => {
        P.bindForm($('#set-form'), d => {
          const patch = Object.assign({}, d);
          patch.term = Number(d.term);
          patch.demoMode = d.demoMode === '1';
          patch.blockResultsIfOwing = d.blockResultsIfOwing === '1';
          patch.pinMaxUses = Number(d.pinMaxUses || 5);
          patch.bank = { name: d.bankName, accountName: d.bankAccountName, accountNumber: d.bankAccountNumber };
          patch.social = { facebook: d.facebook, instagram: d.instagram, youtube: d.youtube };
          ['bankName', 'bankAccountName', 'bankAccountNumber', 'facebook', 'instagram', 'youtube'].forEach(k => delete patch[k]);
          if (patch.termEnd && patch.termStart && patch.termEnd < patch.termStart) { U.toast('Term end is before term start.', 'warn'); return; }
          S.setSettings(patch); S.log(me().id, 'Updated school settings.');
          U.toast('Settings saved.'); P.rerender();
        });
      });
      const sec = (title, hint, inner) => '<div class="panel" style="margin-bottom:18px"><h3>' + title + '</h3>' + (hint ? '<p class="hint" style="margin-top:-8px">' + hint + '</p>' : '') + '<div class="form-grid three">' + inner + '</div></div>';
      return P.pageHead('Settings', 'School profile, academic calendar and portal options.') + '<form id="set-form">' +
        sec('School profile', 'Shown on the website, report cards and receipts. Fill in the official details confirmed by management.',
          f('schoolName', 'School name', { required: true, value: s.schoolName }) + f('shortName', 'Short name', { value: s.shortName }) + f('motto', 'Motto', { value: s.motto }) +
          f('address', 'Full address', { value: s.address, full: true }) + f('town', 'Town', { value: s.town }) + f('state', 'State', { value: s.state }) + f('tagline', 'Tagline', { value: s.tagline }) +
          f('phone', 'Phone', { type: 'tel', value: s.phone }) + f('whatsapp', 'WhatsApp number', { type: 'tel', value: s.whatsapp, hint: 'Adds a WhatsApp chat button to the website.' }) + f('email', 'Email', { type: 'email', value: s.email }) +
          f('officeHours', 'Office hours', { value: s.officeHours, placeholder: 'Mon–Fri, 8:00am – 4:00pm' }) + f('founded', 'Year founded', { value: s.founded }) + f('proprietor', 'Proprietor', { value: s.proprietor }) +
          f('principal', 'Principal (Secondary)', { value: s.principal }) + f('headteacher', 'Head teacher (Nursery & Primary)', { value: s.headteacher }) + f('mapQuery', 'Map location', { value: s.mapQuery, hint: 'Place name or coordinates for the map.' })) +
        sec('Academic session', 'Changing the term starts a fresh gradebook, register and fee period. Past records are kept.',
          f('session', 'Session', { required: true, value: s.session, placeholder: '2026/2027' }) + f('term', 'Current term', { type: 'select', options: EPS.TERMS.map((t, i) => ({ value: i + 1, label: t })), value: s.term, placeholder: false }) + f('admissionPrefix', 'Admission no. prefix', { value: s.admissionPrefix }) +
          f('termStart', 'Term starts', { type: 'date', value: s.termStart }) + f('termEnd', 'Term ends', { type: 'date', value: s.termEnd }) + f('nextTermBegins', 'Next term begins', { type: 'date', value: s.nextTermBegins })) +
        sec('Payments', 'Shown to parents on the fees page and the public admissions page.',
          f('bankName', 'Bank', { value: (s.bank || {}).name }) + f('bankAccountName', 'Account name', { value: (s.bank || {}).accountName }) + f('bankAccountNumber', 'Account number', { value: (s.bank || {}).accountNumber, inputmode: 'numeric' }) + f('currency', 'Currency symbol', { value: s.currency })) +
        sec('Social media', '', f('facebook', 'Facebook page link', { type: 'url', value: (s.social || {}).facebook }) + f('instagram', 'Instagram link', { type: 'url', value: (s.social || {}).instagram }) + f('youtube', 'YouTube link', { type: 'url', value: (s.social || {}).youtube })) +
        sec('Portal options', '',
          f('demoMode', 'Demo mode', { type: 'select', options: [{ value: '1', label: 'On — show demo hints & sample labels' }, { value: '', label: 'Off — live school' }], value: s.demoMode ? '1' : '', placeholder: false, hint: 'Turn off before sharing with parents.' }) +
          f('blockResultsIfOwing', 'Withhold results when fees are owing', { type: 'select', options: [{ value: '', label: 'No' }, { value: '1', label: 'Yes' }], value: s.blockResultsIfOwing ? '1' : '', placeholder: false }) +
          f('pinMaxUses', 'Default uses per result PIN', { type: 'number', min: 1, max: 20, value: s.pinMaxUses })) +
        '<div class="form-actions"><button class="btn">Save settings</button></div></form>';
    }
  };

  /* =================== DATA & BACKUP =================== */
  V.data = {
    title: 'Data & backup',
    render(ctx) {
      const json = S.exportJSON();
      const kb = Math.round(new Blob([json]).size / 1024);
      const limit = 5 * 1024;
      ctx.mount(() => {
        $('#bk-export').onclick = () => { U.download('epiphany-backup-' + today() + '.json', S.exportJSON(), 'application/json'); S.log(me().id, 'Downloaded a backup.'); };
        $('#bk-import').onchange = e => {
          const file = e.target.files[0]; if (!file) return;
          U.confirmBox('Replace ALL current data with the backup "' + file.name + '"? Download a backup of the current data first if you might need it.', () => {
            file.text().then(t => { try { S.importJSON(t); U.toast('Backup restored.'); P.go('dashboard'); } catch (err) { U.toast(err.message, 'bad'); } });
          }, { danger: true, yes: 'Restore backup' });
        };
        $('#bk-reset').onclick = () => U.confirmBox('Reset everything to the original demo data? All changes will be lost.', () => { S.reset(); U.toast('Demo data restored.'); P.go('dashboard'); }, { danger: true, yes: 'Reset demo' });
        $('#bk-fresh').onclick = () => U.confirmBox('Remove all sample students, staff, results, payments, news and messages so you can enter your real school data? Classes, subjects, timetables, fee items, FAQs, settings and your admin login are kept. Demo mode will be switched off.', startFresh, { danger: true, yes: 'Start fresh' });
      });
      return P.pageHead('Data & backup', 'Your school\'s records, safely kept.') +
        '<div class="notice-box warn" style="margin-bottom:18px"><b>Important:</b> in this edition, data is saved in this web browser on this device. Download a backup regularly (for example every Friday) and keep it somewhere safe. To share data across many devices, connect the portal to an online database — see the README.</div>' +
        '<div class="grid k2"><div class="panel"><h3>Storage</h3><p>' + kb + ' KB used of about ' + limit + ' KB available in this browser.</p><div class="storage-meter"><span style="width:' + Math.min(100, kb / limit * 100).toFixed(1) + '%;' + (kb / limit > .8 ? 'background:var(--red)' : '') + '"></span></div>' +
        '<dl class="dl" style="margin-top:16px">' + [['Students', S.all('students').length], ['User accounts', S.all('users').length], ['Score entries', S.all('scores').length], ['Attendance registers', S.all('attendance').length], ['Payments', S.all('payments').length], ['Messages', S.all('messages').length]].map(([k, v]) => '<dt>' + k + '</dt><dd>' + v + '</dd>').join('') + '</dl></div>' +
        '<div class="panel"><h3>Backup & restore</h3><div class="form-actions"><button class="btn" id="bk-export">⬇ Download backup</button><label class="btn ghost" style="cursor:pointer">⬆ Restore from backup<input type="file" id="bk-import" accept=".json,application/json" class="sr-only"></label></div>' +
        '<h3 style="margin-top:26px">Going live</h3><p class="muted">Ready to use the portal for your real school? Start fresh to clear the sample data.</p><div class="form-actions"><button class="btn danger" id="bk-fresh">Start fresh (remove sample data)</button><button class="btn ghost" id="bk-reset">Reset demo data</button></div></div></div>';
    }
  };
  function startFresh() {
    const d = S.data;
    const admin = d.users.find(u => u.id === me().id);
    d.users = [admin];
    d.classes.forEach(c => { c.teacherId = null; });
    ['students', 'scores', 'reports', 'attendance', 'payments', 'homework', 'news', 'events', 'applications', 'enquiries', 'messages', 'announcements', 'pins', 'testimonials', 'subscribers'].forEach(k => { d[k] = []; });
    d.settings.demoMode = false;
    d.settings.announcement = { active: false, text: '', link: '' };
    d.log = [];
    S.save(); S.log(admin.id, 'Started fresh — sample data removed.');
    U.toast('Sample data removed. Start by checking Settings, then add staff and students.');
    P.go('settings');
  }

  /* =================== ACTIVITY LOG =================== */
  V.activity = {
    title: 'Activity log',
    render() {
      const list = S.all('log');
      return P.pageHead('Activity log', 'The last ' + list.length + ' actions in the portal and on the website.') +
        '<div class="panel flush"><div class="table-wrap"><table><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>' +
        list.map(l => '<tr><td style="white-space:nowrap">' + fmtDate(l.at, 'datetime') + '</td><td>' + esc(l.user === 'public' ? 'Website visitor' : l.user === 'system' ? 'System' : S.userName(l.user)) + '</td><td>' + esc(l.text) + '</td></tr>').join('') + '</tbody></table></div></div>';
    }
  };
})();
