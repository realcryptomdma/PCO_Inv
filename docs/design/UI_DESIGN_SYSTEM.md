# UI Design System

This document codifies the visual language, component patterns, and interaction guidelines for the PCO Inventory System. All implementations MUST follow these standards.

---

## Design Philosophy

### Core Principles

1. **Mobile-First** - Design for 375px width, enhance for larger screens
2. **Field-Ready** - High contrast, large touch targets, works in bright sunlight
3. **Offline-Aware** - Always show sync status, never hide failed operations
4. **Role-Appropriate** - Show only what the user can act on
5. **Forgiving** - Confirm destructive actions, allow undo where possible

### Visual Hierarchy

```
1. Actions (what can I do?)      → Primary buttons, FABs
2. Status (what's happening?)    → Badges, indicators, toasts
3. Data (what do I need to know?) → Cards, lists, values
4. Navigation (where can I go?)  → Headers, bottom nav, tabs
5. Context (where am I?)         → Breadcrumbs, screen titles
```

---

## Color System

### Semantic Colors

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--color-surface` | #F9FAFB (gray-50) | #111827 (gray-900) | Page background |
| `--color-surface-card` | #FFFFFF | #1F2937 (gray-800) | Card backgrounds |
| `--color-surface-header` | #334155 (slate-700) | #111827 (gray-900) | App header |
| `--color-surface-input` | #FFFFFF | #374151 (gray-700) | Form inputs |
| `--color-border` | #E5E7EB (gray-200) | #374151 (gray-700) | Borders/dividers |
| `--color-text-primary` | #111827 (gray-900) | #FFFFFF | Primary text |
| `--color-text-secondary` | #4B5563 (gray-600) | #D1D5DB (gray-300) | Labels, helpers |
| `--color-text-muted` | #6B7280 (gray-500) | #9CA3AF (gray-400) | Hints, timestamps |

### Action Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | #059669 (emerald-600) | Primary actions, success |
| `--color-primary-hover` | #047857 (emerald-700) | Hover state |
| `--color-danger` | #DC2626 (red-600) | Destructive actions |
| `--color-danger-hover` | #B91C1C (red-700) | Hover state |
| `--color-warning` | #F59E0B (amber-500) | Warnings, pending |
| `--color-info` | #3B82F6 (blue-500) | Info states |

### Role Colors

| Role | Primary | Light BG | Dark BG |
|------|---------|----------|---------|
| Technician | emerald-600 | emerald-50 | emerald-800 |
| Warehouse | blue-600 | blue-50 | blue-800 |
| Manager | purple-600 | purple-50 | purple-800 |
| Admin | slate-600 | slate-50 | slate-800 |

### Status Colors

| Status | Badge BG (Light) | Badge Text (Light) | Badge BG (Dark) | Badge Text (Dark) |
|--------|------------------|--------------------|-----------------|--------------------|
| pending_approval | amber-100 | amber-700 | amber-900 | amber-200 |
| approved | blue-100 | blue-700 | blue-900 | blue-200 |
| denied | red-100 | red-700 | red-900 | red-200 |
| ready_for_pickup | emerald-100 | emerald-700 | emerald-900 | emerald-200 |
| pending_acknowledgment | purple-100 | purple-700 | purple-900 | purple-200 |
| completed | gray-100 | gray-600 | gray-700 | gray-300 |
| conflicted | orange-100 | orange-700 | orange-900 | orange-200 |
| syncing | cyan-100 | cyan-700 | cyan-900 | cyan-200 |

### Category Colors

| Category | Color | Tailwind Class |
|----------|-------|----------------|
| ant-bait | Amber | bg-amber-500 |
| roach-bait | Orange | bg-orange-500 |
| rodent-bait | Gray | bg-gray-500 |
| repellent | Blue | bg-blue-500 |
| non-repellent | Purple | bg-purple-500 |
| termiticide | Red | bg-red-500 |
| igr | Green | bg-green-500 |
| general | Slate | bg-slate-500 |

---

## Typography

### Font Stack

```css
--font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
             "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
--font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### Type Scale

| Element | Size | Weight | Line Height | Usage |
|---------|------|--------|-------------|-------|
| Display | 2rem (32px) | 700 | 1.2 | Hero numbers, KPIs |
| H1 | 1.5rem (24px) | 600 | 1.3 | Screen titles |
| H2 | 1.25rem (20px) | 600 | 1.4 | Section headers |
| H3 | 1.125rem (18px) | 600 | 1.4 | Card titles |
| Body | 1rem (16px) | 400 | 1.5 | Default text |
| Body Small | 0.875rem (14px) | 400 | 1.4 | Secondary text |
| Caption | 0.75rem (12px) | 500 | 1.4 | Labels, badges |
| Overline | 0.75rem (12px) | 600 | 1.2 | Section labels (uppercase) |

### Text Styles

```css
/* Primary content */
.text-primary { @apply text-gray-900 dark:text-white; }

/* Secondary labels */
.text-secondary { @apply text-gray-600 dark:text-gray-300; }

/* Muted hints */
.text-muted { @apply text-gray-500 dark:text-gray-400; }

/* Truncation */
.truncate { @apply overflow-hidden text-ellipsis whitespace-nowrap; }
```

---

## Spacing System

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| space-0 | 0 | Reset |
| space-1 | 0.25rem (4px) | Tight gaps |
| space-2 | 0.5rem (8px) | Icon gaps |
| space-3 | 0.75rem (12px) | Internal padding |
| space-4 | 1rem (16px) | Standard padding |
| space-5 | 1.25rem (20px) | Large padding |
| space-6 | 1.5rem (24px) | Section gaps |
| space-8 | 2rem (32px) | Major sections |

### Common Patterns

```css
/* Card padding */
.card { @apply p-4; }

/* List item padding */
.list-item { @apply px-4 py-3; }

/* Section gap */
.section { @apply mb-6; }

/* Form field gap */
.form-field { @apply mb-4; }
```

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| rounded-none | 0 | Sharp corners |
| rounded | 0.25rem (4px) | Subtle rounding |
| rounded-md | 0.375rem (6px) | Inputs |
| rounded-lg | 0.5rem (8px) | Buttons, badges |
| rounded-xl | 0.75rem (12px) | Cards |
| rounded-2xl | 1rem (16px) | Modals, sheets |
| rounded-full | 9999px | Avatars, pills |

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| shadow-sm | 0 1px 2px rgba(0,0,0,0.05) | Subtle lift |
| shadow | 0 1px 3px rgba(0,0,0,0.1) | Cards |
| shadow-md | 0 4px 6px rgba(0,0,0,0.1) | Dropdowns |
| shadow-lg | 0 10px 15px rgba(0,0,0,0.1) | Modals |

**Note:** In dark mode, reduce shadow opacity by 50%.

---

## Components

### Button

**Variants:**

| Variant | Background | Text | Border | Usage |
|---------|------------|------|--------|-------|
| Primary | emerald-600 | white | none | Main actions |
| Secondary | transparent | text-primary | border-gray-200 | Secondary actions |
| Danger | red-600 | white | none | Destructive actions |
| Ghost | transparent | text-muted | none | Tertiary actions |

**Sizes:**

| Size | Height | Padding | Font |
|------|--------|---------|------|
| sm | 32px | px-3 | text-sm |
| md | 40px | px-4 | text-sm |
| lg | 48px | px-6 | text-base |

**States:**

```css
.btn-primary {
  @apply bg-emerald-600 text-white;
  @apply hover:bg-emerald-700;
  @apply active:bg-emerald-800;
  @apply disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed;
}
```

**Anatomy:**

```
┌─────────────────────────────────┐
│   [Icon?]   Label   [Badge?]   │
└─────────────────────────────────┘
- Full width on mobile (w-full)
- Centered content (justify-center)
- Icon + label gap: 8px
- Border radius: rounded-lg
- Font weight: font-medium
```

### Input

**States:**

| State | Border | Background | Label |
|-------|--------|------------|-------|
| Default | gray-200 | white | gray-600 |
| Focus | emerald-500 (ring) | white | emerald-600 |
| Error | red-500 | white | red-600 |
| Disabled | gray-200 | gray-100 | gray-400 |

**Anatomy:**

```
┌─ Label ─────────────────────────┐
│                                 │
│  [Icon?] Placeholder            │
│                                 │
└─ Helper / Error ────────────────┘
```

**Code:**

```jsx
<div className="mb-4">
  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
    Label
  </label>
  <input
    type="text"
    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg p-2.5
               bg-white dark:bg-gray-700 text-gray-900 dark:text-white
               focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
    placeholder="Placeholder"
  />
  <p className="mt-1 text-sm text-gray-500">Helper text</p>
</div>
```

### Card

**Anatomy:**

```
┌──────────────────────────────────────┐
│ ┌────┐                               │
│ │ 🔲 │  Title                 Value  │
│ └────┘  Subtitle               Unit  │
│                                      │
│  [Optional body content]             │
│                                      │
│  [Optional footer/actions]           │
└──────────────────────────────────────┘
```

**Code:**

```jsx
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                rounded-xl p-4">
  <div className="flex items-start gap-3">
    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700
                    flex items-center justify-center">
      <Icon size={20} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-sm truncate text-gray-900 dark:text-white">
        Title
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Subtitle
      </p>
    </div>
    <div className="text-right">
      <p className="font-bold text-gray-900 dark:text-white">Value</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">Unit</p>
    </div>
  </div>
</div>
```

### Modal / Bottom Sheet

**Anatomy:**

```
┌─────────────────────────────────────────────┐
│████████████████ OVERLAY █████████████████████│
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ Header                            [X] │  │  ← Sticky
│  ├───────────────────────────────────────┤  │
│  │                                       │  │
│  │  Scrollable content area              │  │
│  │                                       │  │
│  │                                       │  │
│  ├───────────────────────────────────────┤  │
│  │ [Cancel]              [Primary Action]│  │  ← Sticky footer
│  └───────────────────────────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

**Code:**

```jsx
<div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
  <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl
                  max-h-[90vh] overflow-y-auto">
    {/* Header */}
    <div className="p-4 border-b border-gray-200 dark:border-gray-700
                    sticky top-0 bg-white dark:bg-gray-800 flex justify-between">
      <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
        Title
      </h3>
      <button onClick={onClose}>
        <X size={24} className="text-gray-500 dark:text-gray-400" />
      </button>
    </div>

    {/* Content */}
    <div className="p-4">
      {/* ... */}
    </div>

    {/* Footer */}
    <div className="p-4 border-t border-gray-200 dark:border-gray-700
                    sticky bottom-0 bg-gray-50 dark:bg-gray-700 flex gap-3">
      <button className="flex-1 py-3 border border-gray-200 dark:border-gray-600
                         rounded-lg font-medium">
        Cancel
      </button>
      <button className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium">
        Save
      </button>
    </div>
  </div>
</div>
```

### Toast

**Variants:**

| Variant | Background | Icon |
|---------|------------|------|
| Success | emerald-600 | CheckCircle |
| Error | red-600 | XCircle |
| Warning | amber-500 | AlertCircle |
| Info | blue-500 | Info |

**Code:**

```jsx
<div className="fixed top-4 left-4 right-4 z-[100] p-4 rounded-lg shadow-lg
                flex items-center gap-3 bg-emerald-600 text-white">
  <CheckCircle size={20} />
  <span className="font-medium">Success message</span>
</div>
```

### Badge / Status

**Code:**

```jsx
<span className="text-xs font-medium px-2 py-1 rounded-full
                 bg-amber-100 text-amber-700
                 dark:bg-amber-900 dark:text-amber-200">
  Pending
</span>
```

### Toggle

**Code:**

```jsx
<button onClick={() => onChange(!enabled)}>
  {enabled ? (
    <ToggleRight size={28} className="text-emerald-500" />
  ) : (
    <ToggleLeft size={28} className="text-gray-400 dark:text-gray-500" />
  )}
</button>
```

### Quantity Input

**Anatomy:**

```
┌───┐ ┌─────────┐ ┌───┐
│ - │ │    5    │ │ + │
└───┘ └─────────┘ └───┘
```

**Code:**

```jsx
<div className="flex items-center gap-2">
  <button
    onClick={decrement}
    className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700
               flex items-center justify-center"
  >
    <Minus size={16} />
  </button>
  <input
    type="text"
    inputMode="numeric"
    value={value}
    onChange={handleChange}
    className="w-16 h-8 text-center border border-gray-200 dark:border-gray-700
               rounded-lg font-semibold bg-white dark:bg-gray-700"
  />
  <button
    onClick={increment}
    className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-700
               flex items-center justify-center"
  >
    <Plus size={16} />
  </button>
</div>
```

---

## Layout Patterns

### App Shell

```
┌─────────────────────────────────────────────┐
│               HEADER (sticky)                │  56px
├─────────────────────────────────────────────┤
│                                             │
│                                             │
│              MAIN CONTENT                   │
│              (scrollable)                   │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│          STATUS BAR (optional)              │  28px
├─────────────────────────────────────────────┤
│            BOTTOM NAVIGATION                │  64px
└─────────────────────────────────────────────┘
```

### Header

```jsx
<div className="bg-slate-700 dark:bg-gray-900 text-white px-4 py-3
                flex items-center justify-between sticky top-0 z-10">
  <div className="flex items-center gap-3">
    {showBack ? (
      <button onClick={onBack}><ChevronLeft size={24} /></button>
    ) : (
      <button onClick={openMenu}><Menu size={24} /></button>
    )}
    <h1 className="font-semibold text-lg">{title}</h1>
  </div>
  <div className="flex items-center gap-2">
    {rightContent}
    <button onClick={toggleTheme} className="p-2 rounded-lg bg-white/10">
      {darkMode ? <SunIcon /> : <MoonIcon />}
    </button>
    {notificationCount > 0 && (
      <div className="bg-red-500 text-xs font-bold w-5 h-5 rounded-full
                      flex items-center justify-center">
        {notificationCount}
      </div>
    )}
  </div>
</div>
```

### Bottom Navigation

```jsx
<div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800
                border-t border-gray-200 dark:border-gray-700 flex justify-around py-2">
  {navItems.map(item => (
    <button
      key={item.id}
      onClick={() => navigate(item.id)}
      className={`flex flex-col items-center p-2 relative
                  ${isActive(item.id)
                    ? 'text-gray-900 dark:text-white'
                    : 'text-gray-500 dark:text-gray-400'}`}
    >
      <item.icon size={22} />
      <span className="text-xs mt-1">{item.label}</span>
      {item.badge > 0 && (
        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs
                        w-5 h-5 rounded-full flex items-center justify-center">
          {item.badge}
        </div>
      )}
    </button>
  ))}
</div>
```

### Grid Layouts

**KPI Dashboard (2x2):**

```jsx
<div className="grid grid-cols-2 gap-3 mb-4">
  <KPICard />
  <KPICard />
  <KPICard />
  <KPICard />
</div>
```

**Action Grid (2-column):**

```jsx
<div className="grid grid-cols-2 gap-2">
  <ActionButton />
  <ActionButton />
</div>
```

---

## Touch Targets

| Element | Minimum Size | Recommended |
|---------|--------------|-------------|
| Buttons | 44px | 48px |
| List items | 44px | 56px |
| Icon buttons | 44px | 44px |
| Navigation items | 48px | 64px |
| Form inputs | 44px | 48px |

---

## Animation Guidelines

### Transitions

| Property | Duration | Easing |
|----------|----------|--------|
| Color | 150ms | ease-in-out |
| Background | 150ms | ease-in-out |
| Transform | 200ms | ease-out |
| Opacity | 150ms | ease-in-out |
| Layout | 300ms | ease-in-out |

### Motion Patterns

| Action | Animation |
|--------|-----------|
| Modal open | Slide up + fade in |
| Modal close | Slide down + fade out |
| Toast appear | Slide down from top |
| Toast dismiss | Fade out |
| Button press | Scale down 95% |
| Card tap | Background darken |

---

## Accessibility

### Color Contrast

- Text on backgrounds: minimum 4.5:1 (WCAG AA)
- Large text (>18px bold): minimum 3:1
- Interactive elements: minimum 3:1

### Focus States

```css
.focusable:focus {
  @apply outline-none ring-2 ring-emerald-500 ring-offset-2;
}
```

### Screen Reader Support

- All images need `alt` text
- Icon-only buttons need `aria-label`
- Status changes need `aria-live` regions
- Form errors need `aria-describedby`

---

## Dark Mode Implementation

### Strategy

Use Tailwind's `dark:` variant with class-based toggling:

```jsx
<div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
  <div className="bg-gray-50 dark:bg-gray-900">
    {/* Content */}
  </div>
</div>
```

### Key Adjustments

1. **Shadows**: Reduce opacity in dark mode
2. **Borders**: Use lighter gray (gray-700 vs gray-200)
3. **Backgrounds**: Layer with subtle differences
4. **Accents**: Same hues work, may need brightness adjustment

---

## Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| default | 0-639px | Mobile phones |
| sm | 640px+ | Large phones, small tablets |
| md | 768px+ | Tablets |
| lg | 1024px+ | Desktops |

**Note:** This app is designed mobile-first. Desktop layouts should use the `max-w-md mx-auto` pattern to maintain the mobile experience on larger screens.

---

## Icon Guidelines

### Size Standards

| Context | Size | Usage |
|---------|------|-------|
| Navigation | 22px | Bottom nav icons |
| List items | 18-20px | In cards/lists |
| Buttons | 16-18px | Inline with text |
| Headers | 24px | Avatar/role icons |
| Empty states | 48px | Centered illustrations |

### Icon Sources

1. **Primary**: Lucide React
2. **Custom**: SVG components for pest-control specific icons

---

*Document Version: 1.0*
*Last Updated: 2026-01-18*
