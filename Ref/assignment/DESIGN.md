---
name: Kinetic Campus
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
  secondary: '#006591'
  on-secondary: '#ffffff'
  secondary-container: '#39b8fd'
  on-secondary-container: '#004666'
  tertiary: '#684000'
  on-tertiary: '#ffffff'
  tertiary-container: '#885500'
  on-tertiary-container: '#ffd4a4'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#0f0069'
  on-primary-fixed-variant: '#3323cc'
  secondary-fixed: '#c9e6ff'
  secondary-fixed-dim: '#89ceff'
  on-secondary-fixed: '#001e2f'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.75rem
    fontWeight: '700'
    lineHeight: 2.25rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.375rem
    fontWeight: '600'
    lineHeight: 1.875rem
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '600'
    lineHeight: 1.5rem
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
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: 0.875rem
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
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an encouraging, intuitive, and mentally spacious digital classroom ecosystem tailored specifically for upper primary and middle school learners (Class 5 / Ages 9–11). At this developmental milestone, students require an interface that respects their growing autonomy while eliminating visual anxiety, cognitive clutter, and administrative friction. 

The aesthetic is a hybrid of **Modern Editorial Simplicity** and **Soft Tactile Warmth**:
- **Clarity without Infantization:** Replaces childish novelty shapes with structured, polished cards, spacious touch targets, and balanced typographic hierarchy.
- **Supportive Focus:** Eliminates loud banners, high-frequency micro-interactions, and aggressive streaks in favor of calm progress states, digestible assignment cards, and predictable navigation anchors.
- **Approachable Craft:** Softly rounded surface boundaries, warm tinted neutrals, and clear ambient lighting create an inviting workspace that feels like a well-organized physical study desk.

## Colors

The color palette centers on calming, confidence-inspiring indigo hues paired with clear environmental accents that assist scanning and task classification.

- **Primary (`#4f46e5` / `#6366f1`):** Serves as the primary brand signature and key interaction anchor (main actions, current active navigational tabs, primary status indicators).
- **Secondary (`#0ea5e9`):** Soft Sky Blue used for informational badges, active subject tracks (e.g., Science, Reading), and interactive resource links.
- **Tertiary (`#f59e0b`):** Playful Warm Amber reserved for progress alerts, due-soon reminders, and reward/achievement milestones without creating panic.
- **Supporting Accent - Emerald (`#10b981`):** Applied exclusively to completed tasks, submitted assignments, and positive reinforcement states.
- **Canvas & Neutrals:** Built on layered cool-warm tones (`#f8fafc` outer canvas, `#ffffff` card surfaces, `#f1f5f9` inset panels, and `#0f172a` high-contrast typography) to guarantee WCAG AAA legibility for developing readers.

## Typography

Typographic hierarchy bridges structural legibility with approachable warmth by pairing **Plus Jakarta Sans** for headers, wayfinding elements, and action triggers with **Inter** for instructional long-form text, activity prompts, and assignments.

- **Readability Rules:** Line lengths for reading prompts must never exceed 65 characters (`~40rem`). Generous line-heights on `body-md` and `body-lg` prevent line skipping during self-paced reading tasks.
- **Scannability:** Subject titles and timetable headings use `headline-sm` and `headline-md` in semi-bold and bold weights to help students quickly orient between multiple subjects (Math, Social Studies, Art).

## Layout & Spacing

The portal employs a responsive layout anchored by a fixed left navigation sidebar on desktop (240px wide) transitioning into an adaptive bottom navigation bar on mobile viewports.

- **Desktop Grid:** A 12-column fluid grid system contained within a maximum width of `1440px`. Column gutters remain fixed at `1.5rem` (`24px`) with outer canvas margins of `2rem` (`32px`).
- **Tablet / Chromebook View:** The primary student computing vehicle. The left rail condenses to an icon-labeled dock (72px), and content expands dynamically across an 8-column layout.
- **Mobile View:** Single-column stacked layout with minimum touch target allowances of `48px` by `48px` across all interactive triggers. Canvas margins scale down to `1rem` (`16px`).

## Elevation & Depth

This system avoids dark or dramatic shadows, relying on layered surface tones and soft, tinted ambient illumination to guide student focus.

- **Base Layer (Canvas):** Tone `#f8fafc` establishes the primary backdrop.
- **Surface Layer (Cards & Panels):** Pure `#ffffff` surfaces set against the canvas with an ultra-soft border (`1px solid #e2e8f0`) and subtle Indigo-tinted shadow: `0 2px 8px -2px rgba(79, 70, 229, 0.04), 0 1px 4px -1px rgba(15, 23, 42, 0.03)`.
- **Interactive Hover State:** Surfaces rise smoothly using a slightly elevated glow: `0 8px 20px -4px rgba(79, 70, 229, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)`.
- **Modal / Flyout Layer:** Pure `#ffffff` framed with a distinct border and deep diffused shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.

## Shapes

The interface embraces a gentle, approachable curvature profile (`roundedness: 2`). Standard containers, cards, and input fields use `0.5rem` (`8px`) to `1rem` (`16px`) corner radiuses, striking a balance between structure and playfulness. Floating action chips and status badges utilize complete pill radii (`9999px`) to immediately signal interactivity and progress.

## Components

### Buttons
- **Primary Action:** Solid `#4f46e5` background, `#ffffff` text, `0.75rem` vertical by `1.25rem` horizontal padding, `0.75rem` border radius (`rounded-md`). Displays a subtle translateY hover micro-interaction.
- **Secondary Action:** `#ffffff` surface, `1.5px solid #e2e8f0`, `#334155` text. On hover, transitions to `#f8fafc` with border color shifting to `#cbd5e1`.
- **Ghost/Tertiary:** Zero background, `#4f46e5` text, used exclusively for secondary link destinations like "View all homework".

### Cards
- **Assignment & Subject Cards:** White background `#ffffff`, `1px solid #e2e8f0`, `1rem` (`16px`) inner padding, `1rem` (`16px`) corner radius. Subject cards feature a 4px colored accent strip along the top or left border designating the class (e.g., Sky Blue for Science, Indigo for Math).

### Chips & Badges
- **Status Tags:** Pill-shaped (`rounded-full`), `0.25rem` vertical by `0.75rem` horizontal padding. 
  - *Due Soon:* `#fef3c7` background with `#b45309` text.
  - *Completed:* `#d1fae5` background with `#065f46` text.
  - *Subject Labels:* `#e0e7ff` background with `#3730a3` text.

### Form Inputs & Checkboxes
- **Text Inputs:** `#ffffff` background, `1.5px solid #cbd5e1`, `0.75rem` padding, `0.5rem` radius. Focus ring produces a clear 3px outer ring tinted `#6366f1` at 20% opacity without obscuring placeholder hints.
- **Checkboxes & Radios:** Sized at `1.25rem` x `1.25rem` with a `0.375rem` radius for easy touch-selection. Checked states trigger a bounce animation with a bold white checkmark against solid Indigo `#4f46e5`.

### Navigation & Lists
- **Sidebar Navigation:** Distinct vertical rail featuring uncluttered icon-label pairs. Active tabs display a pill-shaped `#eef2ff` container background and `#4338ca` text weight.
- **Daily Schedule List:** Modular, horizontal strip layout separating time-blocks cleanly with `#f1f5f9` dividing lines and prominent subject icons.

### Student Progress Indicator
- **Progress Bars:** Continuous track with a `#e2e8f0` trough and an animated, rounded fill utilizing single or gradient fills (`#6366f1` to `#0ea5e9`), paired with a bold text percentage label in `label-sm`.