---
name: Clarity Luminary
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#464555'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#777587'
  outline-variant: '#c7c4d8'
  surface-tint: '#4d44e3'
  primary: '#3525cd'
  on-primary: '#ffffff'
  primary-container: '#4f46e5'
  on-primary-container: '#dad7ff'
  inverse-primary: '#c3c0ff'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#003fac'
  on-tertiary: '#ffffff'
  tertiary-container: '#0555dd'
  on-tertiary-container: '#d1daff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#dbe1ff'
  tertiary-fixed-dim: '#b4c5ff'
  on-tertiary-fixed: '#00174b'
  on-tertiary-fixed-variant: '#003ea8'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 3rem
    fontWeight: '700'
    lineHeight: 3.5rem
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  title-md:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
    letterSpacing: -0.005em
  body-lg:
    fontFamily: Inter
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
  body-md:
    fontFamily: Inter
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  body-sm:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
  label-md:
    fontFamily: Inter
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  gutter-lg: 2rem
  margin: 2rem
  margin-sm: 1rem
  margin-lg: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The brand identity centers on intellectual clarity, calm momentum, and effortless mastery. Built specifically for high-retention educational SaaS dashboards, it eliminates extraneous visual noise, directing cognitive focus entirely toward educational metrics, course material, and learning progression.

The visual style is **Corporate / Modern Minimalist** infused with refined editorial structure:
- **Atmosphere:** Distraction-free, airy, orderly, and deeply focused.
- **Personality:** Analytical, dependable, empowering, and modern.
- **Visual Tenets:** High-contrast neutral hierarchy, structured card surfaces, crisp division through whisper-thin border lines, and deliberate micro-moments of color for feedback and goal orientation.

## Colors

The color system establishes a rigorous hierarchy designed to preserve focus during extended study and data evaluation sessions.

- **Primary Canvas & Surfaces:** The primary background rests on a slate-white foundation (`#F8FAFC`). Elevated dashboard cards and operational workspaces adopt pure white (`#FFFFFF`) to achieve effortless separation from the canvas. Subdued interactive wells and progress tracks utilize `#F1F5F9`.
- **Primary Indigo (`#4F46E5`):** Reserved for high-value user triggers: primary action buttons, active navigation markers, module completion checkpoints, and focused selection states.
- **Secondary Emerald (`#10B981`):** Applied functionally to represent mastery, passing grades, positive pacing, trend growth, and verified achievements.
- **Tertiary Blue (`#2563EB`):** Leveraged for secondary navigational cues, links, and informational status banners.
- **Neutral Structure:** 
  - Slate Dark (`#0F172A`) commands all primary typography and critical data metrics for peerless contrast.
  - Slate Muted (`#64748B`) establishes secondary body copy, meta timestamps, and helper text.
  - Border Slate (`#E2E8F0`) defines thin 1px containment borders on cards, table headers, and form fields.

## Typography

Typography relies entirely on **Inter** to ensure maximum legibility at high data densities. Tracking is slightly tightened on large headings (`-0.02em` to `-0.025em`) to impart an editorial, modern SaaS character, while small labels and metadata utilize positive tracking (`0.01em` to `0.04em`) to ensure instant legibility at smaller scales.

- **Numerics & Analytics:** Always apply tabular figures (`font-variant-numeric: tabular-nums`) for grades, completion rates, time logs, and statistical leaderboards.
- **Hierarchy Rules:** Never use bold weights for body copy longer than two sentences. Use color shifting (`#0F172A` to `#64748B`) rather than scale changes to demarcate secondary metadata.

## Layout & Spacing

The design system employs a **fluid 12-column responsive grid** anchored within a maximum dashboard container width of `1440px`.

- **Desktop (1024px+):** 12 columns, `margin-lg` (48px outer canvas margin), `gutter` (24px). The dashboard navigation resides in a fixed 260px left sidebar, with main learning analytics flowing across the remaining fluid workspace.
- **Tablet (768px - 1023px):** 8 columns, `margin` (32px), `gutter-sm` (16px). Left navigation collapses to an icon rail (72px) or a top app bar; cards reflow into 4-column or 8-column spans.
- **Mobile (<768px):** 4 columns, `margin-sm` (16px), `gutter-sm` (16px). All dashboard modules stack to full-width (4-column) blocks, and horizontal scrolling is constrained exclusively to structured metric ribbons and filter pills.
- **Internal Card Rhythm:** Use `space-md` (16px) for compact widgets and `space-lg` (24px) for primary instructional modules.

## Elevation & Depth

Visual hierarchy leverages crisp surface layering and ambient, low-opacity slate shadows rather than heavy drop-shadows. This preserves a flat, modern architectural profile while distinguishing active floating states.

- **Base Layer (Elevation 0):** Background canvas (`#F8FAFC`). No shadow.
- **Resting Layer (Elevation 1):** Interactive cards, metrics tiles, lesson lists (`#FFFFFF`). Boundary established by a 1px solid border (`#E2E8F0`) paired with an ultra-subtle ambient shadow: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.02)`.
- **Raised Layer (Elevation 2):** Card hover states, dropdown menus, context tooltips. 1px border (`#E2E8F0`), with an expanded soft blur: `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
- **Overlay Layer (Elevation 3):** Modal dialogues, assignment submission drawers, search command palettes (`#FFFFFF`). Supported by a deep ambient blur: `0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)` over a semi-opaque backdrop scrim (`rgba(15, 23, 42, 0.4)` with 4px backdrop blur).

## Shapes

The design system maintains a balanced, friendly geometric discipline using **Rounded (level 2)** shaping.

- **Form Controls & Buttons:** Set to standard roundedness (`0.5rem` / 8px) for buttons, text fields, search bars, and dropdown toggles.
- **Containers & Course Cards:** Set to `rounded-lg` (`1rem` / 16px) for inner metric panels, and `rounded-xl` (`1.5rem` / 24px) for major dashboard summary containers and modal surfaces.
- **Status Tags & Micro-pills:** Fully rounded pill shapes (`9999px`) are reserved exclusively for badges, progress pills, active filters, and avatar frames.

## Components

### Buttons
- **Primary:** Rich indigo background (`#4F46E5`), crisp white text (`#FFFFFF`), `0.5rem` border radius, padding `0.625rem 1.25rem`. Hover shifts to `#4338CA`. Active state scales subtly down (`scale(0.98)`).
- **Secondary:** Surface white (`#FFFFFF`), 1px border (`#E2E8F0`), text `#0F172A`. Hover transitions background to `#F8FAFC` and border to `#CBD5E1`.
- **Ghost:** Transparent background, text `#64748B`. Hover renders text `#0F172A` with `#F1F5F9` background.

### Cards & Metric Tiles
- Elevated white container (`#FFFFFF`), `1px solid #E2E8F0`, `rounded-xl` (16px border-radius), interior padding `1.5rem`.
- Stat widgets feature a 2-column header: label (`label-sm` in `#64748B`), an optional subtle contextual icon container (`#F1F5F9`, 32x32px, `rounded-md`), and a prominent numeric display (`headline-md` in `#0F172A`).

### Progress Bars & Learning Indicators
- **Linear Track:** 8px height, rounded full (`9999px`), background `#F1F5F9`.
- **Fill Indicator:** Secondary emerald (`#10B981`) for on-track or completed goals; primary indigo (`#4F46E5`) for in-progress modules. Smooth transition animations (300ms ease-out).

### Chips & Badges
- Compact height (24px to 28px), pill shape (`rounded-full`), padding `0.25rem 0.75rem`, font `label-sm`.
- **Success Badge:** `#ECFDF5` background with `#065F46` label and a 6px `#10B981` dot.
- **Active Filter:** Indigo tint `#EEF2FF` with `#4338CA` text and interactive 12px dismiss icon.

### Form Inputs & Search
- Surface `#FFFFFF`, 1px border (`#E2E8F0`), `rounded-md` (8px). Typography `body-sm` (`#0F172A`), placeholder `#94A3B8`.
- Focus state: Border transitions to `#4F46E5` accompanied by an indigo ring glow (`box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15)`).

### Checkboxes & Radios
- Box size 18x18px, border 1.5px `#CBD5E1`, background `#FFFFFF`, rounded 4px (checkboxes) or 50% (radios).
- Checked state: `#4F46E5` background with a crisp white checkmark/dot and an absence of outer borders.

### Course Module Lists
- Structured row-based list items separated by `1px solid #F1F5F9` divider lines.
- Left-aligned status indicator or completion ring, module title (`title-md`), duration indicator (`body-sm` `#64748B`), and a right-aligned tertiary action button or chevron.