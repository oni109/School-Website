/* =====================================================================
   Epiphany Schools — shared UI helpers & components
   Used by both the public website and the portal.
   ===================================================================== */
(function (global) {
  'use strict';
  const EPS = global.EPS;
  const S = EPS.Store;

  /* ---------- escaping & formatting ---------- */
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const attr = esc;
  const paragraphs = text => String(text || '').split(/\n\s*\n/).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function parseDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  }
  function fmtDate(d, style) {
    const x = parseDate(d);
    if (!x || isNaN(x)) return '—';
    if (style === 'short') return x.getDate() + ' ' + MONTHS[x.getMonth()].slice(0, 3) + ' ' + x.getFullYear();
    if (style === 'day') return x.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    if (style === 'time') return x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (style === 'datetime') return fmtDate(x, 'short') + ', ' + x.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return x.getDate() + ' ' + MONTHS[x.getMonth()] + ' ' + x.getFullYear();
  }
  function relTime(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h ago';
    if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' d ago';
    return fmtDate(iso, 'short');
  }
  const money = n => (S.settings.currency || '₦') + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
  const num = (n, d = 1) => n == null || isNaN(n) ? '—' : Number(n).toFixed(d);
  const ordinal = n => { if (n == null) return '—'; const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
  const initials = name => String(name || '').split(/\s+/).filter(w => w && !/^(mr|mrs|miss|dr|rev|sr)\.?$/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const ageFrom = dob => { const d = parseDate(dob); if (!d) return ''; const n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a; };
  const placeholder = (v, text) => v ? esc(v) : '<span class="tbc">' + esc(text || 'To be confirmed') + '</span>';

  /* ---------- crest ---------- */
  function crest(size) {
    size = size || 48;
    return '<svg class="crest-svg" width="' + size + '" height="' + Math.round(size * 1.12) + '" viewBox="0 0 100 112" aria-hidden="true">' +
      '<path d="M4 4h92v62c0 22-20 36-46 42C24 102 4 88 4 66z" fill="#142b4a" stroke="#d9a441" stroke-width="4"/>' +
      '<path d="M50 18l4 10 11 1-8 7 3 11-10-6-10 6 3-11-8-7 11-1z" fill="#d9a441"/>' +
      '<rect x="47" y="52" width="6" height="34" rx="1" fill="#d9a441"/><rect x="36" y="60" width="28" height="6" rx="1" fill="#d9a441"/>' +
      '<path d="M22 80c10-6 18-6 28 0 10-6 18-6 28 0v6c-10-6-18-6-28 0-10-6-18-6-28 0z" fill="#ffffff" opacity=".9"/>' +
      '</svg>';
  }

  /* ---------- toast ---------- */
  function toast(msg, type) {
    let wrap = document.getElementById('toasts');
    if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toasts'; wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.textContent = msg;
    wrap.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); }, 4200);
  }

  /* ---------- modal ---------- */
  let lastFocus = null;
  function modal(opts) {
    closeModal();
    lastFocus = document.activeElement;
    const el = document.createElement('div');
    el.className = 'modal-backdrop';
    el.innerHTML = '<div class="modal ' + (opts.size || '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
      '<div class="modal-head"><h3 id="modal-title">' + esc(opts.title || '') + '</h3><button class="icon-btn" data-close aria-label="Close">✕</button></div>' +
      '<div class="modal-body">' + (opts.body || '') + '</div>' +
      (opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : '') + '</div>';
    document.body.appendChild(el);
    document.body.classList.add('modal-open');
    el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-close]')) closeModal(); });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    const first = el.querySelector('input,select,textarea,button:not([data-close])');
    (first || el.querySelector('[data-close]')).focus();
    if (opts.onOpen) opts.onOpen(el.querySelector('.modal'));
    return el.querySelector('.modal');
  }
  function closeModal() {
    const el = document.querySelector('.modal-backdrop');
    if (el) { el.remove(); document.body.classList.remove('modal-open'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  }
  function confirmBox(message, onYes, opts) {
    opts = opts || {};
    const m = modal({
      title: opts.title || 'Please confirm', size: 'sm',
      body: '<p>' + esc(message) + '</p>',
      foot: '<button class="btn ghost" data-close>Cancel</button><button class="btn ' + (opts.danger ? 'danger' : '') + '" id="confirm-yes">' + esc(opts.yes || 'Confirm') + '</button>'
    });
    m.querySelector('#confirm-yes').addEventListener('click', () => { closeModal(); onYes(); });
  }

  /* ---------- forms ---------- */
  function formData(form) {
    const out = {};
    new FormData(form).forEach((v, k) => { out[k] = typeof v === 'string' ? v.trim() : v; });
    return out;
  }
  function field(name, label, opts) {
    opts = opts || {};
    const id = 'f_' + name + '_' + Math.random().toString(36).slice(2, 6);
    const req = opts.required ? ' required' : '';
    const val = opts.value == null ? '' : opts.value;
    let input;
    if (opts.type === 'select') {
      input = '<select id="' + id + '" name="' + name + '"' + req + '>' + (opts.placeholder !== false ? '<option value="">' + esc(opts.placeholder || 'Select…') + '</option>' : '') +
        (opts.options || []).map(o => { const v = typeof o === 'object' ? o.value : o, l = typeof o === 'object' ? o.label : o; return '<option value="' + attr(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
    } else if (opts.type === 'textarea') {
      input = '<textarea id="' + id + '" name="' + name + '"' + req + ' rows="' + (opts.rows || 4) + '" placeholder="' + attr(opts.placeholder || '') + '">' + esc(val) + '</textarea>';
    } else {
      input = '<input id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '"' + req + ' value="' + attr(val) + '" placeholder="' + attr(opts.placeholder || '') + '"' +
        (opts.min != null ? ' min="' + opts.min + '"' : '') + (opts.max != null ? ' max="' + opts.max + '"' : '') + (opts.step ? ' step="' + opts.step + '"' : '') +
        (opts.pattern ? ' pattern="' + attr(opts.pattern) + '"' : '') + (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + '>';
    }
    return '<div class="field' + (opts.full ? ' full' : '') + '"><label for="' + id + '">' + esc(label) + (opts.required ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</label>' + input + (opts.hint ? '<small class="hint">' + esc(opts.hint) + '</small>' : '') + '</div>';
  }
  const validPhone = p => /^(\+?234|0)[789][01]\d{8}$/.test(String(p).replace(/[\s-]/g, ''));

  /* ---------- downloads ---------- */
  function download(filename, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function toCSV(rows) {
    return rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
  }
  function downloadCSV(filename, rows) { download(filename, '\ufeff' + toCSV(rows), 'text/csv;charset=utf-8'); }
  function parseCSV(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ''));
  }
  function icsFor(events) {
    const fmt = (d, t) => d.replace(/-/g, '') + (t ? 'T' + t.replace(':', '') + '00' : '');
    const nextDay = d => { const x = parseDate(d); x.setDate(x.getDate() + 1); return EPS.isoDate(x); };
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Epiphany Schools//Calendar//EN', 'CALSCALE:GREGORIAN'];
    events.forEach(e => {
      lines.push('BEGIN:VEVENT', 'UID:' + e.id + '@epiphany-schools', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z');
      if (e.time && !e.endDate) lines.push('DTSTART:' + fmt(e.date, e.time));
      else { lines.push('DTSTART;VALUE=DATE:' + fmt(e.date), 'DTEND;VALUE=DATE:' + fmt(nextDay(e.endDate || e.date))); }
      lines.push('SUMMARY:' + String(e.title).replace(/[,;]/g, '\\$&'));
      if (e.location) lines.push('LOCATION:' + String(e.location).replace(/[,;]/g, '\\$&'));
      if (e.desc) lines.push('DESCRIPTION:' + String(e.desc).replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&'));
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  /* ---------- print helper ---------- */
  function printHTML(title, html) {
    const w = window.open('', '_blank');
    if (!w) { toast('Please allow pop-ups to print.', 'warn'); return; }
    const css = Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(l => '<link rel="stylesheet" href="' + l.href + '">').join('');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title>' + css + '</head><body class="print-body">' + html +
      '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>');
    w.document.close();
  }

  /* ---------- shared components ---------- */
  function schoolHeader(subtitle) {
    const st = S.settings;
    return '<div class="doc-head">' + crest(54) + '<div><h2>' + esc(st.schoolName.toUpperCase()) + '</h2><p>' + esc(st.address) + '</p>' +
      '<p class="doc-motto">' + esc(st.motto) + '</p>' + (subtitle ? '<h3>' + esc(subtitle) + '</h3>' : '') + '</div></div>';
  }

  function reportCard(studentId, session, term) {
    const st = S.settings;
    session = session || st.session; term = term || st.term;
    const res = S.studentResult(studentId, session, term);
    if (!res) return '<p class="empty">No result found.</p>';
    const { row, cls, stats, count } = res;
    const s = row.student;
    const rep = S.report(studentId, session, term);
    const att = S.attendanceSummary(studentId);
    const teacher = cls.teacherId ? S.userName(cls.teacherId) : '';
    const isSec = cls.section === 'secondary';
    const scale = isSec ? EPS.GRADE_SCALES.secondary : EPS.GRADE_SCALES.basic;
    const rating = obj => Object.entries(obj || {}).map(([k, v]) => '<tr><td>' + esc(k) + '</td>' + [5, 4, 3, 2, 1].map(n => '<td class="c">' + (Number(v) === n ? '✓' : '') + '</td>').join('') + '</tr>').join('');
    const incomplete = row.subjects.some(x => !x.complete);
    return '<article class="report-card">' + schoolHeader(EPS.TERMS[term - 1].toUpperCase() + ' REPORT · ' + session + ' SESSION') +
      (incomplete ? '<div class="rc-warning">Provisional — some scores have not yet been entered.</div>' : '') +
      '<div class="rc-info">' +
      '<div><span>Name</span><b>' + esc(S.studentName(s, { formal: true })) + '</b></div>' +
      '<div><span>Admission no.</span><b>' + esc(s.admNo) + '</b></div>' +
      '<div><span>Class</span><b>' + esc(cls.name) + '</b></div>' +
      '<div><span>Gender</span><b>' + esc(s.gender) + '</b></div>' +
      '<div><span>Position</span><b>' + (row.position ? ordinal(row.position) + ' of ' + count : '—') + '</b></div>' +
      '<div><span>Average</span><b>' + num(row.average) + '%</b></div>' +
      '<div><span>Total score</span><b>' + Math.round(row.total) + '</b></div>' +
      '<div><span>Attendance</span><b>' + (att.total ? (att.present + att.late) + ' / ' + att.total + ' days' : '—') + '</b></div>' +
      '</div>' +
      '<div class="table-wrap"><table class="rc-table"><thead><tr><th>Subject</th><th>CA 1<small>/' + EPS.ASSESSMENT.ca1 + '</small></th><th>CA 2<small>/' + EPS.ASSESSMENT.ca2 + '</small></th><th>Exam<small>/' + EPS.ASSESSMENT.exam + '</small></th><th>Total<small>/100</small></th><th>Grade</th><th>Pos.</th><th>Class avg</th><th>Highest</th><th>Remark</th></tr></thead><tbody>' +
      row.subjects.map(x => '<tr><td>' + esc(x.subject) + '</td><td class="c">' + (x.ca1 ?? '–') + '</td><td class="c">' + (x.ca2 ?? '–') + '</td><td class="c">' + (x.exam ?? '–') + '</td><td class="c"><b>' + (x.complete ? x.total : '–') + '</b></td><td class="c grade g-' + esc(String(x.grade).charAt(0)) + '">' + esc(x.grade) + '</td><td class="c">' + (x.position ? ordinal(x.position) : '–') + '</td><td class="c">' + num(stats[x.subject].avg) + '</td><td class="c">' + (stats[x.subject].high ?? '–') + '</td><td>' + esc(x.remark) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<div class="rc-grid">' +
      '<div><h4>Affective domain</h4><table class="rc-mini"><thead><tr><th>Trait</th><th>5</th><th>4</th><th>3</th><th>2</th><th>1</th></tr></thead><tbody>' + rating(rep.affective) + '</tbody></table></div>' +
      '<div><h4>Psychomotor skills</h4><table class="rc-mini"><thead><tr><th>Skill</th><th>5</th><th>4</th><th>3</th><th>2</th><th>1</th></tr></thead><tbody>' + rating(rep.psychomotor) + '</tbody></table>' +
      '<h4>Grading key</h4><p class="rc-key">' + scale.map(([min, g, r]) => '<span><b>' + g + '</b> ' + min + '+ ' + r + '</span>').join('') + '</p><p class="rc-key"><span>5 Excellent</span><span>4 Very good</span><span>3 Good</span><span>2 Fair</span><span>1 Poor</span></p></div>' +
      '</div>' +
      '<div class="rc-remarks">' +
      '<div><span>Class teacher\'s remark' + (teacher ? ' (' + esc(teacher) + ')' : '') + '</span><p>' + esc(rep.teacherRemark || (row.average != null ? EPS.autoRemark(row.average) : '')) + '</p></div>' +
      '<div><span>' + (isSec ? 'Principal' : 'Head teacher') + '\'s remark</span><p>' + esc(rep.principalRemark || (row.average != null ? (row.average >= 50 ? 'Promising. Keep working hard.' : 'Needs to put in more effort next term.') : '')) + '</p></div>' +
      '</div>' +
      '<div class="rc-foot"><span>Next term begins: <b>' + fmtDate(st.nextTermBegins) + '</b></span><span>Date issued: <b>' + fmtDate(new Date()) + '</b></span><span class="sig">Signature &amp; stamp</span></div>' +
      '</article>';
  }

  function receipt(paymentId) {
    const p = S.get('payments', paymentId);
    if (!p) return '';
    const s = S.get('students', p.studentId);
    const c = S.classOf(s);
    const fs = S.feeStatus(p.studentId, p.session, p.term);
    return '<article class="receipt">' + schoolHeader('OFFICIAL RECEIPT') +
      '<div class="rc-info">' +
      '<div><span>Receipt no.</span><b>' + esc(p.receipt) + '</b></div><div><span>Date</span><b>' + fmtDate(p.date) + '</b></div>' +
      '<div><span>Student</span><b>' + esc(S.studentName(s)) + '</b></div><div><span>Admission no.</span><b>' + esc(s ? s.admNo : '') + '</b></div>' +
      '<div><span>Class</span><b>' + esc(c ? c.name : '') + '</b></div><div><span>Term</span><b>' + esc(EPS.TERMS[p.term - 1] + ' ' + p.session) + '</b></div>' +
      '<div><span>Method</span><b>' + esc(p.method) + '</b></div><div><span>Received by</span><b>' + esc(S.userName(p.receivedBy)) + '</b></div>' +
      '</div><div class="receipt-amount"><span>Amount paid</span><b>' + money(p.amount) + '</b>' + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div>' +
      '<table class="rc-mini wide"><tbody><tr><td>Total fees for term</td><td class="r">' + money(fs.due) + '</td></tr><tr><td>Total paid to date</td><td class="r">' + money(fs.paid) + '</td></tr><tr><td><b>Balance</b></td><td class="r"><b>' + money(Math.max(0, fs.balance)) + '</b></td></tr></tbody></table>' +
      '<div class="rc-foot"><span>Thank you.</span><span class="sig">Bursar\'s signature</span></div></article>';
  }

  function timetableHTML(classId, highlightToday) {
    const tt = S.get('timetables', classId);
    const periods = S.all('periods');
    if (!tt) return '<p class="empty">No timetable yet.</p>';
    const todayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' });
    return '<div class="table-wrap"><table class="timetable"><thead><tr><th>Day</th>' + periods.map(p => '<th class="' + (p.isBreak ? 'brk' : '') + '">' + esc(p.isBreak ? p.label : 'Period ' + p.label) + '<small>' + esc(p.time) + '</small></th>').join('') + '</tr></thead><tbody>' +
      EPS.DAYS.map(day => '<tr class="' + (highlightToday && day === todayName ? 'today' : '') + '"><th>' + day + '</th>' + periods.map((p, i) => p.isBreak ? '<td class="brk">' + (day === 'Monday' ? '<span>' + esc(p.label) + '</span>' : '') + '</td>' : '<td>' + esc((tt.grid[day] || [])[i] || '') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  /** Simple accessible SVG bar chart. data: [{label, value, color?}] */
  function barChart(data, opts) {
    opts = opts || {};
    const max = Math.max(1, ...data.map(d => d.value)) * 1.1;
    const fmt = opts.format || (v => v);
    return '<div class="bars" role="list">' + data.map(d => '<div class="bar-row" role="listitem"><span class="bar-label">' + esc(d.label) + '</span><span class="bar-track"><span class="bar-fill" style="width:' + (d.value / max * 100).toFixed(1) + '%' + (d.color ? ';background:' + d.color : '') + '"></span></span><span class="bar-val">' + esc(fmt(d.value)) + '</span></div>').join('') + '</div>';
  }
  function donut(pct, label, color) {
    const p = Math.max(0, Math.min(100, pct || 0));
    const c = 2 * Math.PI * 42;
    return '<div class="donut"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" class="donut-bg"/><circle cx="50" cy="50" r="42" class="donut-fg" style="stroke:' + (color || 'var(--gold)') + ';stroke-dasharray:' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><div><b>' + Math.round(p) + '%</b><small>' + esc(label || '') + '</small></div></div>';
  }

  /* ---------- theme ---------- */
  function initTheme() {
    let t = null;
    try { t = localStorage.getItem('eps.theme'); } catch (e) { }
    if (t) document.documentElement.setAttribute('data-theme', t);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('eps.theme', next); } catch (e) { }
  }
  initTheme();

  /* ---------- PWA ---------- */
  if ('serviceWorker' in navigator && /^https?:/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }

  EPS.UI = {
    esc, attr, paragraphs, fmtDate, parseDate, relTime, money, num, ordinal, initials, ageFrom, placeholder, MONTHS,
    crest, toast, modal, closeModal, confirmBox, formData, field, validPhone,
    download, downloadCSV, toCSV, parseCSV, icsFor, printHTML,
    schoolHeader, reportCard, receipt, timetableHTML, barChart, donut, toggleTheme
  };
})(window);
