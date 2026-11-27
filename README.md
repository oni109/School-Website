# Epiphany Schools — Website & School Portal

A complete school platform for **Epiphany Nursery, Primary & Secondary Schools, Awo-Idemili** (Catholic Diocese of Orlu): a public website for families, plus a portal for administrators, teachers, parents and students.

It needs **no installation, no build step and no server**: open `index.html` in Chrome, Edge or Firefox.

---

## How to view

1. Download or clone this folder.
2. Double-click **`index.html`** for the public website, or **`portal.html`** for the portal.
3. In the portal, tap one of the **demo accounts**:

| Role | Username | Password | What you'll see |
|---|---|---|---|
| Administrator | `admin` | `admin123` | The whole school office |
| Teacher | `teacher` | `teacher123` | Mrs. Eze — Primary 4 (class teacher) and JSS 2 |
| Parent | `parent` | `parent123` | Mr. Okafor — two children |
| Student | `student` | `student123` | Chinedu Okafor — JSS 2 |

> For offline use and "install as app" support, serve the folder over http(s), e.g. `python3 -m http.server`, or deploy it to GitHub Pages, Netlify or Vercel.

---

## Public website

| Page | Features |
|---|---|
| **Home** | Hero, quick links, the three school sections, live news & upcoming events, testimonials, admissions call-to-action |
| **About** | Story, mission & vision, core values, leadership, facilities |
| **Academics** | Nursery / Primary / JSS / SS subjects (taken from the portal), continuous assessment, WAEC & primary grading scales, clubs |
| **Admissions** | 5-step process, requirements, age guide, **fees per term** (taken from the portal's fee schedule), FAQs |
| **Apply online** | 4-step application form with a saved draft, review step, instant reference number and printable acknowledgement |
| **Track application** | Parents enter reference + phone to see the status timeline and exam date |
| **Result checker** | Admission number + scratch-card style **result PIN** → printable report card (PINs have use limits) |
| **News** | Search, categories, article pages, WhatsApp/Facebook sharing |
| **Calendar** | Month view, term dates, event details, **download to phone calendar (.ics)** |
| **Gallery** | Albums with a full-screen lightbox (keyboard and swipe-friendly) |
| **FAQs / Contact** | Accordion FAQs; enquiry form that goes to the portal inbox, plus a map |
| Site-wide | Announcement banner, dark mode, WhatsApp chat button, newsletter sign-up, mobile menu, accessible markup |

## Portal

**Administrator**
- **Dashboard**: students, staff, attendance today, fee collection (by section), new applications and enquiries, results progress, activity feed
- **Students**: search and filter, add/edit, **CSV import/export**, full profile (results, attendance, fees), **printable ID cards**, one-click parent login creation
- **Staff & users**: teacher, admin, parent and student accounts; class access; generated passwords shared via WhatsApp
- **Classes**: class teachers, subjects per curriculum, add arms, **end-of-session promotion** (SS 3 → graduated)
- **Attendance**: daily register (P / L / A), WhatsApp absence alerts to parents, term summary, CSV export
- **Gradebook**: CA1 /20, CA2 /20, Exam /60 with auto-save and keyboard entry, download/upload score sheets, **broadsheet** with positions
- **Report cards**: positions, subject positions, class average and highest score, affective & psychomotor ratings, teacher and principal remarks (with suggestions), print one or a whole class
- **Fees**: record payments → **printable receipts**, outstanding balances with WhatsApp reminders, editable fee schedule, collection by class
- **Admissions**: review applications, schedule entrance exams, admit or decline, **enrol as a student** (admission number issued)
- **Enquiries, announcements, messages** (parents ↔ teachers ↔ school office)
- **Website content**: news (with photo upload), events, gallery, FAQs, banner, testimonials; changes show on the website straight away
- **Result PINs**: generate, print slips, export, reset
- **Settings**: school profile, session and term dates, bank details, social links, demo mode, withholding results when fees are owed
- **Data & backup**: download/restore backups, storage meter, **"Start fresh"** to remove the sample data, activity log

**Teacher**: their classes only: attendance, gradebook, report remarks, homework, timetable, messages with parents.

**Parent**: switch between children; report cards with charts, attendance, fees and receipts, "I have paid" notice to the bursary, homework, timetable, calendar, messages to teachers.

**Student**: timetable (today highlighted), homework (mark as done), results, attendance, announcements.

---

## Before going live — checklist

- [ ] In **Settings**, fill in the official phone, WhatsApp, email, office hours, principal/head teacher names, bank details and term dates (the site shows *"To be confirmed"* until then; nothing has been invented).
- [ ] Confirm the crest and colours. The crest is a **proposed concept**, not official branding.
- [ ] Replace the fee schedule (currently **sample** amounts) with approved fees.
- [ ] Replace the stock photos (Unsplash) with approved photos of the school, with consent for any children shown.
- [ ] Remove or replace the sample testimonials.
- [ ] **Data & backup → Start fresh**, then add real staff, import students by CSV, and switch **Demo mode off**.
- [ ] Change the admin password (My account).

## Important: where the data lives

This edition stores data in **the browser's local storage on one device**, so it works anywhere with no running costs. That suits a demonstration, or a single office computer with regular backups. To let parents and teachers use the portal from their own phones with **shared, secure data**, connect it to an online backend:

- All data access goes through one object, `Store`, in `assets/js/data.js`. Replace its `adapter` (read/write) with calls to a hosted database such as **Supabase** or **Firebase**, and move sign-in to that service's authentication. No screen code needs to change.
- Passwords in this edition are stored in plain text inside the browser and are **for demonstration only**. Use the backend's authentication before real families sign in.
- Online card payments (Paystack/Flutterwave) and SMS can be added at the same point.

## Project structure

```
index.html            public website (hash-routed: #/about, #/apply, …)
portal.html           portal (#/dashboard, #/students, …)
manifest.webmanifest  installable app metadata
sw.js                 offline cache (when served over http/https)
assets/css/           base.css (tokens, dark mode, shared components), site.css, portal.css
assets/js/data.js     data store, demo data, grading, results/fees/attendance calculations
assets/js/ui.js       shared helpers: report card, receipt, timetable, charts, modals, CSV, .ics
assets/js/site.js     public website pages
assets/js/portal*.js  portal shell + views
```

## Research basis

The Catholic Diocese of Orlu schools directory lists *Epiphany Nursery and Primary School, Awo-Idemili* and *Epiphany Secondary School, Awo-Idemili*: <https://orludiocese.org/schools/>. No official logo or website was found. All names, scores and payments in the demo data are fictional.
