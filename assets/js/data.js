/* =====================================================================
   Epiphany Schools — data layer
   ---------------------------------------------------------------------
   All school data lives in one JSON document. By default it is kept in
   the browser's localStorage so the whole platform runs with no server.
   To go live, replace the `adapter` below with one that talks to a real
   backend (Supabase, Firebase, a REST API...). Every screen only uses
   the Store API (all / get / insert / update / remove / settings), so
   nothing else has to change.
   ===================================================================== */
(function (global) {
  'use strict';

  const DB_KEY = 'epiphany.db.v1';
  const DB_VERSION = 1;

  /* ---------- storage adapter (swap for a backend later) ---------- */
  const memory = {};
  const adapter = {
    read() {
      try { return localStorage.getItem(DB_KEY); } catch (e) { return memory[DB_KEY] || null; }
    },
    write(str) {
      try { localStorage.setItem(DB_KEY, str); } catch (e) { memory[DB_KEY] = str; }
    },
    clear() {
      try { localStorage.removeItem(DB_KEY); } catch (e) { delete memory[DB_KEY]; }
    }
  };

  /* ---------- small utilities ---------- */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let idCounter = 0;
  function uid(prefix) {
    idCounter = (idCounter + 1) % 1e6;
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + idCounter.toString(36);
  }
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const isoDate = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => isoDate(new Date());

  /* ---------- school structure ---------- */
  const TERMS = ['First Term', 'Second Term', 'Third Term'];

  const SECTIONS = {
    nursery: { label: 'Nursery School', short: 'Nursery' },
    primary: { label: 'Primary School', short: 'Primary' },
    secondary: { label: 'Secondary School', short: 'Secondary' }
  };

  // Subject groups (Nigerian national curriculum style)
  const SUBJECTS = {
    nursery: ['Numeracy', 'Literacy (English)', 'Phonics', 'Rhymes & Songs', 'Creative Arts', 'Health Habits', 'Christian Religious Knowledge', 'Igbo Language'],
    primary: ['English Studies', 'Mathematics', 'Basic Science & Technology', 'Social & Citizenship Studies', 'Christian Religious Studies', 'Igbo Language', 'Cultural & Creative Arts', 'Physical & Health Education', 'Pre-vocational Studies', 'Verbal Reasoning', 'Quantitative Reasoning'],
    junior: ['English Studies', 'Mathematics', 'Basic Science', 'Basic Technology', 'Social & Citizenship Studies', 'Christian Religious Studies', 'Igbo Language', 'Business Studies', 'Cultural & Creative Arts', 'Computer Studies', 'French', 'Agricultural Science'],
    senior: ['English Language', 'Mathematics', 'Biology', 'Chemistry', 'Physics', 'Economics', 'Government', 'Literature in English', 'Civic Education', 'Agricultural Science', 'Data Processing', 'Christian Religious Studies']
  };

  const CLASS_DEFS = [
    ['Nursery 1', 'nursery', 'nursery'], ['Nursery 2', 'nursery', 'nursery'], ['Nursery 3', 'nursery', 'nursery'],
    ['Primary 1', 'primary', 'primary'], ['Primary 2', 'primary', 'primary'], ['Primary 3', 'primary', 'primary'],
    ['Primary 4', 'primary', 'primary'], ['Primary 5', 'primary', 'primary'], ['Primary 6', 'primary', 'primary'],
    ['JSS 1', 'secondary', 'junior'], ['JSS 2', 'secondary', 'junior'], ['JSS 3', 'secondary', 'junior'],
    ['SS 1', 'secondary', 'senior'], ['SS 2', 'secondary', 'senior'], ['SS 3', 'secondary', 'senior']
  ];

  /* ---------- grading ---------- */
  // Secondary: WAEC 9-point scale. Nursery/Primary: A–F.
  const GRADE_SCALES = {
    secondary: [
      [75, 'A1', 'Excellent'], [70, 'B2', 'Very good'], [65, 'B3', 'Good'], [60, 'C4', 'Credit'],
      [55, 'C5', 'Credit'], [50, 'C6', 'Credit'], [45, 'D7', 'Pass'], [40, 'E8', 'Pass'], [0, 'F9', 'Fail']
    ],
    basic: [
      [70, 'A', 'Excellent'], [60, 'B', 'Very good'], [50, 'C', 'Good'], [45, 'D', 'Fair'], [40, 'E', 'Pass'], [0, 'F', 'Needs support']
    ]
  };
  function gradeFor(score, section) {
    const scale = section === 'secondary' ? GRADE_SCALES.secondary : GRADE_SCALES.basic;
    if (score == null || isNaN(score)) return { grade: '–', remark: '' };
    for (const [min, grade, remark] of scale) if (score >= min) return { grade, remark };
    return { grade: '–', remark: '' };
  }
  const ASSESSMENT = { ca1: 20, ca2: 20, exam: 60 };

  const AFFECTIVE_TRAITS = ['Punctuality', 'Neatness', 'Politeness', 'Attentiveness', 'Relationship with others', 'Leadership'];
  const PSYCHOMOTOR_SKILLS = ['Handwriting', 'Sports & games', 'Creative arts', 'Verbal fluency'];

  function autoRemark(avg) {
    if (avg >= 75) return 'An outstanding result. Keep up this excellent standard.';
    if (avg >= 65) return 'A very good performance. Well done — aim even higher.';
    if (avg >= 55) return 'A good result. With more consistency you can do better.';
    if (avg >= 45) return 'A fair performance. More effort and focus are needed.';
    return 'Needs much more support and effort. Let us work together on this.';
  }

  /* ---------- seed data ---------- */
  function buildSeed() {
    const r = rng(20262027);
    const pick = arr => arr[Math.floor(r() * arr.length)];
    const between = (a, b) => Math.round(a + r() * (b - a));

    const settings = {
      schoolName: 'Epiphany Schools',
      shortName: 'Epiphany',
      tagline: 'Nursery · Primary · Secondary',
      motto: 'Faith • Knowledge • Character • Excellence',
      address: 'Awo-Idemili, Orsu Local Government Area, Imo State, Nigeria',
      town: 'Awo-Idemili',
      state: 'Imo State',
      phone: '',
      whatsapp: '',
      email: '',
      officeHours: '',
      founded: '',
      proprietor: 'Catholic Diocese of Orlu',
      principal: '',
      headteacher: '',
      session: '2026/2027',
      term: 1,
      termStart: '2026-09-14',
      termEnd: '2026-12-18',
      nextTermBegins: '2027-01-11',
      schoolDaysInTerm: 64,
      admissionPrefix: 'EPS',
      currency: '₦',
      announcement: { active: true, text: 'Admissions for the 2026/2027 session are open for Nursery, Primary and Secondary. First Term examinations begin 7 December.', link: '#/admissions' },
      bank: { name: '', accountName: '', accountNumber: '' },
      social: { facebook: '', instagram: '', youtube: '' },
      mapQuery: 'Awo-Idemili, Orsu, Imo State, Nigeria',
      pinMaxUses: 5,
      demoMode: true,
      blockResultsIfOwing: false,
      portalNotice: ''
    };

    // Staff
    const staffDefs = [
      ['Ngozi', 'Eze', 'Mrs.', 'Class Teacher · Primary 4', 'teacher'],
      ['Chukwuemeka', 'Okeke', 'Mr.', 'Mathematics · Secondary', 'teacher'],
      ['Adaeze', 'Nwosu', 'Miss', 'Class Teacher · Nursery 2', 'teacher'],
      ['Ifeanyi', 'Obi', 'Mr.', 'Sciences · Secondary', 'teacher'],
      ['Chioma', 'Anyanwu', 'Mrs.', 'English · Primary', 'teacher'],
      ['Kelechi', 'Duru', 'Mr.', 'ICT & Computer Studies', 'teacher'],
      ['Blessing', 'Opara', 'Mrs.', 'Bursar', 'bursar']
    ];
    const users = [
      { id: 'u_admin', role: 'admin', title: '', firstName: 'Admin', lastName: 'Office', username: 'admin', password: 'admin123', email: '', phone: '', position: 'Principal / Administrator', active: true }
    ];
    staffDefs.forEach((s, i) => {
      users.push({
        id: 'u_staff' + i, role: s[4] === 'bursar' ? 'admin' : 'teacher', title: s[2], firstName: s[0], lastName: s[1],
        username: i === 0 ? 'teacher' : (s[0] + '.' + s[1]).toLowerCase(), password: i === 0 ? 'teacher123' : 'changeme',
        email: '', phone: '', position: s[3], classIds: [], active: true
      });
    });

    // Classes
    const classes = CLASS_DEFS.map((c, i) => ({
      id: 'c' + pad(i + 1), name: c[0], section: c[1], group: c[2], arm: 'A', teacherId: null, order: i, capacity: 30
    }));
    const byName = n => classes.find(c => c.name === n);
    byName('Primary 4').teacherId = 'u_staff0';
    byName('JSS 2').teacherId = 'u_staff1';
    byName('Nursery 2').teacherId = 'u_staff2';
    byName('SS 2').teacherId = 'u_staff3';
    byName('Primary 2').teacherId = 'u_staff4';
    byName('JSS 1').teacherId = 'u_staff5';
    const staff = id => users.find(u => u.id === id);
    staff('u_staff0').classIds = [byName('Primary 4').id, byName('JSS 2').id];
    staff('u_staff1').classIds = [byName('JSS 2').id, byName('JSS 3').id, byName('SS 1').id];
    staff('u_staff2').classIds = [byName('Nursery 2').id, byName('Nursery 1').id];
    staff('u_staff3').classIds = [byName('SS 2').id, byName('SS 3').id];
    staff('u_staff4').classIds = [byName('Primary 2').id, byName('Primary 3').id];
    staff('u_staff5').classIds = [byName('JSS 1').id];

    // Students
    const girls = ['Adaeze', 'Chiamaka', 'Ngozi', 'Nneka', 'Ogechi', 'Amarachi', 'Chidinma', 'Ebube', 'Chisom', 'Ifunanya', 'Onyinye', 'Oluchi', 'Adanna', 'Ozioma', 'Munachi', 'Grace', 'Mary', 'Faith', 'Blessing', 'Precious'];
    const boys = ['Chinedu', 'Obinna', 'Ifeanyi', 'Emeka', 'Kelechi', 'Chukwuemeka', 'Tochukwu', 'Ikenna', 'Somtochukwu', 'Nnamdi', 'Ugochukwu', 'Chibuike', 'Kenechukwu', 'Uchenna', 'Kosisochukwu', 'John', 'Peter', 'Joseph', 'Michael', 'Paul'];
    const surnames = ['Okafor', 'Nwachukwu', 'Ibe', 'Onyeka', 'Uzoma', 'Okonkwo', 'Nwankwo', 'Ezeh', 'Chukwu', 'Agu', 'Ekwueme', 'Iwu', 'Onwuka', 'Mbah', 'Nnadi', 'Ugwu', 'Amadi', 'Echezona', 'Igwe', 'Ndukwe'];

    const students = [];
    let admSeq = 1;
    const ability = {};
    classes.forEach((c, ci) => {
      const count = 6;
      const age = 3 + ci; // rough age for class
      for (let k = 0; k < count; k++) {
        const gender = r() < 0.5 ? 'Female' : 'Male';
        const first = gender === 'Female' ? pick(girls) : pick(boys);
        const other = gender === 'Female' ? pick(girls) : pick(boys);
        const last = pick(surnames);
        const admYear = Math.max(2018, 2026 - Math.floor(ci / 2));
        const dobYear = 2026 - age - 1;
        const id = 's' + pad(admSeq, 4);
        students.push({
          id, admNo: settings.admissionPrefix + '/' + admYear + '/' + pad(admSeq, 4),
          firstName: first, otherName: other === first ? '' : other, lastName: last, gender,
          dob: dobYear + '-' + pad(between(1, 12)) + '-' + pad(between(1, 28)),
          classId: c.id, status: 'Active', admittedOn: admYear + '-09-1' + between(0, 8),
          guardianName: (gender === 'Female' ? 'Mr. ' : 'Mrs. ') + pick(boys.slice(0, 15)) + ' ' + last,
          guardianPhone: '080' + between(10000000, 99999999), guardianEmail: '',
          address: settings.town + ', ' + settings.state, stateOfOrigin: 'Imo', religion: 'Christianity',
          bloodGroup: pick(['O+', 'O+', 'A+', 'B+', 'AB+', 'O-']), genotype: pick(['AA', 'AA', 'AS', 'AA']),
          medical: '', parentIds: [], house: pick(['St. Peter', 'St. Paul', 'St. Mary', 'St. Joseph'])
        });
        ability[id] = 40 + r() * 48;
        admSeq++;
      }
    });

    // Demo family: the Okafor children in Primary 4 and JSS 2
    const p4 = students.filter(s => s.classId === byName('Primary 4').id);
    const j2 = students.filter(s => s.classId === byName('JSS 2').id);
    Object.assign(p4[0], { firstName: 'Chidera', otherName: 'Mary', lastName: 'Okafor', gender: 'Female', guardianName: 'Mr. Emeka Okafor' });
    Object.assign(j2[0], { firstName: 'Chinedu', otherName: 'Joseph', lastName: 'Okafor', gender: 'Male', guardianName: 'Mr. Emeka Okafor' });
    ability[p4[0].id] = 78; ability[j2[0].id] = 68;
    users.push({ id: 'u_parent1', role: 'parent', title: 'Mr.', firstName: 'Emeka', lastName: 'Okafor', username: 'parent', password: 'parent123', email: '', phone: '08031234567', childIds: [p4[0].id, j2[0].id], active: true });
    p4[0].parentIds = ['u_parent1']; j2[0].parentIds = ['u_parent1'];
    p4[0].guardianPhone = j2[0].guardianPhone = '08031234567';
    users.push({ id: 'u_student1', role: 'student', title: '', firstName: 'Chinedu', lastName: 'Okafor', username: 'student', password: 'student123', studentId: j2[0].id, active: true });

    // Scores for the current term
    const scores = [];
    students.forEach(s => {
      const c = classes.find(x => x.id === s.classId);
      SUBJECTS[c.group].forEach(sub => {
        const base = Math.max(15, Math.min(98, ability[s.id] + (r() - 0.5) * 26));
        const ca1 = Math.round(Math.min(20, Math.max(4, base / 100 * 20 + (r() - 0.5) * 4)));
        const ca2 = Math.round(Math.min(20, Math.max(4, base / 100 * 20 + (r() - 0.5) * 4)));
        const exam = Math.round(Math.min(60, Math.max(10, base / 100 * 60 + (r() - 0.5) * 10)));
        scores.push({ id: [s.id, settings.session, settings.term, sub].join('|'), studentId: s.id, subject: sub, session: settings.session, term: settings.term, ca1, ca2, exam });
      });
    });

    // Report-card remarks and conduct ratings
    const reports = students.map(s => {
      const affective = {}; AFFECTIVE_TRAITS.forEach(t => { affective[t] = between(3, 5); });
      const psychomotor = {}; PSYCHOMOTOR_SKILLS.forEach(t => { psychomotor[t] = between(3, 5); });
      return { id: [s.id, settings.session, settings.term].join('|'), studentId: s.id, session: settings.session, term: settings.term, teacherRemark: '', principalRemark: '', affective, psychomotor };
    });

    // Attendance: last 20 school days up to today
    const attendance = [];
    const days = [];
    const d = new Date();
    while (days.length < 20) {
      if (d.getDay() !== 0 && d.getDay() !== 6) days.unshift(isoDate(d));
      d.setDate(d.getDate() - 1);
    }
    classes.forEach(c => {
      const cs = students.filter(s => s.classId === c.id);
      days.forEach(day => {
        const records = {};
        cs.forEach(s => { const x = r(); records[s.id] = x < 0.06 ? 'A' : x < 0.11 ? 'L' : 'P'; });
        attendance.push({ id: c.id + '|' + day, classId: c.id, date: day, records, takenBy: c.teacherId || 'u_admin' });
      });
    });

    // Fee schedule (SAMPLE amounts — management must confirm)
    const feeSchedule = [
      { id: 'f_nursery', group: 'nursery', items: [['Tuition', 45000], ['Books & learning materials', 12000], ['Development levy', 5000], ['PTA levy', 2000], ['Sports & extra-curricular', 3000]] },
      { id: 'f_primary', group: 'primary', items: [['Tuition', 55000], ['Books & learning materials', 15000], ['Development levy', 5000], ['PTA levy', 2000], ['Sports & extra-curricular', 3000], ['ICT', 4000]] },
      { id: 'f_junior', group: 'junior', items: [['Tuition', 75000], ['Books & learning materials', 18000], ['Development levy', 7500], ['PTA levy', 2000], ['Laboratory & ICT', 6000], ['Sports & extra-curricular', 3500]] },
      { id: 'f_senior', group: 'senior', items: [['Tuition', 90000], ['Books & learning materials', 20000], ['Development levy', 7500], ['PTA levy', 2000], ['Laboratory & ICT', 8000], ['Sports & extra-curricular', 3500]] }
    ].map(f => ({ id: f.id, group: f.group, items: f.items.map(([name, amount]) => ({ name, amount })) }));
    const feeTotal = g => feeSchedule.find(f => f.group === g).items.reduce((a, b) => a + b.amount, 0);

    const payments = [];
    let receiptNo = 1001;
    students.forEach(s => {
      const c = classes.find(x => x.id === s.classId);
      const total = feeTotal(c.group);
      const x = r();
      const parts = x < 0.55 ? [total] : x < 0.85 ? [Math.round(total * (0.4 + r() * 0.3) / 500) * 500] : [];
      parts.forEach(amount => {
        payments.push({ id: uid('pay'), receipt: 'RCT-' + receiptNo++, studentId: s.id, session: settings.session, term: settings.term, amount, method: pick(['Bank transfer', 'Bank transfer', 'POS', 'Cash']), date: '2026-09-' + pad(between(8, 30)), note: '', receivedBy: 'u_staff6' });
      });
    });
    // Okafor family: one paid, one part-paid
    payments.filter(p => p.studentId === p4[0].id || p.studentId === j2[0].id).forEach(p => { p._del = true; });
    const pay = (sid, amount, date) => payments.push({ id: uid('pay'), receipt: 'RCT-' + receiptNo++, studentId: sid, session: settings.session, term: settings.term, amount, method: 'Bank transfer', date, note: '', receivedBy: 'u_staff6' });
    pay(p4[0].id, feeTotal('primary'), '2026-09-10');
    pay(j2[0].id, 60000, '2026-09-11');

    // Timetables
    const periods = [
      { label: '1', time: '08:00 – 08:40' }, { label: '2', time: '08:40 – 09:20' }, { label: '3', time: '09:20 – 10:00' },
      { label: 'Short break', time: '10:00 – 10:20', isBreak: true },
      { label: '4', time: '10:20 – 11:00' }, { label: '5', time: '11:00 – 11:40' }, { label: '6', time: '11:40 – 12:20' },
      { label: 'Long break', time: '12:20 – 13:00', isBreak: true },
      { label: '7', time: '13:00 – 13:40' }, { label: '8', time: '13:40 – 14:20' }
    ];
    const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timetables = classes.map(c => {
      const subs = SUBJECTS[c.group];
      const grid = {};
      DAYS.forEach((day, di) => {
        grid[day] = periods.map((p, pi) => {
          if (p.isBreak) return '';
          if (day === 'Friday' && pi >= 8) return pi === 8 ? 'Clubs & Societies' : 'Mass / Assembly';
          return subs[(di * 3 + pi * 2 + c.order) % subs.length];
        });
      });
      return { id: c.id, classId: c.id, grid };
    });

    // Homework
    const addDays = n => { const x = new Date(); x.setDate(x.getDate() + n); return isoDate(x); };
    const homework = [
      { id: uid('hw'), classId: byName('Primary 4').id, subject: 'Mathematics', title: 'Fractions practice', details: 'Complete exercises 4a and 4b on page 62 of the Mathematics textbook. Show all working.', due: addDays(2), teacherId: 'u_staff0', created: addDays(-1), doneBy: [] },
      { id: uid('hw'), classId: byName('Primary 4').id, subject: 'English Studies', title: 'Composition: My best friend', details: 'Write a composition of not less than 150 words titled "My Best Friend". Use correct punctuation.', due: addDays(5), teacherId: 'u_staff0', created: addDays(-2), doneBy: [] },
      { id: uid('hw'), classId: byName('Primary 4').id, subject: 'Basic Science & Technology', title: 'Living and non-living things', details: 'List ten living things and ten non-living things found around your home.', due: addDays(-1), teacherId: 'u_staff0', created: addDays(-6), doneBy: [p4[0].id] },
      { id: uid('hw'), classId: byName('JSS 2').id, subject: 'Mathematics', title: 'Simple equations', details: 'Solve questions 1–15 in Exercise 7.2 (New General Mathematics, JSS 2).', due: addDays(1), teacherId: 'u_staff1', created: addDays(-2), doneBy: [] },
      { id: uid('hw'), classId: byName('JSS 2').id, subject: 'Basic Science', title: 'Project: Water filter', details: 'In groups of four, build a simple sand-and-charcoal water filter. Bring it to class with a short report.', due: addDays(8), teacherId: 'u_staff0', created: addDays(-3), doneBy: [] },
      { id: uid('hw'), classId: byName('JSS 2').id, subject: 'Computer Studies', title: 'Parts of a computer', details: 'Draw and label the parts of a computer system. Explain the function of each input device.', due: addDays(-2), teacherId: 'u_staff5', created: addDays(-8), doneBy: [j2[0].id] }
    ];

    // Website content
    const IMG = id => 'https://images.unsplash.com/' + id + '?auto=format&fit=crop&w=1200&q=80';
    const news = [
      { id: 'n1', slug: 'welcome-new-session', title: 'Welcome to the 2026/2027 academic session', category: 'Announcement', date: '2026-09-14', image: IMG('photo-1509062522246-3755977927d7'), summary: 'We warmly welcome returning and new pupils, students and families to a new session of learning and growth.', body: 'We warmly welcome all returning and new pupils, students and families to the 2026/2027 academic session.\n\nThis term we are focusing on reading for pleasure across all sections, improved science practicals in the secondary school and a renewed emphasis on punctuality and neatness.\n\nParents are reminded to check the school calendar for important dates, including the PTA meeting and First Term examinations. Report cards will be available on the parent portal at the end of term.', published: true, featured: true },
      { id: 'n2', slug: 'inter-house-sports', title: 'Inter-house sports: St. Paul House takes the trophy', category: 'Sports', date: '2026-11-07', image: IMG('photo-1526232761682-d26e03ac148e'), summary: 'A day of colour, teamwork and healthy competition as our four houses competed on the school field.', body: 'Our annual inter-house sports competition was a great success. Pupils and students from St. Peter, St. Paul, St. Mary and St. Joseph houses competed in track events, relays, football and the much-loved parents\' race.\n\nCongratulations to St. Paul House, overall winners for this year, and thank you to all the parents and guardians who came to cheer.', published: true },
      { id: 'n3', slug: 'science-quiz', title: 'Students shine at diocesan science quiz', category: 'Achievement', date: '2026-10-22', image: IMG('photo-1532094349884-543bc11b234d'), summary: 'Our JSS team reached the final of the inter-school science quiz competition.', body: 'Our Junior Secondary science quiz team represented the school with distinction, reaching the final round of the inter-school science quiz.\n\nWe are proud of their preparation, teamwork and sportsmanship, and thank their teachers for the extra coaching sessions.', published: true },
      { id: 'n4', slug: 'reading-week', title: 'Reading Week: every child a reader', category: 'Academics', date: '2026-10-05', image: IMG('photo-1503676260728-1c00da094a0b'), summary: 'Storytelling, spelling bees and book swaps for nursery and primary pupils.', body: 'Reading Week brought storytelling sessions, spelling bees, a book swap and visits from guest readers.\n\nParents can support reading at home by reading together for fifteen minutes every evening.', published: true },
      { id: 'n5', slug: 'pta-meeting', title: 'PTA general meeting — all parents invited', category: 'Community', date: '2026-11-20', image: IMG('photo-1523050854058-8df90110c9f1'), summary: 'Parents and guardians are invited to the First Term PTA general meeting.', body: 'The First Term PTA general meeting will discuss school development projects, security, and the upcoming Christmas activities. All parents and guardians are encouraged to attend.', published: true }
    ];

    const events = [
      { id: 'e1', title: 'PTA General Meeting', date: '2026-12-05', time: '10:00', location: 'School Hall', category: 'Parents', desc: 'First Term general meeting of the Parent-Teacher Association.' },
      { id: 'e2', title: 'First Term Examinations', date: '2026-12-07', endDate: '2026-12-11', time: '08:00', location: 'All classrooms', category: 'Academic', desc: 'End-of-term examinations for all classes.' },
      { id: 'e3', title: 'Christmas Carol & Nativity Play', date: '2026-12-15', time: '14:00', location: 'School Chapel', category: 'Faith', desc: 'Carols, readings and a nativity play by nursery and primary pupils. Families welcome.' },
      { id: 'e4', title: 'Vacation: First Term ends', date: '2026-12-18', time: '12:00', location: '', category: 'Holiday', desc: 'Pupils and students close for the Christmas holiday. Report cards available on the portal.' },
      { id: 'e5', title: 'Second Term Resumes', date: '2027-01-11', time: '07:30', location: '', category: 'Academic', desc: 'All pupils and students resume for Second Term.' },
      { id: 'e6', title: 'Entrance Examination (2027/2028 intake)', date: '2027-02-13', time: '09:00', location: 'Secondary Block', category: 'Admissions', desc: 'Entrance examination for candidates seeking admission into JSS 1 and Primary classes.' },
      { id: 'e7', title: 'Mid-term Break', date: '2026-10-29', endDate: '2026-10-30', time: '', location: '', category: 'Holiday', desc: 'Mid-term break for all classes.' },
      { id: 'e8', title: 'Inter-house Sports', date: '2026-11-07', time: '09:00', location: 'School Field', category: 'Sports', desc: 'Annual inter-house sports competition.' }
    ];

    const gallery = [
      ['Classroom learning', 'Classroom', 'photo-1503676260728-1c00da094a0b'],
      ['Young learners', 'Nursery', 'photo-1503454537195-1dcabb73ffb9'],
      ['Primary pupils at work', 'Classroom', 'photo-1509062522246-3755977927d7'],
      ['Science practical', 'Science', 'photo-1532094349884-543bc11b234d'],
      ['Secondary students', 'Classroom', 'photo-1529390079861-591de354faf5'],
      ['Graduation day', 'Events', 'photo-1523050854058-8df90110c9f1'],
      ['Sports day', 'Sports', 'photo-1526232761682-d26e03ac148e'],
      ['Reading together', 'Nursery', 'photo-1588072432836-e10032774350'],
      ['Library time', 'Classroom', 'photo-1497633762265-9d179a990aa6'],
      ['Art and creativity', 'Events', 'photo-1513364776144-60967b0f800f'],
      ['Computer lessons', 'Science', 'photo-1588072432904-843af37f03ed'],
      ['Outdoor play', 'Sports', 'photo-1472162072942-cd5147eb3902']
    ].map((g, i) => ({ id: 'g' + i, title: g[0], album: g[1], image: IMG(g[2]) }));

    const faqs = [
      ['When does admission open?', 'Admission runs throughout the year for Nursery and Primary, subject to space. Entrance examinations for JSS 1 and other secondary classes are held before each new session. Apply online on the Admissions page or visit the school office.'],
      ['What age can my child start nursery?', 'Children are typically admitted into Nursery 1 from about three years of age. Please contact the school to confirm current age requirements.'],
      ['What documents are needed for admission?', 'A birth certificate or sworn declaration of age, recent passport photographs, the last report card or transfer letter (for transfers) and the completed application form. Medical/immunisation records are requested for nursery pupils.'],
      ['How do I pay school fees?', 'Fees can be paid by bank transfer, POS or at the bursary. Always use your child\'s admission number as the payment reference. Every payment is recorded on the parent portal with a printable receipt.'],
      ['How do I see my child\'s results?', 'Log in to the parent portal to see report cards, attendance and homework. You can also use the Result Checker with your child\'s admission number and a result PIN issued by the school.'],
      ['Is the school only for Catholics?', 'Epiphany Schools is guided by Catholic values and welcomes families who respect the school\'s ethos. Please speak with the school office about admissions policy.'],
      ['What are the school hours?', 'Lessons typically run from 8:00 am to 2:20 pm, Monday to Friday. Exact times, including after-school activities, will be confirmed by the school.'],
      ['How does the school communicate with parents?', 'Through the parent portal (announcements, messages and report cards), the school website, PTA meetings and, where provided, the school\'s phone and WhatsApp lines.']
    ].map((f, i) => ({ id: 'q' + i, q: f[0], a: f[1], order: i }));

    const testimonials = [
      { id: 't1', quote: 'The teachers know my children by name and genuinely care about how they grow — in their books and in their character.', name: 'Parent of a Primary pupil', sample: true },
      { id: 't2', quote: 'Being able to see results, attendance and fees in one place has made it much easier to support my son at home.', name: 'Parent of a JSS student', sample: true },
      { id: 't3', quote: 'The discipline and values I learnt here prepared me for university and for life.', name: 'Alumnus', sample: true }
    ];

    // Admissions applications
    const applications = [
      { id: uid('app'), ref: 'APP-2026-0101', status: 'Under review', created: '2026-11-18', child: { firstName: 'Ifunanya', lastName: 'Nnadi', otherName: 'Grace', gender: 'Female', dob: '2021-05-14' }, classSought: 'Nursery 3', section: 'nursery', prevSchool: '', parent: { name: 'Mrs. Chinwe Nnadi', phone: '08035550101', email: '', relationship: 'Mother', address: 'Orsu, Imo State', occupation: 'Trader' }, medical: '', notes: '', examDate: '', history: [{ at: '2026-11-18', status: 'Submitted', note: 'Application received online.' }, { at: '2026-11-20', status: 'Under review', note: 'Documents being verified.' }] },
      { id: uid('app'), ref: 'APP-2026-0102', status: 'Exam scheduled', created: '2026-11-15', child: { firstName: 'Kenechukwu', lastName: 'Amadi', otherName: '', gender: 'Male', dob: '2014-08-02' }, classSought: 'JSS 1', section: 'secondary', prevSchool: 'Community Primary School, Orsu', parent: { name: 'Mr. Paul Amadi', phone: '08035550102', email: '', relationship: 'Father', address: 'Awo-Idemili', occupation: 'Civil servant' }, medical: '', notes: '', examDate: '2026-12-12', history: [{ at: '2026-11-15', status: 'Submitted', note: 'Application received online.' }, { at: '2026-11-17', status: 'Exam scheduled', note: 'Entrance exam on 12 Dec 2026 at 9:00 am.' }] },
      { id: uid('app'), ref: 'APP-2026-0103', status: 'Submitted', created: '2026-11-25', child: { firstName: 'Somto', lastName: 'Igwe', otherName: 'Peter', gender: 'Male', dob: '2018-01-21' }, classSought: 'Primary 3', section: 'primary', prevSchool: 'St. Anne\'s Nursery & Primary', parent: { name: 'Mrs. Ada Igwe', phone: '08035550103', email: '', relationship: 'Mother', address: 'Owerri, Imo State', occupation: 'Nurse' }, medical: 'Mild asthma — has inhaler.', notes: '', examDate: '', history: [{ at: '2026-11-25', status: 'Submitted', note: 'Application received online.' }] }
    ];

    const enquiries = [
      { id: uid('enq'), name: 'Mr. Obinna Uzoma', phone: '08061112222', email: '', level: 'Secondary', message: 'Good day. Please what are the requirements for transfer into SS 1 in January?', created: '2026-11-24T10:12:00', status: 'New' },
      { id: uid('enq'), name: 'Mrs. Joy Ekwueme', phone: '08072223333', email: '', level: 'Nursery', message: 'I would like to visit the school with my daughter. Which days are best?', created: '2026-11-21T15:40:00', status: 'Replied', reply: 'Thank you — weekdays between 9am and 1pm are best. We look forward to welcoming you.' }
    ];

    const messages = [
      { id: uid('thr'), subject: 'Chinedu — Mathematics extra lessons', participants: ['u_parent1', 'u_staff1'], studentId: j2[0].id, updated: addDays(-1) + 'T16:20:00', readBy: ['u_staff1'], messages: [
        { from: 'u_parent1', at: addDays(-2) + 'T19:05:00', text: 'Good evening Mr. Okeke. Chinedu says he is finding simple equations difficult. Are there extra lessons he can join?' },
        { from: 'u_staff1', at: addDays(-1) + 'T16:20:00', text: 'Good evening sir. Yes — we run Mathematics clinic on Tuesdays and Thursdays after school. I will add him to the list and send practice questions home.' }
      ] }
    ];

    const announcements = [
      { id: uid('ann'), title: 'First Term examination timetable', body: 'The First Term examination timetable has been published. Examinations begin Monday 7 December. Pupils should come with writing materials and their examination cards.', audience: 'all', date: addDays(-2), author: 'u_admin', pinned: true },
      { id: uid('ann'), title: 'Fees reminder', body: 'Parents with outstanding First Term balances are kindly reminded to complete payment before examinations. Use your child\'s admission number as the reference.', audience: 'parent', date: addDays(-4), author: 'u_staff6' },
      { id: uid('ann'), title: 'Staff meeting — Friday', body: 'All teaching staff: brief meeting on Friday at 2:30 pm to review examination preparations and report-card deadlines.', audience: 'teacher', date: addDays(-1), author: 'u_admin' }
    ];

    // Result-checker PINs
    const pins = [];
    for (let i = 0; i < 12; i++) {
      const pin = String(between(100000000000, 999999999999));
      pins.push({ id: uid('pin'), serial: 'EPS' + pad(i + 1, 5), pin, studentId: null, uses: 0, maxUses: settings.pinMaxUses, session: settings.session, term: settings.term, created: today() });
    }
    pins[0].studentId = p4[0].id; pins[1].studentId = j2[0].id;

    return {
      version: DB_VERSION,
      seededAt: new Date().toISOString(),
      settings, users, classes, students,
      subjects: SUBJECTS,
      scores, reports, attendance, feeSchedule,
      payments: payments.filter(p => !p._del),
      timetables, periods, homework,
      news, events, gallery, faqs, testimonials,
      applications, enquiries, messages, announcements, pins,
      log: [{ id: uid('log'), at: new Date().toISOString(), user: 'system', text: 'Demo data created.' }]
    };
  }

  /* ---------- the Store ---------- */
  const listeners = [];
  const Store = {
    data: null,
    resultContext: {},
    load() {
      const raw = adapter.read();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.version === DB_VERSION) { this.data = parsed; return this; }
        } catch (e) { /* fall through to reseed */ }
      }
      this.data = buildSeed();
      this.save();
      return this;
    },
    /** True when the school database (Supabase) is in use instead of this browser. */
    get cloud() { return !!(global.EPS.Cloud && global.EPS.Cloud.enabled); },
    save() {
      // In cloud mode nothing is kept in browser storage: changed rows are synced to the database.
      if (this.cloud) global.EPS.Cloud.schedule();
      else adapter.write(JSON.stringify(this.data));
      listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    },
    onChange(fn) { listeners.push(fn); },
    reset() {
      if (this.cloud) throw new Error('Resetting is not available when connected to the school database.');
      adapter.clear(); this.data = buildSeed(); this.save();
    },
    exportJSON() { return JSON.stringify(this.data, null, 2); },
    importJSON(str) {
      const parsed = JSON.parse(str);
      if (!parsed || typeof parsed !== 'object' || !parsed.settings || !Array.isArray(parsed.students)) throw new Error('This file is not an Epiphany Schools backup.');
      parsed.version = DB_VERSION;
      if (this.cloud && this.data) {
        // Keep login links and never lock out the person restoring the backup.
        const links = {};
        (this.data.users || []).forEach(u => { if (u.authId) links[u.id] = u.authId; });
        parsed.users = (parsed.users || []).map(u => { const c = Object.assign({}, u); delete c.password; if (links[c.id]) c.authId = links[c.id]; else delete c.authId; return c; });
        const me = global.EPS.Cloud.me();
        if (me && !parsed.users.some(u => u.id === me.id)) parsed.users.unshift(me);
      }
      this.data = parsed; this.save();
    },

    all(name) { return this.data[name] || (this.data[name] = []); },
    get(name, id) { return this.all(name).find(x => x.id === id) || null; },
    find(name, fn) { return this.all(name).find(fn) || null; },
    where(name, fn) { return this.all(name).filter(fn); },
    insert(name, obj) {
      const item = Object.assign({ id: uid(name.slice(0, 3)) }, obj);
      this.all(name).push(item); this.save(); return item;
    },
    upsert(name, obj) {
      const list = this.all(name);
      const i = list.findIndex(x => x.id === obj.id);
      if (i >= 0) list[i] = Object.assign(list[i], obj); else list.push(obj);
      this.save(); return obj;
    },
    update(name, id, patch) {
      const item = this.get(name, id);
      if (!item) return null;
      Object.assign(item, patch); this.save(); return item;
    },
    remove(name, id) {
      const list = this.all(name);
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) { list.splice(i, 1); this.save(); return true; }
      return false;
    },
    get settings() { return this.data.settings; },
    setSettings(patch) { Object.assign(this.data.settings, patch); this.save(); },
    log(user, text) {
      if (this.cloud && !global.EPS.Cloud.authUser) return; // public visitors: the server logs form submissions
      const log = this.all('log');
      log.unshift({ id: uid('log'), at: new Date().toISOString(), user, text });
      if (log.length > 300) log.length = 300;
      this.save();
    },

    /* ----- domain helpers ----- */
    classOf(student) { return student ? this.get('classes', student.classId) : null; },
    studentName(s, opts) {
      if (!s) return '—';
      return opts && opts.formal ? (s.lastName + ', ' + s.firstName + (s.otherName ? ' ' + s.otherName : '')) : (s.firstName + ' ' + s.lastName);
    },
    userName(u) { if (typeof u === 'string') u = this.get('users', u); return u ? [u.title, u.firstName, u.lastName].filter(Boolean).join(' ') : '—'; },
    classStudents(classId) {
      return this.where('students', s => s.classId === classId && s.status === 'Active')
        .sort((a, b) => (a.lastName + a.firstName).localeCompare(b.lastName + b.firstName));
    },
    subjectsFor(classId) { const c = this.get('classes', classId); return c ? (this.data.subjects[c.group] || []) : []; },
    sortedClasses() { return this.all('classes').slice().sort((a, b) => a.order - b.order); },
    termLabel(t) { return TERMS[(t || this.settings.term) - 1] || ''; },

    scoreFor(studentId, subject, session, term) {
      session = session || this.settings.session; term = term || this.settings.term;
      return this.get('scores', [studentId, session, term, subject].join('|'));
    },
    setScore(studentId, subject, field, value, session, term) {
      session = session || this.settings.session; term = term || this.settings.term;
      const id = [studentId, session, term, subject].join('|');
      let s = this.get('scores', id);
      if (!s) { s = { id, studentId, subject, session, term, ca1: null, ca2: null, exam: null }; this.all('scores').push(s); }
      s[field] = value === '' || value == null ? null : Number(value);
      this.save(); return s;
    },
    /** Report-card remarks. Pass create=true only when the caller is about to save changes. */
    report(studentId, session, term, create) {
      session = session || this.settings.session; term = term || this.settings.term;
      const id = [studentId, session, term].join('|');
      let r = this.get('reports', id);
      if (!r) {
        r = { id, studentId, session, term, teacherRemark: '', principalRemark: '', affective: {}, psychomotor: {} };
        if (create || !this.cloud) this.all('reports').push(r);
      }
      return r;
    },

    /** Full class results with averages and positions. */
    classResults(classId, session, term) {
      session = session || this.settings.session; term = term || this.settings.term;
      const cls = this.get('classes', classId);
      const subjects = this.subjectsFor(classId);
      const students = this.classStudents(classId);
      const rows = students.map(s => {
        const subj = subjects.map(sub => {
          const sc = this.scoreFor(s.id, sub, session, term);
          const parts = sc ? [sc.ca1, sc.ca2, sc.exam] : [null, null, null];
          const complete = parts.every(p => p != null);
          const any = parts.some(p => p != null);
          const total = any ? parts.reduce((a, b) => a + (b || 0), 0) : null;
          return { subject: sub, ca1: parts[0], ca2: parts[1], exam: parts[2], total, complete, ...gradeFor(complete ? total : null, cls.section) };
        });
        const scored = subj.filter(x => x.complete);
        const sum = scored.reduce((a, b) => a + b.total, 0);
        const avg = scored.length ? sum / scored.length : null;
        return { student: s, subjects: subj, total: sum, average: avg, count: scored.length };
      });
      // positions
      const ranked = rows.filter(r => r.average != null).sort((a, b) => b.average - a.average);
      ranked.forEach((r, i) => { r.position = i > 0 && Math.abs(ranked[i - 1].average - r.average) < 1e-9 ? ranked[i - 1].position : i + 1; });
      // subject statistics
      const stats = {};
      subjects.forEach((sub, i) => {
        const totals = rows.map(r => r.subjects[i]).filter(x => x.complete).map(x => x.total);
        stats[sub] = totals.length ? { high: Math.max(...totals), low: Math.min(...totals), avg: totals.reduce((a, b) => a + b, 0) / totals.length } : { high: null, low: null, avg: null };
        const sorted = rows.map(r => r.subjects[i]).filter(x => x.complete).sort((a, b) => b.total - a.total);
        sorted.forEach((x, k) => { x.position = k > 0 && sorted[k - 1].total === x.total ? sorted[k - 1].position : k + 1; });
      });
      const classAvg = ranked.length ? ranked.reduce((a, b) => a + b.average, 0) / ranked.length : null;
      return { cls, subjects, rows, stats, classAvg, count: rows.length, session, term };
    },
    studentResult(studentId, session, term) {
      const s = this.get('students', studentId);
      if (!s) return null;
      const res = this.classResults(s.classId, session, term);
      const row = res.rows.find(r => r.student.id === studentId);
      if (!row) return null;
      // Parents and students only receive their own child's scores; the server supplies the
      // class position and statistics so no other child's marks are ever sent to them.
      const ctx = this.resultContext[[studentId, res.session, res.term].join('|')];
      if (ctx) {
        const stats = {};
        res.subjects.forEach(sub => { stats[sub] = (ctx.stats && ctx.stats[sub]) || { high: null, low: null, avg: null }; });
        row.position = ctx.position == null ? undefined : Number(ctx.position);
        row.subjects.forEach(x => { const p = ctx.subjectPositions && ctx.subjectPositions[x.subject]; x.position = p == null ? undefined : Number(p); });
        Object.keys(stats).forEach(k => { const v = stats[k]; stats[k] = { high: v.high == null ? null : Number(v.high), low: v.low == null ? null : Number(v.low), avg: v.avg == null ? null : Number(v.avg) }; });
        return Object.assign({}, res, { row, stats, count: Number(ctx.count), classAvg: ctx.classAvg == null ? null : Number(ctx.classAvg) });
      }
      return Object.assign({}, res, { row });
    },

    feesDue(studentId, session, term) {
      const s = this.get('students', studentId);
      const c = this.classOf(s);
      if (!c) return { items: [], total: 0 };
      const sched = this.find('feeSchedule', f => f.group === c.group);
      const items = sched ? sched.items : [];
      return { items, total: items.reduce((a, b) => a + Number(b.amount || 0), 0) };
    },
    feeStatus(studentId, session, term) {
      session = session || this.settings.session; term = term || this.settings.term;
      const due = this.feesDue(studentId, session, term);
      const pays = this.where('payments', p => p.studentId === studentId && p.session === session && Number(p.term) === Number(term));
      const paid = pays.reduce((a, b) => a + Number(b.amount), 0);
      const balance = due.total - paid;
      return { due: due.total, items: due.items, paid, balance, payments: pays, status: balance <= 0 ? 'Paid' : paid > 0 ? 'Part-paid' : 'Owing' };
    },
    attendanceSummary(studentId, fromDate, toDate) {
      const s = this.get('students', studentId);
      if (!s) return { present: 0, absent: 0, late: 0, total: 0, pct: null, days: [] };
      const days = this.where('attendance', a => a.classId === s.classId && a.records[studentId] && (!fromDate || a.date >= fromDate) && (!toDate || a.date <= toDate))
        .sort((a, b) => a.date.localeCompare(b.date));
      let present = 0, absent = 0, late = 0;
      days.forEach(d => { const v = d.records[studentId]; if (v === 'P') present++; else if (v === 'A') absent++; else if (v === 'L') late++; });
      const total = present + absent + late;
      return { present, absent, late, total, pct: total ? (present + late) / total * 100 : null, days: days.map(d => ({ date: d.date, mark: d.records[studentId] })) };
    },
    /** Turn a data set into an empty school: keeps structure, removes all sample people and records. */
    emptySchool(d, admin) {
      d.users = admin ? [admin] : [];
      d.classes.forEach(c => { c.teacherId = null; });
      ['students', 'scores', 'reports', 'attendance', 'payments', 'homework', 'news', 'events', 'applications', 'enquiries', 'messages', 'announcements', 'pins', 'testimonials', 'subscribers', 'log'].forEach(k => { d[k] = []; });
      d.settings.demoMode = false;
      d.settings.announcement = { active: false, text: '', link: '' };
      return d;
    },
    nextAdmissionNo() {
      const year = new Date().getFullYear();
      const max = this.all('students').reduce((m, s) => { const n = parseInt(String(s.admNo).split('/').pop(), 10); return isNaN(n) ? m : Math.max(m, n); }, 0);
      return this.settings.admissionPrefix + '/' + year + '/' + pad(max + 1, 4);
    },
    nextApplicationRef() {
      const year = new Date().getFullYear();
      const max = this.all('applications').reduce((m, a) => { const n = parseInt(String(a.ref).split('-').pop(), 10); return isNaN(n) ? m : Math.max(m, n); }, 100);
      return 'APP-' + year + '-' + pad(max + 1, 4);
    },
    nextReceiptNo() {
      const max = this.all('payments').reduce((m, p) => { const n = parseInt(String(p.receipt).replace(/\D/g, ''), 10); return isNaN(n) ? m : Math.max(m, n); }, 1000);
      return 'RCT-' + (max + 1);
    }
  };

  global.EPS = Object.assign(global.EPS || {}, {
    Store, uid, isoDate, today, pad, buildSeed, DB_VERSION, TERMS, SECTIONS, SUBJECTS, GRADE_SCALES, ASSESSMENT,
    AFFECTIVE_TRAITS, PSYCHOMOTOR_SKILLS, gradeFor, autoRemark, DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  });
})(window);
