# UI Component Structure

This folder uses a layered custom component architecture:

- `primitives/`: low-level, reusable building blocks (`Button`, inputs, badges)
- `composites/`: assembled UI blocks built from primitives (`EmptyState`, cards, banners)

Component folders should follow this pattern when possible:

- `ComponentName.tsx` - custom HTML + React logic
- `ComponentName.module.css` - component-scoped styles
- `index.ts` - local export surface

Keep business/domain logic out of this folder. `ui/` should remain presentation-oriented and composable.

## Design Tokens

- Global design tokens live in `src/styles/tokens.css`.
- Base/reset styles live in `src/styles/base.css`.
- Legacy utility compatibility classes live in `src/styles/utilities-legacy.css`.
- Booking calendar styles live in `src/styles/calendar.css`.

Use token variables (for example `var(--primary)`, `var(--radius-md)`) when creating new shared primitives.

## Variant Primitives

- `Button` now exposes typed variants and sizes:
  - `variant`: `primary | secondary | ghost | danger`
  - `size`: `sm | md | lg`
- `Button` also supports:
  - `loading`
  - `loadingLabel`
- `buttonVariants` must be imported from `@/components/ui/primitives/Button`, never from `Button.tsx`.
- Keep `className` for local overrides only; avoid composing large utility chains in feature code.
- Auth flows should reuse:
  - `AuthShell`
  - `AuthCard`
  - `AuthField`
  - `AuthMessage`
- Forms should reuse:
  - `FormSection`
  - `Field`
  - `TextInput`
  - `SelectInput`
  - `TextAreaInput`
  - `FileInput`

## Authenticated App Primitives

- Page-level surfaces should reuse:
  - `PageHeader`
  - `SurfaceCard`
  - `SectionTabs`
  - `InlineNotice`
  - `LoadingCard`
  - `MetricCard`
  - `DataTable`
- `PageHeader` is the standard top-of-page pattern for candidate, professional, and admin pages.
- `SurfaceCard` is the default shared container for standalone cards, panels, and summary blocks.
- `FormSection` is for grouped editable content. Do not build fresh bordered field sections in feature code.
- `DataTable` is the only table component for admin-style list views:
  - desktop uses a semantic table with sticky headers
  - mobile falls back to stacked cards from the same column config
- `EmptyState` supports:
  - `layout`: `centered | inline`
  - optional primary and secondary actions
- `NotificationBanner` is for app-level success/error feedback and is implemented with `InlineNotice`.

## Shell Rules

- Authenticated pages should render inside `AuthenticatedContentFrame`.
- Role navigation for candidate, professional, and admin areas lives in `AuthNavbar`.
- Do not add a second role-navigation surface below the top navbar.
- Layout wrappers should provide outer width and spacing only, not duplicate local nav bands, chip rows, or side rails.

## Legacy Utility Policy

- Existing Tailwind-like utility classes are in a compatibility layer and are deprecated for new code.
- New UI work should prefer primitives/components over adding new utility tokens.
- Audit command:
  - `npm run ui:audit`
- `ui:audit` enforces:
  - no undefined utility tokens in JSX
  - no new legacy utility tokens outside `scripts/ui/legacy-utility-allowlist.json`
  - no inline styles outside `scripts/ui/inline-style-allowlist.json`
  - no raw utility-string form control classes inside `src/components/ui/`

## Inline Style Policy

- Inline styles are only allowed for true runtime layout math that cannot be expressed cleanly with tokens or CSS modules.
- The current allowlist is intentionally narrow and starts with the booking calendar grid contract.
