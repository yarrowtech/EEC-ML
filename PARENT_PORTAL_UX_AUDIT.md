# UX AUDIT — EEC PARENT PORTAL

**Product:** EEC (Electronic Educare) — parent-facing web app
**Scope:** 15 routes / `frontend/src/parents/*` + the portal shell (`ParentPortal.jsx`)
**Method:** Static review of components & flows, cross-screen pattern sweep, IA trace against the sidebar registry. The running app was **not** exercised against a live database.
**Date:** 2026-09-02
**Companion:** `PARENT_PORTAL_AUDIT.md` covers correctness, endpoint wiring, and the accessibility remediation log. This report is scoped to **experience** and does not restate it.

---

## VERDICT

The portal is feature-complete and, after the recent remediation, functionally sound. Its UX problem is not missing features — it is that fifteen screens were built to fifteen different briefs, so the portal reads as several small apps behind one login.

Four things drive most of the friction:

1. A flat fifteen-item menu with two destinations that are the same screen.
2. Five different controls for the one action a parent repeats everywhere — "which child am I looking at".
3. No single accent colour, so each screen looks like a different vendor.
4. The portal's headline feature — AI progress reports — sitting behind a manual "Generate" click per card, per child, every visit.

None of this needs a rebuild. It needs consolidation: one navigation model, one child-switcher, one palette, and reports that load themselves.

### Scorecard

| Dimension | Score | |
|---|---|---|
| Information architecture | 2 / 5 | weak |
| Visual consistency | 2 / 5 | weak |
| Flow efficiency | 2 / 5 | weak |
| Feedback clarity | 3 / 5 | fair |
| Mobile | 2 / 5 | weak |
| Content & voice | 3 / 5 | fair |

### Finding count

| Severity | Count |
|---|---|
| 🔴 Critical | 4 |
| 🟠 Serious | 8 |
| 🟡 Polish | 12 |
| **Total** | **24** |

---

## FIX IN THIS ORDER

Ordered so the structural decisions land first: settle navigation and the shared components, and the visual and flow work has something consistent to attach to.

| # | Fix | Findings | Refs |
|---|---|---|---|
| 1 | **Merge "Academic Report" and "Results" into one screen; regroup the menu.** They are the same screen against the same endpoint. Collapse to one; fold the fifteen flat items into four labelled groups. | A1, A2 | `ParentPortal.jsx:54–68` |
| 2 | **Build one child-switcher component and use it on every screen.** There are five right now. Pick the pill/segment pattern, same place on every page, persist the choice across navigation. | C1 | 11 screens |
| 3 | **Choose one parent-portal accent colour and apply it top to bottom.** Shell is yellow, dashboard purple, meetings yellow, analytics amber, complaints amber, observations blue. Keep semantic red/amber/green separate for status. | B1 | 9 screens |
| 4 | **Make the AI reports load themselves.** Auto-fetch the most recent cached report on mount, show a skeleton, demote "Generate" to a secondary "Refresh". | D1 | `ParentDashboard.jsx:167–289` |
| 5 | **Collapse the PTM tabs.** "Meetings" and "Requests" show overlapping items. One list, a status filter, video access inline on the confirmed meeting. | D2 | `PTMPortal.jsx:257–262` |
| 6 | **Calm the dashboard.** Drop the three ambient blur blobs and the "Portal Active" / "Live Student Status" pulse badges. Raise the base font off `9–11px`. Let the child cards be the first thing in view. | B2, B3, G1 | `ParentDashboard.jsx:481–556` |

---

## SECTION A — NAVIGATION & INFORMATION ARCHITECTURE

The sidebar is the only wayfinding device in the portal. It carries fifteen equally-weighted items with no grouping, and two of them lead to the same place.

### 🔴 A1 — "Academic Report" and "Results" are the same screen twice

**What the parent hits:** two menu items about grades; they have to open both to work out the difference. There isn't one.

Both fetch `GET /api/reports/report-cards/parent`, both render a "Subject performance" grid and an assessment-history table, and the files are ~90% identical (418 vs 397 lines). "Growth Analytics" then covers the same academic ground a third time with charts.

```
AcademicReport.jsx    path: '/parents/academic'   → report-cards/parent
ResultsView.jsx       path: '/parents/results'    → report-cards/parent
ChildGrowthAnalytics  path: '/parents/analytics'  → parent-dashboard/analytics/*
```

**Move:** One "Progress" screen — report card as the default view, a "Trends" toggle for the charts. Delete the third route or make it a tab.

### 🟠 A2 — Fifteen flat menu items, no grouping

**What the parent hits:** every visit starts with a fifteen-item scan. Nothing tells the parent that Chat, Complaints, Parent Observation and Excuse Letters are all "contact the school" — they're scattered between Fees and Results.

```
Dashboard · Growth Analytics · Holiday List · Class Routine ·
Attendance Report · Academic Report · Fees Payment · Health Report ·
Chat · Complaints · Parent-Teacher Meetings · Parent Observation ·
Excuse Letters · Results · Achievements
                                            ParentPortal.jsx:54–68
```

**Move:** Four groups with headers — **Progress** (Growth, Report card, Attendance, Achievements) · **Schedule** (Routine, Holidays) · **Money** (Fees) · **Talk to school** (Chat, Meetings, Complaints, Observations, Excuse letters) · Health on its own.

### 🟠 A4 — No search, no breadcrumb, no cross-links between related screens

**What the parent hits:** reading an attendance dip, they have no path to that day's timetable or to messaging the class teacher — they go back to the menu and start over.

The portal shell provides the sidebar, a notification tray and a profile menu; that's the whole navigation surface. Related screens never reference each other.

**Move:** Add contextual links at the point of need — on Attendance, "See this week's routine" and "Message [teacher]"; on a low subject score, "Ask about this".

### 🟡 A3 — Two menu items share an icon

"Holiday List" and "Attendance Report" both use the `Calendar` glyph (`ParentPortal.jsx:56, 58`), so the icon column stops being a scanning aid.

**Move:** Distinct glyphs — a sun/beach mark for holidays, a check-grid for attendance.

---

## SECTION B — VISUAL SYSTEM

Each screen was styled on its own. The result is a portal with no shared colour, inconsistent surface treatment, and body text set below a comfortable reading size.

### 🔴 B1 — The portal has no accent colour; it has six

**What the parent hits:** navigating from the (yellow) sidebar into the (purple) dashboard, then to (yellow) meetings, then to (blue) observations, feels like being handed off between vendors. Colour currently signals nothing.

| Screen | Primary action colour |
|---|---|
| Portal shell (active nav) | `yellow-500` |
| Dashboard, Fees | `purple-600/700` |
| Parent-Teacher Meetings | `yellow-500` |
| Growth Analytics | `amber-500` |
| Complaints | `amber-700` |
| Parent Observation | `blue-500` |
| Holiday List | `indigo-700` |

**Move:** One accent for the whole parent portal (the shell's identity colour is the natural choice). Reserve red / amber / green strictly for status — overdue, pending, cleared.

### 🟠 B2 — The dashboard's decoration competes with its data

**What the parent hits:** before they read a single number, the page is running three infinite floating-blob animations, two pulsing "live" dots, heavy backdrop blur and 2rem corner radii. The eye doesn't know where to land.

```
3 × motion.div  — infinite blur-blob drift        :483–497
"Portal Active" badge  — opacity pulse, 2.5s loop  :520–528
"Live Student Status"  — ping dot                  :628–636
backdrop-blur-2xl · shadow-2xl · rounded-[2rem]
```

**Move:** Static background. Drop both "live" badges — a real-time claim on a 60-second clock isn't information. One shadow depth, one radius token.

### 🟠 B3 — Structural text is set at 9–11px

**What the parent hits:** labels, metadata, stat captions and status pills across the portal use `text-[9px]` / `[10px]` / `[11px]` with `text-slate-400`. On a phone at arm's length these are guesswork, and they fail WCAG AA for contrast at that size.

Overlaps the accessibility audit's §3, still open pending a real-device contrast check.

**Move:** Floor body-adjacent text at 13px, captions at 12px, and lift `slate-400` to `slate-500/600` anywhere under 14px.

### 🟡 B4 — Stat tiles mix numbers and sentences

The dashboard's tile row shows "Active profiles", "All fees cleared", "3 open", a percentage and a date — five different value shapes in one glanceable row (`ParentDashboard.jsx:400–446`). There is no consistent thing to read.

**Move:** Every tile — one number or short value, one caption. Move the prose into the caption line.

---

## SECTION C — CROSS-SCREEN CONSISTENCY

A parent with two or more children switches child constantly. It should be one muscle-memory gesture. It is currently five.

### 🔴 C1 — Five child-switcher patterns

**What the parent hits:** each screen re-teaches how to pick a child, and the choice doesn't carry over — switch to your second child on Attendance, open Fees, you're back on the first.

| Pattern | Screens |
|---|---|
| Native `<select>` dropdown | Academic Report, Results, Attendance, Achievements, Health |
| Row of text buttons | Class Routine |
| Pill buttons (`StudentPill`) | Growth Analytics |
| Horizontal snap-scroll cards | Fees Payment |
| Radio-card group | Parent Observation |

**Move:** One `<ChildSwitcher>` — segmented pills for 1–3 children, dropdown above that — pinned top-left of every screen, backed by a shared context so the selection persists.

### 🟡 C2 — Loading copy is written fresh each time

"Constructing Portal…", "FETCHING REGISTERS…", "Loading analytics…", "Loading fees…". Three tones, two capitalisations, one of them jargon.

**Move:** One skeleton component; if text is shown, one pattern — "Loading [thing]…".

### 🟡 C3 — Refresh is present on some screens, absent on others

Excuse Letters, Fees and PTM expose a manual refresh; Attendance, Academic and Achievements don't. Placement varies (header-right, inline, in a toolbar).

**Move:** Decide the rule — either every data screen has refresh in the same header slot, or none do and you refetch on focus.

---

## SECTION D — CORE FLOWS

### 🔴 D1 — The AI reports make the parent do the work

**What the parent hits:** the "AI-Powered Reports" block shows, per child, three cards — Home Support, Weekly Digest, Monthly Report — each blank with a "Get Tips" / "Generate" button. Click, wait several seconds on a bare spinner, read. Next visit: everything is blank again.

```
HomeSupportCard  — button "Get Tips" → "Refresh"   :202
AIDigestCard     — button "Generate" → "Refresh"   :276
no cached render on mount · spinner only, no progress
```

**Move:** On mount, load the latest stored report and render it. Skeleton while it comes. "Regenerate" is a quiet secondary action with a timestamp ("updated 2 days ago"). The feature should feel finished, not summoned.

### 🟠 D2 — PTM "Meetings" and "Requests" overlap

**What the parent hits:** a pending meeting shows in the Meetings tab *and* the Requests tab. The parent has to guess which one to act in, and there are four tabs for a list that's usually one or two rows.

```
tabs: Meetings · Requests · Video Meeting · History   :257–262
upcomingMeetings = pending + confirmed
pendingRequests  = pending + reschedule_requested
```

**Move:** One list, newest first, with a status chip on each row and a filter. "Join" appears inline on a confirmed video meeting — no separate tab.

### 🟠 D3 — "Pay Now" has no fallback if the payment script stalls

**What the parent hits:** checkout depends on loading `checkout.razorpay.com/v1/checkout.js` at click time. On a school network that blocks it, or a slow connection, the button spins and nothing else happens.

```
FeesPayment.jsx:157–168  — loadRazorpayScript(), onerror → resolve(false)
```

**Move:** Preload the script when the Fees screen opens, not on click. On failure show a real message with a way forward ("Online payment isn't reachable right now — pay at the school office or try again") and, ideally, a hosted-checkout-link fallback.

### 🟡 D4 — Health Report opens onto emptiness with no orientation

The screen's honest empty states are an improvement, but a parent lands on a page that's mostly "No … recorded" with nothing saying who maintains this data or when it changes.

**Move:** One line under the title: "Health records are entered by the school office. Contact them to add or correct anything."

---

## SECTION E — FEEDBACK & STATE

### 🟠 E1 — Analytics failures are swallowed into empty states

**What the parent hits:** if the academic / wellbeing / skills calls fail, Growth Analytics shows the same "no data yet" it shows for a genuinely new student. The parent can't tell "nothing to report" from "this didn't load".

```
ChildGrowthAnalytics.jsx  — .catch(() => {}) on all three analytics fetches
```

**Move:** Distinguish the two — an inline "Couldn't load — retry" on error, the encouraging empty state only on a true 200-with-no-data.

### 🟡 E2 — Submit feedback is inconsistent

Parent Observation drops a new row that reads `undefined` for the student name until reload. PTM feedback fires a toast; PTM reschedule doesn't. No shared "saved" convention.

**Move:** One post-submit pattern — optimistic row with the real values, plus a single toast worded as the outcome ("Observation saved", "Reschedule requested").

### 🟡 E3 — The AI cards flip "Generate" to "Refresh" with no explanation

After one generation the button label changes and the empty helper text disappears, but nothing marks the content as fresh or dated. A parent re-opening the dashboard can't tell if they're looking at today's digest or last week's.

**Move:** Always show an "updated <when>" line once content exists (pairs with D1).

---

## SECTION F — CONTENT & VOICE

### 🟡 F1 — "Ward Overview"

The dashboard section listing a parent's children is headed "Ward Overview". "Ward" is legal/administrative language; most parents wouldn't use it about their own child.

**Move:** "Your children" — or the child's name when there's only one.

### 🟡 F2 — System voice and anxious decoration

"Constructing Portal…", "Portal Active", "Live Student Status". The first is jargon; the other two are pulsing badges that assert real-time monitoring the portal doesn't actually do, and read as slightly alarming rather than reassuring.

**Move:** Cut all three. If a freshness signal is wanted, a quiet "Updated 9:15 AM" does the job without the pulse.

### 🟡 F3 — Empty states range from helpful to bare

Health's "managed by the school office" empty state tells the parent what to do; Attendance's "No records found" and Achievements' "No achievements yet" leave them wondering whether that's expected.

**Move:** Every empty state answers two questions — is this normal, and is there anything I can do? Keep the illustration, fix the sentence.

---

## SECTION G — MOBILE

### 🟠 G1 — The dashboard buries child data below a full-height welcome block

**What the parent hits:** on a phone the five-column stat grid becomes a single column, so the parent scrolls past the greeting card, the chat tile and six stat tiles — roughly two screen-heights — before reaching "how is my child doing".

**Move:** On narrow viewports, lead with the child card(s). Collapse the stat row to a compact two-up strip and move it below.

### 🟡 G2 — 9–11px labels on a handheld

Same root cause as B3, but mobile makes it acute: status pills, dates and stat captions are effectively unreadable without zooming.

**Move:** Covered by the B3 type floor — verify specifically on a 360px-wide device.

### 🟡 G3 — The horizontal-scroll child picker is only on Fees

Fees uses a nice mobile pattern — a swipeable row of child cards — but it's the only screen that does, so the parent never gets to rely on it. (Resolved for free by C1: pick one switcher, it can be this one.)

---

## WHAT'S WORKING WELL — DO NOT TOUCH

- **Every screen has loading and empty states.** They're inconsistent (C2, F3), but the coverage is there — no screen dumps a blank page.
- **The recent functional + accessibility remediation landed cleanly.** Shared session wrapper, real PTM endpoints, de-mocked Health screen, an axe test suite that passes, focus-trapped dialogs.
- **The Fees sticky mobile pay bar** keeps the primary action reachable without scrolling — the right instinct.
- **The notification tray** — poll, mark-read, mark-all, visibility-change refresh — is complete and unobtrusive.
- **Health Report's empty states** are the model the rest of the portal should copy: they say who owns the data and what the parent can do.
- **Logout is a confirm step,** not a one-tap trapdoor next to the nav.

---

## METHOD & LIMITS

- **Method.** Static review of `frontend/src/parents/*` and `ParentPortal.jsx` at commit state 2026-09-02: component and flow reading, cross-screen pattern comparison, IA trace against the sidebar registry. The running app was not exercised against a live database.
- **Limits.** Contrast (B3, G2) is asserted from font-size + token values, not measured in a browser. Findings about frequency ("parents switch child constantly") are reasoned from the multi-child data model, not usage analytics. Severity is UX impact, not implementation cost.
- **Companion document.** `PARENT_PORTAL_AUDIT.md` — correctness, endpoint wiring, and the accessibility remediation log.
