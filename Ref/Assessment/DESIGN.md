---
name: Smart Teaching System
colors:
  surface: '#f8f9ff'
  surface-dim: '#d1dbec'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dfe9fa'
  surface-container-highest: '#d9e3f4'
  on-surface: '#121c28'
  on-surface-variant: '#444653'
  inverse-surface: '#27313e'
  inverse-on-surface: '#eaf1ff'
  outline: '#757684'
  outline-variant: '#c4c5d5'
  surface-tint: '#3755c3'
  primary: '#00288e'
  on-primary: '#ffffff'
  primary-container: '#1e40af'
  on-primary-container: '#a8b8ff'
  inverse-primary: '#b8c4ff'
  secondary: '#006c4a'
  on-secondary: '#ffffff'
  secondary-container: '#82f5c1'
  on-secondary-container: '#00714e'
  tertiary: '#611e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#872d00'
  on-tertiary-container: '#ffa583'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#173bab'
  secondary-fixed: '#85f8c4'
  secondary-fixed-dim: '#68dba9'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb59a'
  on-tertiary-fixed: '#380d00'
  on-tertiary-fixed-variant: '#802a00'
  background: '#f8f9ff'
  on-background: '#121c28'
  surface-variant: '#d9e3f4'
typography:
  h1:
    fontFamily: Lexend
    fontSize: 2.25rem
    fontWeight: '600'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  h2:
    fontFamily: Lexend
    fontSize: 1.875rem
    fontWeight: '600'
    lineHeight: 2.25rem
    letterSpacing: -0.01em
  h3:
    fontFamily: Lexend
    fontSize: 1.5rem
    fontWeight: '500'
    lineHeight: 2rem
  body-lg:
    fontFamily: Lexend
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
  body-md:
    fontFamily: Lexend
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
  label-md:
    fontFamily: Lexend
    fontSize: 0.875rem
    fontWeight: '500'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Lexend
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: 1rem
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 0.5rem
  sm: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  gutter: 1.5rem
  margin: 2rem
  max_width: 1440px
---

## Brand & Style

The design system is anchored in the principles of **Corporate Modernism** with a focus on institutional reliability. It is designed to facilitate high-stakes educational management while reducing cognitive load for educators. The aesthetic is clean and structured, favoring clarity over decoration. 

The target audience consists of educators and academic administrators who require a tool that feels like a professional extension of their workflow. The UI evokes a sense of stability and order through generous whitespace, a strictly controlled color palette, and a logical information hierarchy. Every element is intentional, ensuring that the transition from lesson planning to assessment creation feels seamless and authoritative.

## Colors

The color strategy for this design system prioritizes functional signaling and trust. 

- **Primary Blue:** A deep, authoritative Indigo-Blue used for core navigation, primary actions, and branding. It represents the "Trustworthy" pillar of the portal.
- **Success Green:** A refined emerald used exclusively for completed assessments, successful file uploads, and positive progress indicators.
- **Warning Amber:** A high-visibility orange-tinted amber for pending actions, missed deadlines, or system alerts.
- **Neutrals:** A sophisticated range of cool grays (Slate/Gray) are used for text and borders to maintain a professional, low-distraction environment.

The default mode is light to ensure maximum legibility during daytime desktop use, utilizing a soft off-white background to reduce eye strain during long sessions.

## Typography

This design system utilizes **Lexend** across all levels. Lexend was specifically engineered to reduce visual stress and improve reading proficiency, making it the ideal choice for an educational portal where users process large amounts of textual data.

- **Headlines:** Use tighter letter spacing and medium-to-semibold weights to establish clear section anchors.
- **Body Text:** Set with generous line heights to ensure readability in long-form content like course descriptions or student feedback.
- **Labels:** Utilized for metadata and interface controls, often employing semibold weights to distinguish interactive elements from static content.

## Layout & Spacing

The layout follows a **Fixed-Width Grid** model optimized for desktop environments. The content is centered within a 1440px container to prevent excessive line lengths on ultra-wide monitors.

- **Grid System:** A 12-column grid is used for dashboard layouts, allowing for flexible card arrangements (3-column, 4-column, or sidebar+content splits).
- **Rhythm:** A 4px baseline grid ensures vertical consistency. Spacing between related components (like a label and an input) uses `xs`, while spacing between major sections uses `lg` or `xl`.
- **Hierarchy:** Nested lists use a consistent 1.5rem indentation per level to provide a clear visual "tree" of educational content and curricula.

## Elevation & Depth

To maintain a modern and organized feel, this design system uses **Tonal Layers** supplemented by **Ambient Shadows**. Depth is used sparingly to indicate interactivity and importance.

1.  **Level 0 (Flat):** The main canvas background.
2.  **Level 1 (Raised):** Cards and main content containers use a subtle 1px border (`#E5E7EB`) and a soft, highly diffused shadow to appear slightly lifted from the background.
3.  **Level 2 (Interactive):** Elements that are being hovered or dragged (like an assessment question card) gain a more pronounced shadow with a slight blue tint from the primary color.
4.  **Level 3 (Overlay):** Modals for file uploads or complex assessment settings use high-contrast backdrops (40% opacity black) and significant elevation to focus the user’s attention.

## Shapes

The shape language is **Soft**, striking a balance between the rigidity of traditional academic software and the friendliness of modern SaaS.

- **Components:** Standard buttons, input fields, and small cards use a 0.25rem (`rounded`) radius. 
- **Containers:** Larger structural elements like main content cards and modals use a 0.5rem (`rounded-lg`) radius to soften the overall appearance of the portal.
- **Indicators:** Status chips and notification badges utilize a full pill-shape to distinguish them from interactive buttons.

## Components

The component library focuses on high-utility tools for educators:

- **Structured Cards:** Used for course modules. They include a header for the title, a body for metadata (student count, date), and a dedicated footer for secondary actions.
- **Nested Lists:** Used for curriculum mapping. These feature collapsible chevrons on the left and drag-handle icons on the right for reordering lessons.
- **Action Buttons:** 
    - *Primary:* Solid Indigo-Blue for "Create Assessment" or "Publish."
    - *Ghost/Secondary:* Outlined buttons for "Cancel" or "Save Draft."
- **File Upload Zones:** Drag-and-drop areas defined by a dashed Indigo-Blue border, featuring a central icon and a primary button trigger.
- **Assessment Creation Inputs:** Specialized input groups that combine a question text field with nested multiple-choice options, using a vertical connector line to show relationship.
- **Status Chips:** Small, pill-shaped markers (e.g., "Graded," "Pending") using low-saturation background tints with high-saturation text for maximum accessibility.