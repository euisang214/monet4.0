# UI Component Structure

This folder uses a layered custom component architecture:

- `primitives/`: low-level, reusable building blocks (`Button`, inputs, badges)
- `composites/`: assembled UI blocks built from primitives (`EmptyState`, cards, banners)

Component folders should follow this pattern when possible:

- `ComponentName.tsx` - custom HTML + React logic
- `ComponentName.module.css` - component-scoped styles
- `index.ts` - local export surface

Keep business/domain logic out of this folder. `ui/` should remain presentation-oriented and composable.
