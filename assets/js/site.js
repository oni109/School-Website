/* =====================================================================
   Epiphany Schools — public website (hash-routed single page app)
   ===================================================================== */
(function () {
  'use strict';
  const EPS = window.EPS, S = EPS.Store, U = EPS.UI, Cloud = EPS.Cloud;
  const { esc, attr, fmtDate, money, placeholder } = U;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const main = $('#main');
  const st = () => S.settings;
  const IMG = id => 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=1800&q=80';

  /* ---------- layout chrome ---------- */
  function renderChrome() {
    const s = st();
    $('#brand-crest').innerHTML = U.crest(46);
    $('#brand-name').textContent = s.schoolName.toUpperCase();
    $('#brand-sub').textContent = (s.town + ' · ' + s.state).toUpperCase();
    $('#topbar-loc').textContent = '📍 ' + s.address;
    document.title = s.schoolName + ' | ' + s.town;

    let dismissed = false;
    try { dismissed = sessionStorage.getItem('eps.annDismissed') === s.announcement.text; } catch (e) { }
    $('#announce').innerHTML = s.announcement && s.announcement.active && s.announcement.text && !dismissed
      ? '<div class="announce" role="region" aria-label="Announcement"><span>📣 ' + esc(s.announcement.text) + (s.announcement.link ? ' <a href="' + attr(s.announcement.link) + '">Learn more</a>' : '') + '</span><button aria-label="Dismiss announcement" id="ann-x">✕</button></div>' : '';
    const x = $('#ann-x');
    if (x) x.onclick = () => { try { sessionStorage.setItem('eps.annDismissed', s.announcement.text); } catch (e) { } $('#announce').innerHTML = ''; };

    const wa = $('#whatsapp');
    const waNum = String(s.whatsapp || '').replace(/\D/g, '').replace(/^0/, '234');
    if (waNum) { wa.hidden = false; wa.href = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent('Hello ' + s.schoolName + ', I would like to make an enquiry.'); } else wa.hidden = true;

    $('#footer').innerHTML = '<div class="footer-grid">' +
      '<div><a class="brand" href="#/">' + U.crest(42) + '<span><strong>' + esc(s.schoolName.toUpperCase()) + '</strong><small>' + esc((s.town + ' · ' + s.state).toUpperCase()) + '</small></span></a>' +
      '<p style="max-width:300px">' + esc(s.motto) + '. A Catholic school community for nursery, primary and secondary education.</p>' +
      '<form class="newsletter" id="newsletter"><label class="sr-only" for="nl-email">Email for school updates</label><input id="nl-email" type="email" required placeholder="Email for school updates"><button class="btn sm">Join</button></form></div>' +
      '<div><h4>EXPLORE</h4><a href="#/about">About the school</a><a href="#/academics">Academics</a><a href="#/news">News</a><a href="#/calendar">School calendar</a><a href="#/gallery">Gallery</a></div>' +
      '<div><h4>FOR FAMILIES</h4><a href="#/admissions">Admissions &amp; fees</a><a href="#/apply">Apply online</a><a href="#/track">Track an application</a><a href="#/results">Result checker</a><a href="portal.html">Parent &amp; staff portal</a><a href="#/faq">FAQs</a></div>' +
      '<div><h4>CONTACT</h4><p>' + esc(s.address) + '</p>' +
      (s.phone ? '<a href="tel:' + attr(s.phone) + '">📞 ' + esc(s.phone) + '</a>' : '') +
      (s.email ? '<a href="mailto:' + attr(s.email) + '">✉ ' + esc(s.email) + '</a>' : '') +
      '<a href="https://orludiocese.org/schools/" target="_blank" rel="noopener">' + esc(s.proprietor) + ' ↗</a>' +
      ['facebook', 'instagram', 'youtube'].filter(k => s.social && s.social[k]).map(k => '<a href="' + attr(s.social[k]) + '" target="_blank" rel="noopener">' + k[0].toUpperCase() + k.slice(1) + ' ↗</a>').join('') +
      '</div></div>' +
      '<div class="copyright"><span>© ' + new Date().getFullYear() + ' ' + esc(s.schoolName) + '. All rights reserved.</span><span><a href="#/contact">Contact</a> · <a href="#/faq">FAQs</a> · <a href="portal.html">Portal</a></span></div>';
    $('#newsletter').addEventListener('submit', e => {
      e.preventDefault();
      const email = $('#nl-email').value.trim();
      const done = () => { e.target.reset(); U.toast('Thank you — you will receive school updates.'); };
      if (S.cloud) { Cloud.rpc('subscribe_updates', { p_email: email }).then(done, err => U.toast(err.message, 'bad')); return; }
      if (!S.find('subscribers', x => x.email === email)) S.insert('subscribers', { email, created: new Date().toISOString() });
      done();
    });
  }

  /* ---------- helpers ---------- */
  const pageHero = (eyebrow, title, text, img, crumbs) =>
    '<section class="page-hero" style="--img:url(\'' + attr(img || IMG('photo-1523050854058-8df90110c9f1')) + '\')"><div class="crumbs"><a href="#/">Home</a> / ' + esc(crumbs || title) + '</div><div class="eyebrow">' + esc(eyebrow) + '</div><h1>' + esc(title) + '</h1>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</section>';
  const sectionHead = (eyebrow, title, text, center) => '<div class="section-head' + (center ? ' center' : '') + '"><div class="eyebrow">' + esc(eyebrow) + '</div><h2>' + esc(title) + '</h2>' + (text ? '<p>' + esc(text) + '</p>' : '') + '</div>';
  const newsCard = n => '<a class="card" href="#/news/' + attr(n.slug || n.id) + '"><div class="card-img" style="background-image:url(\'' + attr(n.image) + '\')"></div><div class="card-body"><small>' + esc(n.category) + ' · ' + fmtDate(n.date, 'short') + '</small><h3>' + esc(n.title) + '</h3><p>' + esc(n.summary) + '</p><span class="text-link">Read more</span></div></a>';
  const upcoming = n => S.all('events').filter(e => (e.endDate || e.date) >= EPS.today()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n || 99);
  const eventItem = e => { const d = U.parseDate(e.date); return '<div class="event-item"><div class="date-box"><b>' + d.getDate() + '</b><span>' + U.MONTHS[d.getMonth()].slice(0, 3) + '</span></div><div class="grow"><h3>' + esc(e.title) + '</h3><p>' + (e.endDate ? fmtDate(e.date, 'short') + ' – ' + fmtDate(e.endDate, 'short') : fmtDate(e.date, 'day')) + (e.time ? ' · ' + esc(e.time) : '') + (e.location ? ' · ' + esc(e.location) : '') + '</p></div><span class="badge cat-' + attr(e.category) + '">' + esc(e.category) + '</span></div>'; };
  const published = () => S.all('news').filter(n => n.published !== false).sort((a, b) => b.date.localeCompare(a.date));

  /* ---------- pages ---------- */
  const pages = {};

  pages.home = () => {
    const s = st();
    const news = published().slice(0, 3);
    const evs = upcoming(4);
    const nStudents = S.all('students').filter(x => x.status === 'Active').length;
    const nStaff = S.all('users').filter(u => u.role === 'teacher').length;
    return '<section class="hero"><div class="hero-inner"><div class="eyebrow">A tradition of learning. A future of possibilities.</div><h1>Discover the gift of a great education.</h1><p>From the first steps in nursery to the confidence of secondary school, ' + esc(s.schoolName) + ' is a nurturing Catholic community where young minds grow in knowledge, faith, discipline and purpose.</p><div class="hero-actions"><a class="btn" href="#/apply">APPLY FOR ADMISSION</a><a class="btn outline" href="#/about">DISCOVER ' + esc(s.shortName.toUpperCase()) + '</a></div>' +
      '<div class="hero-note"><span><b>3</b>Learning stages</span><span><b>' + S.all('classes').length + '</b>Classes, Nursery 1 – SS 3</span><span><b>' + esc(s.session) + '</b>' + esc(S.termLabel()) + ' in session</span></div></div></section>' +
      '<div class="quick">' +
      '<a href="#/apply"><span class="q-ico">📝</span><span><b>Apply online</b><small>Start an admission application</small></span></a>' +
      '<a href="#/results"><span class="q-ico">📊</span><span><b>Check results</b><small>View a report card with a PIN</small></span></a>' +
      '<a href="portal.html"><span class="q-ico">👪</span><span><b>Parent portal</b><small>Results, fees, attendance</small></span></a>' +
      '<a href="#/calendar"><span class="q-ico">📅</span><span><b>Calendar</b><small>Term dates and events</small></span></a>' +
      '<a href="#/contact"><span class="q-ico">☎️</span><span><b>Contact us</b><small>Visit or send an enquiry</small></span></a></div>' +

      '<section class="section"><div class="two-col"><div class="welcome-photo reveal"><div class="photo-tag">Growing minds. Building character. Inspiring futures.</div></div><div class="reveal"><div class="eyebrow">Welcome to ' + esc(s.schoolName) + '</div><h2>Education with purpose, care and a strong foundation.</h2><p>' + esc(s.schoolName) + ' brings nursery, primary and secondary education together in one learning journey — a school community committed to helping every child develop academically, socially, morally and spiritually.</p><p>Guided by Catholic educational values, we unite sound teaching, personal responsibility, respect for others and a lifelong love of learning.</p><div class="checks"><span>Child-centred learning</span><span>Values-based formation</span><span>Caring, qualified teachers</span><span>Well-rounded development</span></div><a class="text-link" href="#/about">Read our story</a></div></div></section>' +

      '<section class="section alt">' + sectionHead('One community, three stages', 'A complete learning journey', 'Purposeful learning at every stage, with age-appropriate care, challenge and encouragement.', true) + '<div class="cards">' +
      levelCard('nursery', 'Early years', 'Nursery School', 'A warm and stimulating start where children explore, play, communicate and build the confidence needed for lifelong learning.', 'photo-1503454537195-1dcabb73ffb9') +
      levelCard('primary', 'Foundational learning', 'Primary School', 'Strong foundations in literacy, numeracy, science, creativity and good character, preparing pupils for Common Entrance and beyond.', 'photo-1509062522246-3755977927d7') +
      levelCard('secondary', 'Junior & Senior Secondary', 'Secondary School', 'Academic depth, practical skills and leadership, preparing students for BECE, WAEC and NECO — and for life beyond school.', 'photo-1529390079861-591de354faf5') +
      '</div></section>' +

      '<section class="section"><div class="two-col"><div class="reveal"><div class="eyebrow">The ' + esc(s.shortName) + ' experience</div><h2>More than lessons. A foundation for life.</h2><p class="muted">A balanced education recognises that every learner has potential.</p><div class="feature-list">' +
      feature('📚', 'Strong academic foundations', 'Engaging teaching and clear learning goals across core and specialist subjects, with continuous assessment every term.') +
      feature('✝', 'Faith and moral formation', 'Daily prayer, Mass, and a culture of respect, compassion, honesty and service.') +
      feature('💻', 'Practical and digital skills', 'Computer studies, science practicals and projects that prepare learners for a changing world.') +
      feature('👪', 'Families kept informed', 'An online portal for results, attendance, homework, fees and direct messages with teachers.') +
      '</div></div><div class="feature-image reveal"></div></div></section>' +

      '<section class="section tight alt"><div class="stats reveal"><div><b>' + nStudents + '+</b><span>Learners enrolled</span></div><div><b>' + nStaff + '+</b><span>Dedicated teachers</span></div><div><b>' + S.all('classes').length + '</b><span>Classes</span></div><div><b>4</b><span>School houses</span></div></div>' +
      (s.demoMode ? '<p class="hint c" style="margin-top:10px">Figures reflect the demonstration data currently loaded.</p>' : '') + '</section>' +

      '<section class="quote"><blockquote>“Let the little children come to me…”</blockquote><small>MATTHEW 19:14 · FAITH, LEARNING AND HOPE</small></section>' +

      '<section class="section"><div class="two-col top"><div>' + sectionHead('Latest from school', 'News & announcements') + '<div class="cards two">' + news.slice(0, 2).map(newsCard).join('') + '</div><p style="margin-top:20px"><a class="text-link" href="#/news">All news</a></p></div>' +
      '<div>' + sectionHead('Coming up', 'Upcoming events') + '<div class="event-list">' + (evs.length ? evs.map(eventItem).join('') : '<p class="empty">No upcoming events.</p>') + '</div><p style="margin-top:20px"><a class="text-link" href="#/calendar">Full school calendar</a></p></div></div></section>' +

      '<section class="section alt">' + sectionHead('What families say', 'A community that cares', '', true) + '<div class="testimonials">' +
      S.all('testimonials').map(t => '<div class="testimonial reveal"><p>' + esc(t.quote) + '</p><b>— ' + esc(t.name) + '</b>' + (t.sample ? ' <span class="sample-tag">Sample</span>' : '') + '</div>').join('') + '</div></section>' +

      admissionsCTA();
  };
  function levelCard(key, small, title, text, img) {
    return '<a class="card reveal" href="#/academics#' + key + '"><div class="card-img" style="background-image:url(\'' + IMG(img).replace('w=1800', 'w=900') + '\')"></div><div class="card-body"><small>' + esc(small) + '</small><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><span class="text-link">Discover ' + esc(title.split(' ')[0].toLowerCase()) + '</span></div></a>';
  }
  const feature = (ico, h, p) => '<div class="feature"><div class="feature-icon">' + ico + '</div><div><h3>' + esc(h) + '</h3><p>' + esc(p) + '</p></div></div>';
  const admissionsCTA = () => '<section class="admissions-cta"><div><div class="eyebrow">Admissions ' + esc(st().session) + '</div><h2>Give your child a strong start.</h2><p>Applications are open for Nursery, Primary and Secondary. Apply online in a few minutes and track your application status at any time.</p></div><div class="actions"><a class="btn" href="#/apply">APPLY ONLINE</a><a class="btn outline" href="#/admissions">FEES &amp; REQUIREMENTS</a></div></section>';

  pages.about = () => {
    const s = st();
    const leaders = [
      ['Proprietor', s.proprietor], ['Principal (Secondary)', s.principal], ['Head Teacher (Nursery & Primary)', s.headteacher]
    ];
    return pageHero('About us', 'Our story, mission and values', 'A Catholic school community serving families in ' + s.town + ' and beyond.', IMG('photo-1503676260728-1c00da094a0b'), 'About') +
      '<section class="section"><div class="two-col"><div class="prose"><div class="eyebrow">Who we are</div><h2>Rooted in faith. Committed to excellence.</h2>' +
      '<p>' + esc(s.schoolName) + ' comprises Epiphany Nursery and Primary School and Epiphany Secondary School, ' + esc(s.town) + ', listed among the schools of the ' + esc(s.proprietor) + '.</p>' +
      '<p>Our purpose is to offer a complete, connected learning journey — from a child\'s first day in nursery to their final examinations in senior secondary — in a safe, disciplined and caring environment shaped by the Gospel.</p>' +
      '<p><b>Founded:</b> ' + placeholder(s.founded) + '</p></div>' +
      '<div class="welcome-photo" style="background-image:url(\'' + IMG('photo-1497633762265-9d179a990aa6') + '\')"></div></div></section>' +
      '<section class="section alt"><div class="cards two">' +
      '<div class="pad-card"><div class="ico">🎯</div><h3>Our mission</h3><p>To form young people in faith, knowledge and character through excellent teaching, loving discipline and a partnership with families, so that each learner can reach their God-given potential.</p></div>' +
      '<div class="pad-card"><div class="ico">🔭</div><h3>Our vision</h3><p>To be a leading Catholic school community whose learners are confident, competent, compassionate and ready to serve God, their families and Nigeria.</p></div>' +
      '</div></section>' +
      '<section class="section">' + sectionHead('What shapes our community', 'Values that guide every learner', 'Our motto — ' + s.motto + ' — is lived out in four core values.', true) + '<div class="cards four">' +
      [['🌟', 'Excellence', 'Encouraging each learner to strive, improve and take pride in doing their best.'], ['🤝', 'Integrity', 'Building honesty, respect, discipline and responsibility in everyday life.'], ['❤️', 'Compassion', 'Creating a caring environment where every child is valued and supported.'], ['🌱', 'Growth', 'Helping learners develop confidence, curiosity, resilience and purpose.']]
        .map(v => '<div class="pad-card reveal"><div class="ico">' + v[0] + '</div><h3>' + v[1] + '</h3><p>' + v[2] + '</p></div>').join('') + '</div></section>' +
      '<section class="section alt">' + sectionHead('Leadership', 'School leadership', 'Names will be published once confirmed by school management.', true) + '<div class="cards">' +
      leaders.map(l => '<div class="pad-card leader"><div class="avatar">' + (l[1] ? esc(U.initials(l[1])) : '✝') + '</div><h3>' + placeholder(l[1]) + '</h3><p>' + esc(l[0]) + '</p></div>').join('') + '</div></section>' +
      '<section class="section">' + sectionHead('Our campus', 'Facilities for learning and growth', '', true) + '<div class="cards four">' +
      [['🏫', 'Bright classrooms', 'Well-ventilated classrooms for every class from Nursery 1 to SS 3.'], ['🔬', 'Science laboratories', 'Practical work in Biology, Chemistry, Physics and Basic Science.'], ['💻', 'ICT centre', 'Computer studies and digital literacy for primary and secondary learners.'], ['📖', 'Library', 'A growing collection of books for reading, research and quiet study.'], ['⛪', 'Chapel', 'Daily prayer, Mass and the sacraments at the heart of school life.'], ['⚽', 'Sports field', 'Football, athletics and inter-house sports.'], ['🧸', 'Nursery play area', 'A safe space for early-years play and discovery.'], ['🩺', 'Sick bay', 'First aid and care for learners who feel unwell.']]
        .map(v => '<div class="pad-card reveal"><div class="ico">' + v[0] + '</div><h3>' + v[1] + '</h3><p>' + v[2] + '</p></div>').join('') + '</div>' +
      (s.demoMode ? '<p class="hint c" style="margin-top:16px">Facilities listed are typical of the school\'s profile — confirm with management before publication.</p>' : '') + '</section>' + admissionsCTA();
  };

  pages.academics = () => {
    const groups = [
      ['nursery', 'Nursery School', 'Nursery 1 – 3', 'Learning through play, songs, stories and hands-on discovery. Children build early literacy and numeracy, social skills, and good habits of health and prayer.', 'photo-1503454537195-1dcabb73ffb9', ['nursery']],
      ['primary', 'Primary School', 'Primary 1 – 6', 'Following the national Basic Education curriculum, pupils develop strong foundations in English, Mathematics and Science, alongside Igbo language, creative arts and moral instruction. Primary 6 pupils are prepared for the Common Entrance examination.', 'photo-1509062522246-3755977927d7', ['primary']],
      ['secondary', 'Secondary School', 'JSS 1 – 3 · SS 1 – 3', 'Junior Secondary students take a broad curriculum leading to the Basic Education Certificate Examination (BECE). Senior Secondary students specialise and are prepared for WAEC and NECO SSCE examinations.', 'photo-1529390079861-591de354faf5', ['junior', 'senior']]
    ];
    const label = { nursery: 'Nursery subjects', primary: 'Primary subjects', junior: 'Junior Secondary (JSS) subjects', senior: 'Senior Secondary (SS) subjects' };
    return pageHero('Academics', 'Learning at every stage', 'A broad, balanced curriculum with continuous assessment, regular feedback and strong exam preparation.', IMG('photo-1532094349884-543bc11b234d'), 'Academics') +
      groups.map((g, i) => '<section class="section' + (i % 2 ? ' alt' : '') + '" id="' + g[0] + '"><div class="two-col top"><div><div class="eyebrow">' + esc(g[2]) + '</div><h2>' + esc(g[1]) + '</h2><p class="lead">' + esc(g[3]) + '</p>' +
        '<p><b>Classes:</b> ' + S.sortedClasses().filter(c => c.section === g[0]).map(c => esc(c.name)).join(', ') + '</p>' +
        g[5].map(k => '<h3 style="margin:22px 0 10px;font-size:15px">' + esc(label[k]) + '</h3><div class="filters">' + (S.data.subjects[k] || []).map(x => '<span class="badge gold">' + esc(x) + '</span>').join('') + '</div>').join('') +
        '</div><div class="welcome-photo" style="background-image:url(\'' + IMG(g[4]).replace('w=1800', 'w=1000') + '\');min-height:380px"></div></div></section>').join('') +
      '<section class="section">' + sectionHead('Assessment', 'How learners are assessed', 'Every subject is assessed through two continuous assessments and an end-of-term examination. Report cards show scores, grades, class position, conduct ratings and teachers\' remarks.') +
      '<div class="cards">' + [['📝', 'First CA', EPS.ASSESSMENT.ca1 + ' marks — tests, classwork and assignments in the first half of term.'], ['🧪', 'Second CA', EPS.ASSESSMENT.ca2 + ' marks — tests, projects and practicals in the second half of term.'], ['🎓', 'Examination', EPS.ASSESSMENT.exam + ' marks — the end-of-term examination in every subject.']].map(v => '<div class="pad-card"><div class="ico">' + v[0] + '</div><h3>' + v[1] + '</h3><p>' + v[2] + '</p></div>').join('') + '</div>' +
      '<div class="cards two" style="margin-top:30px"><div><h3>Secondary grading (WAEC scale)</h3><div class="table-wrap grade-table"><table><thead><tr><th>Score</th><th>Grade</th><th>Remark</th></tr></thead><tbody>' + gradeRows(EPS.GRADE_SCALES.secondary) + '</tbody></table></div></div>' +
      '<div><h3>Nursery & Primary grading</h3><div class="table-wrap grade-table"><table><thead><tr><th>Score</th><th>Grade</th><th>Remark</th></tr></thead><tbody>' + gradeRows(EPS.GRADE_SCALES.basic) + '</tbody></table></div></div></div></section>' +
      '<section class="section alt">' + sectionHead('Beyond the classroom', 'Clubs, societies & activities', '', true) + '<div class="cards four">' +
      [['🔬', 'JETS Club', 'Junior Engineers, Technicians and Scientists — projects and science fairs.'], ['🗣', 'Debate & Literary', 'Public speaking, debates, quizzes and creative writing.'], ['🎵', 'Choir & Music', 'Liturgical choir, carols and cultural music.'], ['⚽', 'Sports', 'Football, athletics, table tennis and inter-house sports.'], ['🙏', 'Catholic societies', 'Legion of Mary, Altar servers and Catholic Youth groups.'], ['🎨', 'Arts & Culture', 'Drama, dance, drawing and cultural day celebrations.'], ['💻', 'Coding Club', 'Digital skills, typing and introductory programming.'], ['🌍', 'Red Cross & Scouts', 'First aid, service and leadership training.']]
        .map(v => '<div class="pad-card"><div class="ico">' + v[0] + '</div><h3>' + v[1] + '</h3><p>' + v[2] + '</p></div>').join('') + '</div></section>' + admissionsCTA();
  };
  const gradeRows = scale => scale.map(([min, g, r], i) => '<tr><td>' + min + ' – ' + (i === 0 ? 100 : scale[i - 1][0] - 1) + '</td><td><b>' + g + '</b></td><td>' + r + '</td></tr>').join('');

  pages.admissions = () => {
    const groups = [['nursery', 'Nursery'], ['primary', 'Primary'], ['junior', 'JSS'], ['senior', 'SS']];
    const faqs = S.all('faqs').slice(0, 4);
    setTimeout(() => {
      const box = $('#fee-box');
      const show = g => {
        const f = S.find('feeSchedule', x => x.group === g);
        const items = f ? f.items : [];
        const total = items.reduce((a, b) => a + Number(b.amount), 0);
        box.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Item</th><th class="r">Amount per term</th></tr></thead><tbody>' + items.map(i => '<tr><td>' + esc(i.name) + '</td><td class="r">' + money(i.amount) + '</td></tr>').join('') + '<tr><td><b>Total per term</b></td><td class="r"><b>' + money(total) + '</b></td></tr></tbody></table></div>';
        $$('#fee-tabs .chip-btn').forEach(b => b.classList.toggle('active', b.dataset.g === g));
      };
      $$('#fee-tabs .chip-btn').forEach(b => b.onclick = () => show(b.dataset.g));
      show('nursery');
    });
    return pageHero('Admissions', 'Join the ' + st().shortName + ' family', 'Admissions are open for the ' + st().session + ' session. Here is everything you need to know.', IMG('photo-1523050854058-8df90110c9f1'), 'Admissions') +
      '<section class="section">' + sectionHead('How to apply', 'Five simple steps', '', true) + '<div class="steps">' +
      [['Apply online', 'Complete the online form, or collect a form at the school office.'], ['Get a reference', 'You receive an application reference number instantly.'], ['Visit & assessment', 'Nursery: informal interaction. Primary & Secondary: entrance examination.'], ['Admission decision', 'Track your status online with your reference and phone number.'], ['Accept & resume', 'Pay acceptance and first-term fees, then collect your child\'s admission number.']].map(x => '<div class="step"><h3>' + x[0] + '</h3><p>' + x[1] + '</p></div>').join('') +
      '</div><div class="form-actions" style="justify-content:center;margin-top:28px"><a class="btn" href="#/apply">START APPLICATION</a><a class="btn ghost" href="#/track">TRACK AN APPLICATION</a></div></section>' +
      '<section class="section alt"><div class="two-col top"><div><div class="eyebrow">Requirements</div><h2>What you will need</h2><div class="checks" style="grid-template-columns:1fr">' +
      ['Birth certificate or sworn declaration of age', 'Two recent passport photographs', 'Last report card / transfer letter (for transfers)', 'Immunisation record (nursery applicants)', 'Parent or guardian\'s valid ID', 'Completed application form'].map(x => '<span>' + x + '</span>').join('') +
      '</div><h3 style="margin-top:26px">Age guide</h3><div class="table-wrap"><table><tbody><tr><td>Nursery 1</td><td>about 3 years</td></tr><tr><td>Primary 1</td><td>about 6 years</td></tr><tr><td>JSS 1</td><td>after Primary 6 / Common Entrance</td></tr><tr><td>SS 1</td><td>after BECE</td></tr></tbody></table></div></div>' +
      '<div><div class="eyebrow">School fees</div><h2>Fees per term</h2><p class="muted">' + (st().demoMode ? '<span class="sample-tag">Sample figures</span> Fees shown are placeholders — the bursary will publish approved fees. ' : '') + 'Fees can be paid by bank transfer, POS or at the bursary, using the child\'s admission number as reference.</p>' +
      '<div class="fee-tabs" id="fee-tabs">' + groups.map(g => '<button class="chip-btn" data-g="' + g[0] + '">' + g[1] + '</button>').join('') + '</div><div id="fee-box"></div>' +
      (st().bank && st().bank.accountNumber ? '<div class="notice-box" style="margin-top:16px"><b>Bank details:</b> ' + esc(st().bank.name) + ' · ' + esc(st().bank.accountName) + ' · <b>' + esc(st().bank.accountNumber) + '</b></div>' : '') +
      '</div></div></section>' +
      '<section class="section"><div class="faq">' + sectionHead('Questions', 'Admissions FAQs', '', true) + faqs.map(faqItem).join('') + '<p class="c"><a class="text-link" href="#/faq">All FAQs</a></p></div></section>';
  };
  const faqItem = f => '<details><summary>' + esc(f.q) + '</summary><p>' + esc(f.a) + '</p></details>';

  /* ----- online application ----- */
  let appDraft = null, appStep = 0;
  pages.apply = () => {
    if (!appDraft) {
      try { appDraft = JSON.parse(sessionStorage.getItem('eps.appDraft') || 'null'); } catch (e) { }
      appDraft = appDraft || {}; appStep = 0;
    }
    setTimeout(renderApplyStep);
    return pageHero('Admissions', 'Online application', 'It takes about five minutes. Your progress is kept on this device until you submit.', IMG('photo-1503454537195-1dcabb73ffb9'), 'Apply') +
      '<section class="section"><div style="max-width:820px;margin:0 auto"><div class="form-card" id="apply-card"></div></div></section>';
  };
  const APPLY_STEPS = ['Child', 'Parent / guardian', 'Background', 'Review'];
  function renderApplyStep() {
    const card = $('#apply-card'); if (!card) return;
    const d = appDraft, f = U.field;
    const classOpts = S.sortedClasses().map(c => c.name);
    const stepper = '<div class="stepper" aria-label="Progress">' + APPLY_STEPS.map((s, i) => '<span class="' + (i < appStep ? 'done' : i === appStep ? 'on' : '') + '">' + (i + 1) + '. ' + s + '</span>').join('') + '</div>';
    let body = '';
    if (appStep === 0) body = '<h3>About the child</h3><p class="muted">Enter names exactly as on the birth certificate.</p><div class="form-grid">' +
      f('firstName', 'First name', { required: true, value: d.firstName, autocomplete: 'off' }) + f('lastName', 'Surname', { required: true, value: d.lastName }) +
      f('otherName', 'Other name(s)', { value: d.otherName }) + f('gender', 'Gender', { type: 'select', required: true, options: ['Female', 'Male'], value: d.gender }) +
      f('dob', 'Date of birth', { type: 'date', required: true, value: d.dob, max: EPS.today() }) + f('classSought', 'Class applying for', { type: 'select', required: true, options: classOpts, value: d.classSought }) +
      f('stateOfOrigin', 'State of origin', { value: d.stateOfOrigin }) + f('religion', 'Religion / denomination', { value: d.religion }) + '</div>';
    if (appStep === 1) body = '<h3>Parent or guardian</h3><p class="muted">We will use these details to contact you about this application.</p><div class="form-grid">' +
      f('pName', 'Full name', { required: true, value: d.pName, autocomplete: 'name' }) + f('pRelationship', 'Relationship to child', { type: 'select', required: true, options: ['Mother', 'Father', 'Guardian', 'Other'], value: d.pRelationship }) +
      f('pPhone', 'Phone number', { type: 'tel', required: true, value: d.pPhone, placeholder: '080…', autocomplete: 'tel', hint: 'You will need this number to track your application.', inputmode: 'tel' }) + f('pEmail', 'Email address', { type: 'email', value: d.pEmail, autocomplete: 'email' }) +
      f('pOccupation', 'Occupation', { value: d.pOccupation }) + f('pAddress', 'Home address', { value: d.pAddress, autocomplete: 'street-address' }) + '</div>';
    if (appStep === 2) body = '<h3>Background</h3><div class="form-grid">' +
      f('prevSchool', 'Previous school (if any)', { value: d.prevSchool, full: true }) +
      f('lastClass', 'Last class completed', { value: d.lastClass }) + f('heard', 'How did you hear about us?', { type: 'select', options: ['Friend or family', 'Church', 'Website', 'Social media', 'Signboard / flyer', 'Other'], value: d.heard }) +
      f('medical', 'Medical needs, allergies or disabilities', { type: 'textarea', value: d.medical, full: true, rows: 3, placeholder: 'Let us know so we can support your child well.' }) +
      f('notes', 'Anything else we should know?', { type: 'textarea', value: d.notes, full: true, rows: 3 }) + '</div>';
    if (appStep === 3) {
      const row = (k, v) => '<dt>' + esc(k) + '</dt><dd>' + (v ? esc(v) : '<span class="tbc">—</span>') + '</dd>';
      body = '<h3>Review and submit</h3><p class="muted">Please check the details below.</p><div class="review"><dl>' +
        row('Child', [d.firstName, d.otherName, d.lastName].filter(Boolean).join(' ')) + row('Gender', d.gender) + row('Date of birth', d.dob ? fmtDate(d.dob) + ' (age ' + U.ageFrom(d.dob) + ')' : '') + row('Class sought', d.classSought) +
        row('Parent / guardian', d.pName + (d.pRelationship ? ' (' + d.pRelationship + ')' : '')) + row('Phone', d.pPhone) + row('Email', d.pEmail) + row('Address', d.pAddress) +
        row('Previous school', d.prevSchool) + row('Medical needs', d.medical) + '</dl></div>' +
        '<label class="check" style="margin-top:20px"><input type="checkbox" name="consent" required> I confirm the information is correct and consent to ' + esc(st().schoolName) + ' storing it to process this application.</label>';
    }
    card.innerHTML = stepper + '<form id="apply-form" novalidate>' + body + '<div class="form-actions" style="margin-top:24px;justify-content:space-between">' +
      (appStep > 0 ? '<button type="button" class="btn ghost" id="ap-back">← Back</button>' : '<span></span>') +
      '<button class="btn" type="submit">' + (appStep === 3 ? 'SUBMIT APPLICATION' : 'CONTINUE →') + '</button></div></form>';
    const form = $('#apply-form');
    const keep = () => { Object.assign(appDraft, U.formData(form)); delete appDraft.consent; try { sessionStorage.setItem('eps.appDraft', JSON.stringify(appDraft)); } catch (e) { } };
    form.addEventListener('input', keep);
    if ($('#ap-back')) $('#ap-back').onclick = () => { keep(); appStep--; renderApplyStep(); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      keep();
      if (appStep === 1 && !U.validPhone(appDraft.pPhone)) { U.toast('Please enter a valid Nigerian phone number, e.g. 08031234567.', 'warn'); form.pPhone.focus(); return; }
      if (appStep < 3) { appStep++; renderApplyStep(); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      submitApplication();
    });
  }
  async function submitApplication() {
    const d = appDraft;
    const cls = S.find('classes', c => c.name === d.classSought);
    const now = EPS.today();
    const app = {
      child: { firstName: d.firstName, lastName: d.lastName, otherName: d.otherName || '', gender: d.gender, dob: d.dob, stateOfOrigin: d.stateOfOrigin || '', religion: d.religion || '' },
      classSought: d.classSought, section: cls ? cls.section : '', prevSchool: d.prevSchool || '', lastClass: d.lastClass || '', heard: d.heard || '',
      parent: { name: d.pName, phone: d.pPhone, email: d.pEmail || '', relationship: d.pRelationship, address: d.pAddress || '', occupation: d.pOccupation || '' },
      medical: d.medical || '', notes: d.notes || ''
    };
    let ref;
    if (S.cloud) {
      const btn = $('#apply-form button[type=submit]'); if (btn) { btn.disabled = true; btn.textContent = 'SUBMITTING…'; }
      try { ref = await Cloud.rpc('submit_application', { p: app }); }
      catch (err) { U.toast(err.message || 'Could not submit. Please try again.', 'bad'); if (btn) { btn.disabled = false; btn.textContent = 'SUBMIT APPLICATION'; } return; }
    } else {
      ref = S.nextApplicationRef();
      S.insert('applications', Object.assign({ ref, status: 'Submitted', created: now, examDate: '', history: [{ at: now, status: 'Submitted', note: 'Application received online.' }] }, app));
      S.log('public', 'New admission application ' + ref + ' for ' + d.firstName + ' ' + d.lastName + ' (' + d.classSought + ').');
    }
    try { sessionStorage.removeItem('eps.appDraft'); } catch (e) { }
    const name = d.firstName + ' ' + d.lastName, phone = d.pPhone, cs = d.classSought;
    appDraft = null; appStep = 0;
    $('#apply-card').innerHTML = '<div class="success"><div class="big">🎉</div><h3>Application submitted</h3><p>Thank you. We have received the application for <b>' + esc(name) + '</b> (' + esc(cs) + ').</p><p class="muted">Your reference number is</p><div class="ref-box">' + esc(ref) + '</div>' +
      '<p class="muted">Keep this number. You can track progress with it and your phone number (' + esc(phone) + '). The school will contact you about the next steps.</p>' +
      '<div class="form-actions" style="justify-content:center"><a class="btn" href="#/track?ref=' + encodeURIComponent(ref) + '">TRACK APPLICATION</a><button class="btn ghost" id="print-ack">Print acknowledgement</button></div></div>';
    $('#print-ack').onclick = () => U.printHTML('Application ' + ref, '<div class="receipt">' + U.schoolHeader('ADMISSION APPLICATION ACKNOWLEDGEMENT') + '<div class="receipt-amount"><span>Reference</span><b>' + esc(ref) + '</b></div><div class="rc-info" style="margin-top:14px"><div><span>Child</span><b>' + esc(name) + '</b></div><div><span>Class sought</span><b>' + esc(cs) + '</b></div><div><span>Date</span><b>' + fmtDate(now) + '</b></div><div><span>Phone</span><b>' + esc(phone) + '</b></div></div><p>Please bring this acknowledgement and the required documents when you visit the school.</p></div>');
  }

  pages.track = (q) => {
    setTimeout(() => {
      const form = $('#track-form');
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const d = U.formData(form);
        const norm = p => String(p).replace(/\D/g, '').replace(/^234/, '0');
        let app;
        if (S.cloud) {
          try { app = await Cloud.rpc('track_application', { p_ref: d.ref, p_phone: d.phone }); }
          catch (err) { U.toast(err.message, 'bad'); return; }
        } else app = S.find('applications', a => a.ref.toUpperCase() === d.ref.toUpperCase() && norm(a.parent.phone) === norm(d.phone));
        const out = $('#track-out');
        if (!app) { out.innerHTML = '<div class="notice-box warn" style="margin-top:20px">No application matches that reference and phone number. Please check and try again, or contact the school office.</div>'; return; }
        const cls = { Submitted: 'info', 'Under review': 'warn', 'Exam scheduled': 'warn', Admitted: 'ok', Declined: 'bad', Waitlisted: 'warn' }[app.status] || '';
        out.innerHTML = '<div class="form-card" style="margin-top:24px"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center"><div><small class="muted">' + esc(app.ref) + '</small><h3>' + esc(app.child.firstName + ' ' + app.child.lastName) + ' · ' + esc(app.classSought) + '</h3></div><span class="badge ' + cls + '" style="font-size:13px;padding:6px 14px">' + esc(app.status) + '</span></div>' +
          (app.examDate ? '<div class="notice-box" style="margin-top:14px">📅 Assessment / entrance examination: <b>' + fmtDate(app.examDate) + '</b>. Please arrive by 8:30 am with writing materials.</div>' : '') +
          (app.status === 'Admitted' ? '<div class="notice-box ok" style="margin-top:14px">🎉 Congratulations! Your child has been offered admission. Please visit the school office to accept the offer and complete registration.</div>' : '') +
          '<ul class="timeline">' + app.history.slice().reverse().map(h => '<li><b>' + esc(h.status) + '</b><small>' + fmtDate(h.at) + '</small>' + (h.note ? esc(h.note) : '') + '</li>').join('') + '</ul></div>';
      });
      if (q.ref) { form.ref.value = q.ref; }
    });
    return pageHero('Admissions', 'Track your application', 'Enter your reference number and the phone number used on the application.', IMG('photo-1503676260728-1c00da094a0b'), 'Track application') +
      '<section class="section"><div style="max-width:720px;margin:0 auto"><form class="form-card" id="track-form"><div class="form-grid">' +
      U.field('ref', 'Reference number', { required: true, placeholder: 'APP-2026-0101' }) + U.field('phone', 'Parent phone number', { required: true, type: 'tel', placeholder: '080…', inputmode: 'tel' }) +
      '</div><div class="form-actions"><button class="btn">CHECK STATUS</button></div>' +
      (st().demoMode ? '<p class="hint">Demo: try <b>APP-2026-0102</b> with phone <b>08035550102</b>.</p>' : '') + '</form><div id="track-out"></div></div></section>';
  };

  pages.news = (q, slug) => {
    if (slug) return newsArticle(slug);
    const all = published();
    const cats = ['All', ...new Set(all.map(n => n.category))];
    setTimeout(() => {
      let cat = q.cat || 'All';
      const draw = () => {
        const term = ($('#news-q').value || '').toLowerCase();
        const list = all.filter(n => (cat === 'All' || n.category === cat) && (!term || (n.title + ' ' + n.summary + ' ' + n.body).toLowerCase().includes(term)));
        $('#news-list').innerHTML = list.length ? list.map(newsCard).join('') : '<p class="empty">No news matches your search.</p>';
        $$('#news-cats .chip-btn').forEach(b => b.classList.toggle('active', b.dataset.c === cat));
      };
      $$('#news-cats .chip-btn').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
      $('#news-q').addEventListener('input', draw);
      draw();
    });
    return pageHero('News & events', 'School news', 'Announcements, achievements and stories from our school community.', IMG('photo-1526232761682-d26e03ac148e'), 'News') +
      '<section class="section"><div class="searchbar"><label class="sr-only" for="news-q">Search news</label><input class="input" id="news-q" type="search" placeholder="Search news…"></div><div class="filters" id="news-cats">' + cats.map(c => '<button class="chip-btn" data-c="' + attr(c) + '">' + esc(c) + '</button>').join('') + '</div><div class="cards" id="news-list"></div></section>';
  };
  function newsArticle(slug) {
    const n = S.find('news', x => (x.slug || x.id) === slug && x.published !== false);
    if (!n) return pages.notfound();
    const others = published().filter(x => x.id !== n.id).slice(0, 4);
    const url = location.href;
    setTimeout(() => {
      const c = $('#copy-link');
      if (c) c.onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => U.toast('Link copied.'), () => U.toast('Copy the address from your browser bar.', 'info')); };
    });
    return '<section class="section"><div class="crumbs" style="color:var(--muted)"><a href="#/">Home</a> / <a href="#/news">News</a> / ' + esc(n.title) + '</div><div class="news-layout" style="margin-top:16px"><article class="article"><small class="eyebrow">' + esc(n.category) + '</small><h1>' + esc(n.title) + '</h1><div class="meta">' + fmtDate(n.date) + '</div>' +
      (n.image ? '<div class="article-hero" style="background-image:url(\'' + attr(n.image) + '\')" role="img" aria-label="' + attr(n.title) + '"></div>' : '') +
      '<div class="body">' + U.paragraphs(n.body) + '</div><div class="share"><a class="btn sm ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(n.title + ' — ' + url) + '">Share on WhatsApp</a><a class="btn sm ghost" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url) + '">Share on Facebook</a><button class="btn sm ghost" id="copy-link">Copy link</button></div></article>' +
      '<aside><div class="side-box"><h4>More news</h4>' + others.map(o => '<a href="#/news/' + attr(o.slug || o.id) + '">' + esc(o.title) + '<br><small class="muted">' + fmtDate(o.date, 'short') + '</small></a>').join('') + '</div><div class="side-box"><h4>Upcoming</h4>' + upcoming(3).map(e => '<a href="#/calendar">' + esc(e.title) + '<br><small class="muted">' + fmtDate(e.date, 'short') + '</small></a>').join('') + '</div></aside></div></section>';
  }

  /* ----- calendar ----- */
  let calMonth = null;
  pages.calendar = () => {
    if (!calMonth) { const n = new Date(); calMonth = new Date(n.getFullYear(), n.getMonth(), 1); }
    const cats = ['Academic', 'Holiday', 'Faith', 'Parents', 'Sports', 'Admissions'];
    setTimeout(drawCal);
    const s = st();
    return pageHero('School calendar', 'Term dates & events', 'Plan ahead with key dates for the ' + s.session + ' session. Add events straight to your phone calendar.', IMG('photo-1497633762265-9d179a990aa6'), 'Calendar') +
      '<section class="section"><div class="notice-box" style="margin-bottom:24px"><b>' + esc(S.termLabel()) + ' ' + esc(s.session) + ':</b> ' + fmtDate(s.termStart) + ' – ' + fmtDate(s.termEnd) + ' · Next term begins <b>' + fmtDate(s.nextTermBegins) + '</b></div>' +
      '<div class="cal-wrap"><div><div class="cal" id="cal"></div><div class="legend">' + cats.map(c => '<span class="badge cat-' + c + '">' + c + '</span>').join('') + '</div></div>' +
      '<div><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px"><h3 style="margin:0;font:700 22px var(--serif)">Upcoming events</h3><button class="btn sm ghost" id="ics-all">⬇ Add all to calendar</button></div><div class="event-list" id="cal-list"></div></div></div></section>';
  };
  function drawCal() {
    const cal = $('#cal'); if (!cal) return;
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1), startDow = (first.getDay() + 6) % 7;
    const start = new Date(y, m, 1 - startDow);
    const evs = S.all('events');
    const t = EPS.today();
    let cells = '';
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = EPS.isoDate(d);
      const on = evs.filter(e => iso >= e.date && iso <= (e.endDate || e.date));
      cells += '<div class="cal-day' + (d.getMonth() !== m ? ' other' : '') + (iso === t ? ' today' : '') + '"><span class="dnum">' + d.getDate() + '</span>' + on.map(e => '<button class="cal-ev cat-' + attr(e.category) + '" data-ev="' + attr(e.id) + '" title="' + attr(e.title) + '">' + esc(e.title) + '</button>').join('') + '</div>';
      if (i === 34 && d.getMonth() !== m) break;
    }
    cal.innerHTML = '<div class="cal-head"><button class="icon-btn" id="cal-prev" aria-label="Previous month">‹</button><h3>' + U.MONTHS[m] + ' ' + y + '</h3><button class="icon-btn" id="cal-next" aria-label="Next month">›</button></div><div class="cal-grid">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => '<div class="dow">' + d + '</div>').join('') + cells + '</div>';
    $('#cal-prev').onclick = () => { calMonth = new Date(y, m - 1, 1); drawCal(); };
    $('#cal-next').onclick = () => { calMonth = new Date(y, m + 1, 1); drawCal(); };
    $$('.cal-ev', cal).forEach(b => b.onclick = () => showEvent(b.dataset.ev));
    const list = upcoming();
    $('#cal-list').innerHTML = list.length ? list.map(e => eventItem(e).replace('</div><span', '</div><button class="icon-btn" data-ics="' + attr(e.id) + '" aria-label="Add ' + attr(e.title) + ' to calendar" title="Add to calendar">⬇</button><span')).join('') : '<p class="empty">No upcoming events.</p>';
    $$('[data-ics]').forEach(b => b.onclick = () => { const e = S.get('events', b.dataset.ics); U.download(e.title.replace(/\W+/g, '-') + '.ics', U.icsFor([e]), 'text/calendar'); });
    $('#ics-all').onclick = () => U.download('epiphany-schools-calendar.ics', U.icsFor(upcoming()), 'text/calendar');
  }
  function showEvent(id) {
    const e = S.get('events', id); if (!e) return;
    const m = U.modal({ title: e.title, size: 'sm', body: '<p><span class="badge cat-' + attr(e.category) + '">' + esc(e.category) + '</span></p><p><b>📅 ' + (e.endDate ? fmtDate(e.date) + ' – ' + fmtDate(e.endDate) : fmtDate(e.date)) + '</b>' + (e.time ? '<br>🕘 ' + esc(e.time) : '') + (e.location ? '<br>📍 ' + esc(e.location) : '') + '</p><p>' + esc(e.desc || '') + '</p>', foot: '<button class="btn" id="ev-ics">⬇ Add to my calendar</button>' });
    m.querySelector('#ev-ics').onclick = () => U.download(e.title.replace(/\W+/g, '-') + '.ics', U.icsFor([e]), 'text/calendar');
  }

  /* ----- gallery ----- */
  pages.gallery = () => {
    const items = S.all('gallery');
    const albums = ['All', ...new Set(items.map(g => g.album))];
    setTimeout(() => {
      let album = 'All', shown = items;
      const draw = () => {
        shown = items.filter(g => album === 'All' || g.album === album);
        $('#gal').innerHTML = shown.map((g, i) => '<button data-i="' + i + '" style="background-image:url(\'' + attr(g.image.replace('w=1200', 'w=600')) + '\')" aria-label="View photo: ' + attr(g.title) + '"><span>' + esc(g.title) + '</span></button>').join('');
        $$('#gal button').forEach(b => b.onclick = () => lightbox(shown, +b.dataset.i));
        $$('#gal-albums .chip-btn').forEach(b => b.classList.toggle('active', b.dataset.a === album));
      };
      $$('#gal-albums .chip-btn').forEach(b => b.onclick = () => { album = b.dataset.a; draw(); });
      draw();
    });
    return pageHero('Gallery', 'Life at ' + st().shortName, 'Moments from classrooms, celebrations, sports and faith life.', IMG('photo-1513364776144-60967b0f800f'), 'Gallery') +
      '<section class="section"><div class="filters" id="gal-albums">' + albums.map(a => '<button class="chip-btn" data-a="' + attr(a) + '">' + esc(a) + '</button>').join('') + '</div><div class="gallery" id="gal"></div>' +
      (st().demoMode ? '<p class="hint c" style="margin-top:16px">Stock photographs shown for demonstration — replace with approved photos of the school from the portal.</p>' : '') + '</section>';
  };
  function lightbox(items, i) {
    const el = document.createElement('div');
    el.className = 'lightbox'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.tabIndex = -1;
    const draw = () => { el.innerHTML = '<button class="lb-close" aria-label="Close">✕</button><button class="lb-btn lb-prev" aria-label="Previous">‹</button><figure style="margin:0"><img src="' + attr(items[i].image) + '" alt="' + attr(items[i].title) + '"><p>' + esc(items[i].title) + ' · ' + (i + 1) + ' / ' + items.length + '</p></figure><button class="lb-btn lb-next" aria-label="Next">›</button>'; };
    const close = () => { el.remove(); document.removeEventListener('keydown', key); };
    const go = n => { i = (i + n + items.length) % items.length; draw(); };
    const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    el.addEventListener('click', e => { if (e.target.closest('.lb-close') || e.target === el) close(); else if (e.target.closest('.lb-prev')) go(-1); else if (e.target.closest('.lb-next')) go(1); });
    document.addEventListener('keydown', key);
    draw(); document.body.appendChild(el); el.focus();
  }

  /* ----- result checker ----- */
  pages.results = () => {
    const s = st();
    const demoPin = s.demoMode ? S.find('pins', p => p.studentId && p.uses < p.maxUses) : null;
    const demoStudent = demoPin ? S.get('students', demoPin.studentId) : null;
    setTimeout(() => {
      $('#res-form').addEventListener('submit', e => {
        e.preventDefault();
        const d = U.formData(e.target);
        const out = $('#res-out');
        if (S.cloud) { checkResultOnline(d, out); return; }
        const stu = S.find('students', x => x.admNo.toUpperCase() === d.admNo.toUpperCase());
        const pin = S.find('pins', p => p.pin === d.pin.replace(/\s/g, ''));
        if (!stu || !pin) { out.innerHTML = '<div class="notice-box warn" style="margin-top:20px">Invalid admission number or PIN. Please check and try again.</div>'; return; }
        if (pin.studentId && pin.studentId !== stu.id) { out.innerHTML = '<div class="notice-box warn" style="margin-top:20px">This PIN has already been used for another student.</div>'; return; }
        if (pin.uses >= pin.maxUses) { out.innerHTML = '<div class="notice-box warn" style="margin-top:20px">This PIN has reached its maximum of ' + pin.maxUses + ' uses. Please obtain a new PIN from the school.</div>'; return; }
        if (s.blockResultsIfOwing && S.feeStatus(stu.id).balance > 0) { out.innerHTML = '<div class="notice-box warn" style="margin-top:20px">This result is temporarily unavailable. Please contact the bursary.</div>'; return; }
        S.update('pins', pin.id, { studentId: stu.id, uses: pin.uses + 1, lastUsed: new Date().toISOString() });
        out.innerHTML = '<div class="no-print" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:26px 0 12px"><span class="muted">PIN used ' + (pin.uses) + ' of ' + pin.maxUses + ' times.</span><button class="btn" id="res-print">🖨 Print / save as PDF</button></div>' + U.reportCard(stu.id);
        $('#res-print').onclick = () => U.printHTML('Report card — ' + S.studentName(stu), U.reportCard(stu.id));
        out.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return pageHero('Results', 'Result checker', 'View and print a term report card using the admission number and a result PIN issued by the school.', IMG('photo-1532094349884-543bc11b234d'), 'Result checker') +
      '<section class="section"><div class="result-wrap"><form class="form-card" id="res-form" style="max-width:760px;margin:0 auto"><div class="form-grid">' +
      U.field('admNo', 'Admission number', { required: true, placeholder: 'EPS/2024/0001' }) + U.field('pin', 'Result PIN', { required: true, placeholder: '12-digit PIN', inputmode: 'numeric' }) +
      U.field('session', 'Session', { type: 'select', options: [s.session], value: s.session, placeholder: false }) + U.field('term', 'Term', { type: 'select', options: [{ value: s.term, label: S.termLabel() }], value: s.term, placeholder: false }) +
      '</div><div class="form-actions"><button class="btn">CHECK RESULT</button><a class="text-link" href="portal.html">Parents: log in to the portal instead</a></div>' +
      (demoStudent ? '<p class="hint">Demo: admission no. <b>' + esc(demoStudent.admNo) + '</b>, PIN <b>' + esc(demoPin.pin) + '</b></p>' : '') + '</form><div id="res-out"></div></div></section>';
  };

  /** Result checker against the school database: the server validates the PIN and returns one report. */
  async function checkResultOnline(d, out) {
    const warn = t => { out.innerHTML = '<div class="notice-box warn" style="margin-top:20px">' + t + '</div>'; };
    let r;
    try { r = await Cloud.rpc('check_result', { p_adm: d.admNo, p_pin: d.pin }); }
    catch (err) { warn(esc(err.message)); return; }
    if (!r || !r.ok) {
      const msg = { invalid: 'Invalid admission number or PIN. Please check and try again.', used_other: 'This PIN has already been used for another student.', exhausted: 'This PIN has reached its maximum of ' + (r && r.maxUses) + ' uses. Please obtain a new PIN from the school.', withheld: 'This result is temporarily unavailable. Please contact the bursary.' }[r && r.error];
      warn(msg || 'The result could not be loaded.'); return;
    }
    // Load only this report into the page's (read-only) data.
    const st = S.settings;
    const put = (col, item) => { if (!item) return; const list = S.all(col); const i = list.findIndex(x => x.id === item.id); if (i >= 0) list[i] = item; else list.push(item); };
    put('students', r.student);
    r.scores.forEach(x => put('scores', x));
    put('reports', r.report);
    r.attendance.forEach(x => put('attendance', x));
    put('users', r.teacher);
    S.resultContext[[r.student.id, st.session, Number(st.term)].join('|')] = r.context;
    const name = S.studentName(r.student);
    out.innerHTML = '<div class="no-print" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:26px 0 12px"><span class="muted">PIN used ' + r.uses + ' of ' + r.maxUses + ' times.</span><button class="btn" id="res-print">🖨 Print / save as PDF</button></div>' + U.reportCard(r.student.id);
    $('#res-print').onclick = () => U.printHTML('Report card — ' + name, U.reportCard(r.student.id));
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  pages.faq = () => pageHero('Help', 'Frequently asked questions', 'Answers to common questions from parents and guardians.', IMG('photo-1588072432836-e10032774350'), 'FAQs') +
    '<section class="section"><div class="faq">' + S.all('faqs').slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(faqItem).join('') + '<p class="c muted" style="margin-top:24px">Still have a question? <a class="text-link" href="#/contact">Contact the school</a></p></div></section>';

  pages.contact = () => {
    const s = st();
    setTimeout(() => {
      $('#enquiry').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const d = U.formData(form);
        if (!U.validPhone(d.phone)) { U.toast('Please enter a valid Nigerian phone number, e.g. 08031234567.', 'warn'); form.phone.focus(); return; }
        if (S.cloud) {
          try { await Cloud.rpc('submit_enquiry', { p: { name: d.name, phone: d.phone, email: d.email, level: d.level, message: d.message } }); }
          catch (err) { U.toast(err.message || 'Could not send. Please try again.', 'bad'); return; }
        } else {
          S.insert('enquiries', { name: d.name, phone: d.phone, email: d.email, level: d.level, message: d.message, created: new Date().toISOString(), status: 'New' });
          S.log('public', 'New enquiry from ' + d.name + '.');
        }
        form.reset();
        $('#enq-ok').innerHTML = '<div class="notice-box ok" style="margin-top:14px">Thank you, ' + esc(d.name.split(' ')[0]) + '. Your enquiry has been received and the school office will get back to you.</div>';
      });
    });
    const mapSrc = 'https://www.google.com/maps?q=' + encodeURIComponent(s.mapQuery || s.address) + '&output=embed';
    return pageHero('Contact', 'We would love to hear from you', 'Visit, call or send us an enquiry about admissions or school services.', IMG('photo-1509062522246-3755977927d7'), 'Contact') +
      '<section class="section"><div class="contact-grid"><div class="contact-card"><h3>Visit our school community</h3><p>📍 ' + esc(s.address) + '</p><p>🏫 ' + esc(s.tagline) + '</p>' +
      '<p>📞 ' + (s.phone ? '<a href="tel:' + attr(s.phone) + '">' + esc(s.phone) + '</a>' : placeholder('', 'Phone number to be supplied by management')) + '</p>' +
      '<p>✉ ' + (s.email ? '<a href="mailto:' + attr(s.email) + '">' + esc(s.email) + '</a>' : placeholder('', 'Email to be supplied by management')) + '</p>' +
      '<p>🕘 ' + (s.officeHours ? esc(s.officeHours) : placeholder('', 'Office hours to be confirmed')) + '</p>' +
      (s.whatsapp ? '<p><a class="btn" style="background:#25d366;color:#fff" target="_blank" rel="noopener" href="https://wa.me/' + attr(String(s.whatsapp).replace(/\D/g, '').replace(/^0/, '234')) + '">💬 Chat on WhatsApp</a></p>' : '') + '</div>' +
      '<form class="form-card" id="enquiry"><h3>Send an enquiry</h3><p class="muted">We usually respond within two working days.</p><div class="form-grid">' +
      U.field('name', 'Parent / guardian name', { required: true, autocomplete: 'name' }) + U.field('phone', 'Phone number', { required: true, type: 'tel', placeholder: '080…', autocomplete: 'tel', inputmode: 'tel' }) +
      U.field('email', 'Email address', { type: 'email', autocomplete: 'email' }) + U.field('level', 'Level of interest', { type: 'select', required: true, options: ['Nursery', 'Primary', 'Secondary', 'General enquiry'] }) +
      U.field('message', 'Your enquiry', { type: 'textarea', required: true, full: true, placeholder: 'Tell us how we can help…' }) +
      '</div><div class="form-actions"><button class="btn">SEND ENQUIRY</button></div><div id="enq-ok" aria-live="polite"></div></form></div>' +
      '<iframe class="map" title="Map showing ' + attr(s.address) + '" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' + attr(mapSrc) + '"></iframe></section>';
  };

  pages.notfound = () => '<section class="section" style="text-align:center;min-height:50vh"><div class="eyebrow">Page not found</div><h2>We couldn\'t find that page.</h2><p class="muted">It may have moved. Try the links below.</p><div class="form-actions" style="justify-content:center"><a class="btn" href="#/">Home</a><a class="btn ghost" href="#/contact">Contact us</a></div></section>';

  /* ---------- router ---------- */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [pathPart, queryPart] = h.split('?');
    const [path, anchor] = pathPart.split('#');
    const parts = path.split('/').filter(Boolean);
    const q = {};
    new URLSearchParams(queryPart || '').forEach((v, k) => { q[k] = v; });
    return { page: parts[0] || 'home', arg: parts[1] ? decodeURIComponent(parts[1]) : null, q, anchor };
  }
  let lastPage = null;
  function route() {
    if (!S.data || !S.data.settings) return;
    // legacy anchors from the original one-page site (#about, #contact…)
    const legacy = { '#home': '#/', '#about': '#/about', '#levels': '#/academics', '#learning': '#/academics', '#life': '#/about', '#news': '#/news', '#admissions': '#/admissions', '#contact': '#/contact' };
    if (legacy[location.hash]) { location.replace(legacy[location.hash]); return; }
    const { page, arg, q, anchor } = parseHash();
    const fn = pages[page] || pages.notfound;
    if (page !== 'apply' && lastPage === 'apply') { /* keep draft in sessionStorage */ appDraft = null; }
    main.innerHTML = fn(q, arg);
    $$('#navlinks a').forEach(a => { const href = a.getAttribute('href'); a.classList.toggle('active', href === '#/' + (page === 'home' ? '' : page)); if (a.classList.contains('active')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#navlinks').classList.remove('show'); $('#menu').setAttribute('aria-expanded', 'false');
    if (anchor) setTimeout(() => { const el = document.getElementById(anchor); if (el) el.scrollIntoView(); }, 30);
    else if (lastPage !== null) window.scrollTo(0, 0);
    if (lastPage !== null) main.focus({ preventScroll: true });
    lastPage = page;
    observeReveal();
  }
  function observeReveal() {
    const els = $$('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: .12 });
    els.forEach(e => io.observe(e));
  }

  /* ---------- boot ---------- */
  $('#menu').addEventListener('click', () => { const open = $('#navlinks').classList.toggle('show'); $('#menu').setAttribute('aria-expanded', String(open)); });
  $('#theme-btn').addEventListener('click', U.toggleTheme);
  const toTop = $('#to-top');
  window.addEventListener('scroll', () => toTop.classList.toggle('show', window.scrollY > 600), { passive: true });
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('hashchange', () => { U.closeModal(); document.querySelectorAll('.lightbox').forEach(l => l.remove()); route(); });
  window.addEventListener('storage', e => { if (!S.cloud && e.key === 'epiphany.db.v1') { S.load(); renderChrome(); route(); } });
  main.innerHTML = '<section class="section c"><p class="muted">Loading…</p></section>';
  Cloud.boot('site').then(state => {
    if (state.error || state.needsSetup || state.needsData) {
      main.innerHTML = '<section class="section c" style="min-height:50vh"><div class="eyebrow">Epiphany Schools</div><h2>' +
        (state.error ? 'We could not load the website just now.' : 'Our new website is coming soon.') + '</h2><p class="muted">' +
        esc(state.error || 'The school is setting up its website and portal.') + '</p><div class="form-actions" style="justify-content:center">' +
        (state.error ? '<button class="btn" onclick="location.reload()">Try again</button>' : '<a class="btn" href="portal.html">Staff: open the portal</a>') + '</div></section>';
      return;
    }
    renderChrome();
    route();
  });
})();
