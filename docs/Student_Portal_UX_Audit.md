# EEC Student Portal — UX / UI Audit

**Subject:** Student-facing portal (`/student`) — React 18 · Vite · Tailwind v4 · single `Dashboard` shell, ~40 sections
**Method:** source inspection (no browser render available in the audit environment)
**Scope:** student role only
**Status:** audit complete — no application code changed
**Date:** 2026-08-27

> Code-based audit — findings verified against source, not a live render. A browser-render pass (exact contrast ratios, real layout at each breakpoint, motion feel) is the recommended next step.

---

## 1. Executive summary

Scores are read as **quality out of 10 — higher is better**.

| Dimension | Score | |
|---|---|---|
| Overall UX | **5 / 10** | Moderate friction |
| Visual quality | **4 / 10** | |
| Accessibility | **3 / 10** | |
| Navigation | **5 / 10** | |
| Responsiveness | **6 / 10** | |
| Consistency | **3 / 10** | Lowest |
| Form UX | **5 / 10** | |
| Dashboard UX | **4 / 10** | |

**What is working.** Task depth is shallow — almost everything is reachable in two clicks. The **Learning hub** is the strongest screen: a clear `<h1>`, real `role="tablist"` semantics, a genuine "continue where you left off" affordance. The login form has inline validation and a password-strength meter. Several dashboard widgets (Course Progress, Achievements, Calendar) include their own loading and empty states.

**What is holding it back.** There is a design system on paper — ShadCN primitives, cva variants, CSS tokens — that the product almost never uses (raw `<button>` outnumbers the `<Button>` component roughly 10 to 1). In its place: ten-plus loaded font families, six border radii in heavy rotation, five different accent colors depending on which screen you are on, and five parallel ways to tell the user something happened (toast, SweetAlert2, `window.confirm`, hand-built modals, inline error text). The home dashboard fires around ten independent requests and shows nothing coherent while they resolve. Keyboard focus is invisible almost everywhere. The browser tab always says "EEC".

---

## 2. The five biggest problems

Ranked by how much they degrade the whole experience, not by how hard they are to fix.

1. **The design system exists but isn't used.**
   10+ font families, 6 border radii, 5+ accent colors, per-screen visual identities (the Routine screen uses a serif display face and glassmorphism; the Learning hub uses a cream-and-green palette; everything else is grey). Buttons, modals, toasts, empty states and page headings are all re-invented per screen. Root cause of the low Consistency and Visual-quality scores, and it makes every other fix more expensive.

2. **The accessibility floor is too low.**
   No visible keyboard-focus indicator across the shell (the global focus style is commented out and never replaced). The core academic screens — Assignments, Results, Attendance, Fees, Exams — contain zero ARIA or landmark roles. Form errors are not announced. There is no `prefers-reduced-motion` handling for a motion-heavy UI. No page ever sets `document.title`.

3. **The dashboard has no loading or empty story.**
   Every home-screen card fetches on its own and returns `null` while loading or when empty. The result is a staggered pop-in with cumulative layout shift on every visit, and a near-blank screen for a brand-new student — with no explanation of what will fill it or where to start.

4. **Navigation is mis-labelled and search is not search.**
   "Fees" sits under *Academics*; "Attendance" under *Schedule*; "Mastery Progress" and "Error Analysis" under *Wellness*. A student cannot predict where a feature lives. The header search box is keyword-guessing (`query.includes('attendance')` → route), returns no results, and the animated placeholder promises a real search that isn't there. There are no breadcrumbs.

5. **Feedback is fragmented, and sometimes silent.**
   Five feedback mechanisms in one product; SweetAlert2 loaded twice (npm bundle *and* a CDN `<script>`). Logout is confirmed with a styled modal in the sidebar and a raw `window.confirm` on mobile. Onboarding preferences fail silently — a network error is swallowed and the student is told they're done.

---

## 3. Issue table

Severity is not inflated:
**P0** blocks a user or is a real accessibility barrier · **P1** significant friction on an important task · **P2** noticeable but recoverable · **P3** polish.
Effort: **S** small · **M** medium · **L** large.

| ID | Screen / component | Problem | Sev | UX impact | Recommended fix | Eff. |
|----|-------------------|---------|-----|-----------|-----------------|------|
| A11Y-01 | Global shell (Sidebar, Header, Bottom nav) | No visible keyboard-focus state. The global `button:focus` outline is commented out in `index.css`; shell buttons carry no `focus-visible:` class. | P0 | Keyboard / switch users cannot tell what is focused — the portal is not operable without a mouse. | Add one global `:focus-visible` ring via a token; keep it on custom buttons. | S |
| A11Y-02 | AssignmentView, ResultsView, AttendanceView, StudentFees, StudentExamsView | Zero `aria-*` / `role` attributes. Data rendered as `<div>` grids, not tables. | P0 | Screen-reader users get an undifferentiated wall of text on the screens that matter most — grades, dues, attendance. | Semantic `<table>` (or ARIA grid) via a shared `DataTable`; landmark roles + a page `<h1>` per view. | M |
| STATE-01 | DashboardHome | ~10 widgets each fetch independently and `return null` while loading / when empty. No unified skeleton, no page-level empty state. | P0 | Layout shift on every visit; a new student sees a blank dashboard and no next step. Reads as broken. | One batched summary request; one grid skeleton; a real first-run empty state. | M |
| FORM-01 | StudentOnboarding | `save()` wraps the API call in `catch (_) {}` and calls `onComplete()` regardless of outcome. | P0 | On any network failure the student's subject and learning-style choices are lost, but they're told setup succeeded. Silent data loss. | Surface the error, keep the modal open, offer retry; only advance on success. | S |
| A11Y-03 | Global — `index.html` | `document.title` is never set. Every tab, history entry and bookmark reads "EEC". | P0 | Multi-tab students can't tell pages apart; screen readers announce the same title on every route; browser history is useless. | A tiny `useDocumentTitle` hook or route→title map. | S |
| IA-01 | Sidebar — menu grouping | "Fees" under *Academics*; "Attendance" & "Syllabus Status" under *Schedule*; "Mastery Progress" & "Error Analysis" under *Wellness*. | P1 | Users can't predict where a feature lives, so they hunt. Finance and learning-analytics are hidden in the wrong buckets. | Regroup: Learn / School / Money / Messages / Wellbeing. | S |
| NAV-01 | Header — search | "Search" does `string.includes()` keyword matching then navigates. No result list. Rotating placeholder implies full search. | P1 | Typing anything specific produces an unpredictable jump. The feature sets an expectation it can't meet. | Build indexed search with a results panel, or relabel "Jump to…" and make it an explicit command palette. | M |
| DS-01 | Global — typography | 10+ font families loaded: Poppins, Zilla Slab, IBM Plex Sans/Mono (`index.html`) plus Playfair Display, Space Grotesk, Nunito, Geist, Inter (`App.css`) plus base `system-ui`. | P1 | Render-blocking font payload on first paint; no resolved body or heading face, so hierarchy is muddy and screen-dependent. | One display + one body + one mono. Delete the rest. Define a type scale as tokens. | M |
| DS-02 | Global — components | ShadCN `<Button>` ~34×; raw `<button className="…">` ~361×. Radix `<Dialog>` essentially unused; modals are hand-built `fixed inset-0` divs. | P1 | Button sizing, focus behaviour and modal semantics (focus trap, Esc, scroll-lock) are re-decided per screen and mostly wrong. | Adopt `<Button>` for nav/forms/dialogs; wrap Radix `Dialog` as one app `<Modal>` and migrate. | L |
| DS-03 | Global — colour | Sidebar/bottom-nav: amber. Header: indigo. Dashboard cards: indigo/violet/emerald/amber. Learning hub: cream + green + amber. CSS `--accent`: blue. `--tenant-primary`: `#2563eb`. Stray Vite `a { color:#646cff }` still live. | P1 | No colour carries consistent meaning; the product looks unbranded and unfinished; "primary action" has no single look. | Pick one accent (amber is the majority), define semantic tokens once, retire the rest. | M |
| A11Y-04 | Global — motion | No `prefers-reduced-motion` anywhere. Framer Motion route transition on every navigation (380 ms) plus card entrances, streak animations, onboarding slides, login-loader wave. | P1 | Users with vestibular sensitivity get unavoidable motion on every screen change. Also adds perceived latency. | One media query that zeroes Framer durations and disables non-essential animation. | S |
| A11Y-05 | LoginForm | Field errors render as `<p>⚠ {message}</p>` with no `role="alert"`; the ⚠ glyph has no text alternative. Password `<label>` has no `htmlFor` (username's does). | P1 | Screen-reader users submit, hear nothing, and don't know why login failed. | Wrap errors in a live region / `role="alert"`; associate every label; replace ⚠ with an icon + `sr-only` text. | S |
| NAV-02 | MobileBottomNav | Seven tabs (Home, Learning, Academics, Schedule, Messages, Profile, Logout). Labels truncate. Logout is a primary tab and fires `window.confirm('Do you want to logout?')`. | P1 | Cramped targets, a destructive action one mis-tap away, and an unstyled native dialog that breaks the visual model. | Five tabs (Home, Learn, School, Messages, More). Move Profile/Logout/Notifications into "More"; reuse the sidebar's logout modal. | M |
| NAV-03 | MobileBottomNav / Header | The notification bell lives only in the Header, which is `hidden lg:block` in chat view. Mobile bottom nav has no notifications entry. | P1 | On a phone, a student has no persistent way to see they have notifications while in several views. | Add a badge to a "More"/notifications tab, or keep a compact bell pinned on mobile. | S |
| STATE-02 | Global — feedback | SweetAlert2 loaded twice (npm + `<script src="cdn…/sweetalert2@11">`, unpinned). ~20 `Swal.fire` calls sit alongside a mounted `react-hot-toast` that most screens ignore. | P1 | Blocking modal popups for routine confirmations; inconsistent tone/placement; extra render-blocking payload; supply-chain exposure from the floating CDN version. | One rule: toast for confirmations/errors, `<Modal>` for destructive confirms, inline `role="alert"` for validation. Remove SweetAlert2. | M |
| A11Y-06 | Sidebar logout modal, StudentOnboarding, Swal replacements | Hand-built `fixed inset-0` modals: no `role="dialog"`/`aria-modal`, no labelled title, no focus trap, no focus restore, background stays tab-focusable, no Esc. | P1 | Keyboard focus escapes behind the modal; screen readers don't announce it as a dialog; Esc doesn't close it. | Route all of these through the Radix-based `<Modal>` from DS-02. | M |
| DASH-01 | DashboardHome | Two stacked "streak" cards — attendance streak and learning-event streak — both styled as "N day streak 🔥/⚡". | P2 | Looks like a bug or double-count; competes for attention with itself. | Merge into one streak card with two labelled metrics, or drop one. | S |
| DASH-02 | DashboardHome | No page `<h1>`. Grid declared `lg:grid-cols-4` but only three cards, so desktop always shows a gap (worse when cards `return null`). | P2 | No "you are here" anchor; ragged, unbalanced layout. | Add a `PageHeader` ("Dashboard" + date); match column count to card count, or use `auto-fit`. | S |
| TYPO-01 | ResultsView, AttendanceView, StudentFees, LearningHub, DashboardHome | Every screen styles its page heading differently: `text-2xl md:text-4xl` dark (Results — and a *second* `<h1>` at `text-4xl` in the same file), `text-xl` white-on-banner (Attendance), `text-3xl extrabold` Nunito + eyebrow (Learning), none (Dashboard). | P2 | No consistent sense of scale or place; the 36 px headings feel oversized for a dashboard context. | One `PageHeader` component: fixed size, weight and eyebrow pattern for every view. | M |
| TYPO-02 | Card titles portal-wide | `font-black` (900) applied at `text-sm` (14 px) for most card and widget titles. | P2 | Everything shouts, so nothing stands out; heavy weight at small size renders muddy. | `font-semibold` at a defined heading token; reserve black weight for true display sizes. | S |
| DS-04 | Global — radius & scrollbars | Border radius in heavy use: `rounded-lg`, `-xl`, `-2xl`, `-3xl`, `-md`, `-full`. Four bespoke custom-scrollbar classes. | P2 | Cards, modals, inputs and pills don't visually belong to the same kit. | Three radius tokens (input / card / pill); one scrollbar utility. | M |
| STATE-03 | AttendanceView + all dashboard widgets | Empty-state copy written fresh per screen: "No records match the current filter." / "No attendance records available." / "No attendance records found for this date." / "No achievements yet" / "No holiday on this day". Loading is a blocking centre-screen spinner on Attendance. | P2 | Inconsistent voice; no next action offered; full-screen spinner feels slower than a skeleton. | Shared `<EmptyState>` and `<Skeleton>` with one copy voice and an optional CTA. | M |
| MOBILE-01 | ResultsView, AttendanceView, RoutineView | Data tables, filter-chip rows and bar charts use `overflow-x-auto` on small screens. | P2 | Content technically "fits" but requires sideways scrolling to read a row — poor on the device most students use. | Card-per-row layout under ~640 px; wrap or scroll-snap the filter chips; responsive-height charts. | M |
| NAV-04 | Deep routes (`/student/smart-learning-courses/subject/…/topic/…`) | No breadcrumbs anywhere; navigation is a flat `setActiveView` model. | P2 | On nested pages there's no "where am I / step back up" cue beyond the browser back button. | A breadcrumb strip on nested views; a persistent "back to {parent}" on full-bleed readers. | M |
| COPY-01 | Sidebar / bottom nav labels | "The Wall", "Academic Alcove", "PTM Schedule", "My Paths" vs "Materials" (both "from your teachers"). | P2 | Cute or abbreviated names don't match what students call these things; two items sound identical. | Plain labels: "Class Wall", "Parent Meetings", "Teacher Paths" / "Study Materials". | S |
| DASH-03 | DashboardHome / QuickStats | Dead pet system (`TestPetButton` is `() => null`, never renders). QuickStats KPI cards use `hover:-translate-y-0.5` but aren't clickable. "change" badges show a delta with no baseline. | P3 | Dead code to maintain; a hover-lift that promises an interaction that isn't there; an unlabelled metric. | Delete the pet code; drop the hover-lift on non-interactive cards; add "vs last month" to the delta. | S |
| DS-05 | `index.css` / `index.html` | Leftover Vite scaffold: live `a { color:#646cff }`, commented-out button/h1/focus rules. Favicon declared `type="image/svg+xml"` but points at a `.png`. `<title>EEC</title>` is an acronym. | P3 | Bare links render an off-palette purple; small correctness rot. | Delete scaffold; fix favicon MIME; set a product name in `<title>`. | S |
| BUG-01 | Header | `className="flex items-center gap- 2 sm:gap-3"` — the space breaks `gap-2`, so the base gap silently doesn't apply. | P3 | Slightly tighter-than-intended spacing on the header's left cluster below `sm`. | One-character fix: `gap-2`. | S |
| DASH-04 | Dashboard shell | z-index values are ad hoc: tooltip `z-[999]`, logout modal `z-[200]`, header dropdowns / mobile nav / onboarding / sidebar all `z-50`, backdrops `z-40`. | P3 | Occasional stacking surprises when two overlays are open. | A small z-index scale as tokens (base / dropdown / sticky / overlay / modal / toast). | S |

---

## 4. Quick wins

Small changes, disproportionate return. All are **S** effort and none require touching a workflow.

| Change | Where | Gain |
|---|---|---|
| Restore a global `:focus-visible` ring using an accent token | `index.css` (replaces the commented-out block) | Makes the whole portal keyboard-operable for a sighted user |
| Set `document.title` per route (route→title map or 6-line hook) | new `useDocumentTitle`, called from `Dashboard` | Fixes multi-tab, history, bookmarks, screen-reader page identity |
| Add a `prefers-reduced-motion` media query zeroing Framer durations | `index.css` / a `MotionConfig` wrapper | Vestibular safety; removes ~380 ms perceived latency per navigation |
| Fix the onboarding silent failure — show error, keep modal open, retry | `StudentOnboarding.jsx` — `save()` | Students stop losing their subject / learning-style choices |
| Announce form errors — `role="alert"`, label association, icon + `sr-only` | `LoginForm.jsx` | Screen-reader users learn why login failed |
| Delete the CDN SweetAlert2 `<script>` and the dead pet code | `index.html` · `DashboardHome.jsx` | One less feedback system; smaller render-blocking payload; less dead code |
| Unify the logout confirm — reuse the sidebar's styled modal on mobile | `MobileBottomNav.jsx` | Consistent, on-brand destructive-action confirmation |
| Re-file "Fees" out of *Academics* and "Mastery / Error Analysis" out of *Wellness* | `Sidebar.jsx` — `MENU_ITEMS` | Removes the worst "where is it?" hunts before the full IA pass |

---

## 5. High-impact improvements

Larger investments, but each lifts the whole product rather than a single screen.

- **Collapse the type and colour stack to one system.** One display face, one body face, one mono; one accent plus semantic tokens; three radii. The single change that moves Consistency and Visual-quality most, and it makes every subsequent screen cheaper to build.
- **Give the dashboard one loading model and one empty state.** Batch the ~10 requests into a summary endpoint, render one skeleton for the grid, and design a genuine first-run screen that tells a new student what will appear and where to begin.
- **Adopt one modal and one toast, everywhere.** Wrap Radix `Dialog` as an app `<Modal>` (focus trap, Esc, scroll-lock, labelled title come free) and route every hand-built modal and every `Swal.fire` through it or through `toast`.
- **Re-architect the sidebar IA around what students look for** — Learn, School, Money, Messages, Wellbeing — and add breadcrumbs to nested routes.
- **Make search honest.** Either index the real entities (assignments, notices, results, people) with a results panel, or convert the box into a labelled command palette of destinations, which is what it already is.
- **Standardise the page header.** One `PageHeader` (title + optional eyebrow + date/context slot) on every view kills the per-screen heading drift and gives every page a "you are here".

---

## 6. Design-system problems

Fix these once, centrally — not screen by screen.

### Typography — no resolved type system
- 10+ families loaded across `index.html` and `App.css`; base is `system-ui` but 15 components hard-code `font-[Nunito]` and `Card` expects `font-heading`.
- No shared type scale; heading sizes range 20 px → 36 px with no rule.
- `font-black` at 14 px is the default card-title treatment.

### Colour — five accents, no semantics
- Amber (nav), indigo (header), rainbow (dashboard), cream+green (Learning), blue (`--accent`), `#2563eb` (`--tenant-primary`), `#646cff` (stray link).
- Success / warning / danger are re-picked per component (`text-red-500`, `text-rose-400`, `bg-red-400`…).
- Dark mode is disabled by comment, yet a Theme Customizer and `[data-theme]` CSS still ship — implying a feature that doesn't work.

### Components — primitives bypassed
- `<Button>` ~34 uses vs ~361 raw buttons; input/select/checkbox primitives imported 1–2× total.
- Radix `Dialog` present, ~unused; modals are hand-built and inaccessible.
- Button default height is 32 px (`h-8`); `lg` is 36 px — both under the 44 px touch minimum.

### Shape & feedback — no shared shells
- 6 border radii, 4 scrollbar styles, ad-hoc z-index.
- No `EmptyState`, `Skeleton`, `PageHeader`, or `DataTable` — every screen re-implements them with different copy and styling.
- 5 feedback channels (toast, SweetAlert2 ×2, `window.confirm`, custom modal, inline text).

---

## 7. Accessibility problems

Listed separately because this is the lowest score and the highest obligation — the users are minors, often on school-managed or assistive setups.

- **Keyboard focus is invisible** across the shell and most screens — the global focus outline is commented out and no per-component replacement exists. **(P0)**
- **Core screens have no semantics** — Assignments, Results, Attendance, Fees, Exams contain no landmarks, no heading hierarchy, and render tabular data as `<div>` grids. **(P0)**
- **No page titles** — `document.title` is never set, so every route is announced identically. **(P0)**
- **Errors aren't announced** — login validation and most form failures update visible text with no live region; onboarding failure is fully silent. **(P1)**
- **No `prefers-reduced-motion`** for a UI with a transition on every route change plus ambient animation. **(P1)**
- **Hand-built modals** lack `role="dialog"`, `aria-modal`, a labelled title, focus trapping, focus restoration, and Esc-to-close. **(P1)**
- **Touch targets below 44 px** — the Button component itself, plus many `p-1.5` / `p-2` icon buttons and collapsed sidebar items. **(P1)**
- **Small low-contrast text** — frequent `text-[10px]`/`text-[11px]` in `text-gray-400`, `text-white/75` on the amber gradient, `text-amber-700/70`; several likely below 4.5:1. **(P2)**
- **Charts have no text alternative** — Recharts on the dashboard and Results carry no summary or `aria`. **(P2)**
- **Icon-only controls with weak labels** — sidebar collapse/expand chevrons use `title` not `aria-label`; "Clear" doesn't say clear what. **(P3)**

---

## 8. Mobile problems

Responsiveness scored 6/10 — layouts do adapt and there's real mobile-specific navigation — but these cost the most on a phone.

- **Seven-item bottom nav** with truncating labels and Logout as a tab. **(P1)**
- **No persistent notifications on mobile** — the bell is in a header that hides in chat and some other views. **(P1)**
- **Horizontal scrolling to read data** — Results chart, Attendance subject table and filter chips, Routine table all `overflow-x-auto` below `sm`. **(P2)**
- **Blocking full-screen spinner** on Attendance ("Loading your attendance…") instead of a skeleton. **(P2)**
- **Dashboard heading absent** and the 4-column grid holds 3 cards — more noticeable on tablet where the empty column is wide. **(P2)**
- **Sidebar and bottom nav disagree** on which learning views count as "active", so the highlighted tab can be wrong after a deep link. **(P3)**

---

## 9. Workflow problems

Friction scored **1–10, where 1 is excellent and 10 needs a redesign**.

### Log in → land on the dashboard — friction **4 / 10**
- **Friction:** Clean form and validation, but the tab reads "EEC", there's no visible focus, and the dashboard visibly reflows for a second or two as ~10 cards resolve independently.
- **Fix:** Page titles; focus ring; one batched dashboard request + one skeleton.
- **Gain:** The first screen after login feels finished instead of assembling itself.

### First-run onboarding (subjects + learning style) — friction **5 / 10**
- **Friction:** Good 3-step modal, but the subject list is a hard-coded generic set (not the student's enrolled subjects), a save error is swallowed, and there's no way to revisit the choices later.
- **Fix:** Populate subjects from enrolment; surface save errors + retry; add "Learning preferences" to Profile.
- **Gain:** The personalisation the tutor depends on is actually captured and editable.

### Check today's homework — friction **3 / 10**
- **Friction:** Two clicks (Academics → Assignments), works well. The "Academics" group is a reasonable guess.
- **Fix:** Minor — a homework count on the dashboard and the nav item.
- **Gain:** Turns a navigate-and-scan into an at-a-glance check.

### Pay fees — friction **6 / 10**
- **Friction:** "Fees" is filed under **Academics** — a payment task hidden in a study menu. Once found, the flow (invoice list → Razorpay) is fine, though errors surface as a plain inline string.
- **Fix:** Promote Fees to its own top-level "Money" group; standard error toast; a dues badge when something is overdue.
- **Gain:** Parents and students stop hunting for the one task they're time-pressured on.

### Ask the AI tutor a question — friction **3 / 10**
- **Friction:** The Learning hub is the best-built screen — clear tabs with real semantics, "continue where you left off", one click to the tutor. Its cream-and-green identity just doesn't match the rest of the portal.
- **Fix:** Keep the interaction; bring the palette and type into the shared system.
- **Gain:** The flagship feature stops looking like a different app.

### Check attendance — friction **5 / 10**
- **Friction:** Filed under **Schedule** (students think "records", not "schedule"). A full-screen blocking spinner while it loads. The 1,100-line screen also renders lesson-plan status and study materials — three unrelated jobs.
- **Fix:** Move to a "School" group; skeleton instead of spinner; split materials/lesson-plans out.
- **Gain:** A focused, faster-feeling screen that's where students expect it.

### Find "why am I weak in this subject" (Mastery / Error Analysis) — friction **7 / 10**
- **Friction:** Both live under **Wellness**, next to "Emotional Wellbeing" and "Health Record". A student trying to improve a grade has no reason to look there.
- **Fix:** Move both into the Learn group; surface a "weakest topic" link from the dashboard mastery card.
- **Gain:** The portal's best study-guidance tools become discoverable.

### Use the global search — friction **8 / 10**
- **Friction:** It isn't search. It matches a handful of keywords and navigates; anything specific produces an unpredictable jump to a filtered list. The rotating placeholder actively promises more than it delivers.
- **Fix:** Build indexed search with a results panel, or relabel as "Jump to…" and present it honestly as a destination picker.
- **Gain:** Either a real power feature, or an honest one that stops eroding trust.

---

## 10. Implementation plan

Sequenced so early phases don't block on later ones. Phases 1–2 are prerequisites for doing 3–4 cleanly.

### Phase 1 — Quick wins
*Days, not weeks · no workflow changes · mostly S*

- **Global `:focus-visible` ring** from an accent token — restores keyboard operability. `(S)`
- **Per-route `document.title`** via a small hook — fixes tabs, history, screen-reader identity. `(S)`
- **`prefers-reduced-motion` media query** zeroing Framer durations. `(S)`
- **Onboarding save** — surface errors, keep modal open, retry. `(S)`
- **Login errors** — `role="alert"`, label association, icon + `sr-only`. `(S)`
- **Remove** the CDN SweetAlert2 `<script>` and the dead pet code; fix the `gap- 2` typo and favicon MIME. `(S)`
- **Unify logout** — reuse the sidebar modal on mobile. `(S)`
- **Re-file** Fees and Mastery/Error-Analysis into sensible menu groups. `(S)`

### Phase 2 — Design-system consolidation
*The highest-leverage work · S–L per token group*

- **Typography** — one display + one body + one mono; delete the other ~8; publish a 6-step scale as tokens; retire `font-black` card titles. `(M)`
- **Colour** — one accent (amber), semantic tokens for success/warning/danger/info, ≤2 neutral ramps; delete `--tenant-primary` / stray link colour unless tenant theming ships. `(M)`
- **Radius & z-index** — 3 radius tokens, one z-index scale, one scrollbar utility. `(M)`
- **Buttons** — adopt `<Button>` (default `h-9`, `lg` `h-11` for touch); migrate nav, forms and dialogs first. `(L)`
- **One `<Modal>`** wrapping Radix `Dialog`; migrate every hand-built modal and `Swal.fire`. Remove SweetAlert2. `(L)`
- **Shared shells** — `<PageHeader>`, `<EmptyState>`, `<Skeleton>`, one empty-state copy voice. `(M)`

### Phase 3 — Navigation & workflows
*Builds on Phase 2 shells · M–L*

- **Re-group the sidebar** — Learn / School / Money / Messages / Wellbeing; plain-language labels. `(M)`
- **Mobile bottom nav → 5 tabs** (Home, Learn, School, Messages, More); Profile/Logout/Notifications into "More" with a notification badge. `(M)`
- **Breadcrumbs** on nested routes; a persistent "back to {parent}" on full-bleed readers. `(M)`
- **Search** — indexed results panel, or an honest "Jump to…" command palette. `(M–L)`
- **Dashboard** — `PageHeader` + date, one grid skeleton, one merged streak card, a real first-run empty state. `(M)`
- **Standardise page headers** across all ~40 sections. `(M)`

### Phase 4 — Structural
*Only where the payoff justifies the disruption · L*

- **Shared `<DataTable>`** — semantic `<table>`, sort, sticky header, card-per-row on mobile — for Results, Attendance, Assignments, Fees. `(L)`
- **Batched dashboard endpoint** — one `/student-dashboard/summary` instead of ~10 parallel calls. `(M)`
- **Reconcile the per-screen identities** (Routine glassmorphism, Learning cream) into the unified system, or make them deliberate consistent "modes". `(L)`
- **Decide dark mode** — finish it (audit components, wire the Theme Customizer) or remove the Customizer and `[data-theme]` CSS so it stops implying a feature. `(L)`
- **Split oversized screens** — Attendance (1.1k lines) and StudentChat (2k lines) each do several jobs; separate the concerns. `(L)`

---

## What not to do

Don't rebuild the UI wholesale — the component architecture and routing are sound, and the Learning hub proves the team can build a good screen. Don't change the stack. Don't add dashboards, charts, or AI that no decision depends on. The gap here is **coherence and accessibility**, and both are reachable by consolidation, not reinvention.
