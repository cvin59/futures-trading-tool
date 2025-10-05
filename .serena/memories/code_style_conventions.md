# Code Style and Conventions

## TypeScript Configuration
- Strict TypeScript mode enabled
- Modern ES2020+ syntax
- Type definitions in `src/types/` directory
- Interface-based type definitions (Position, TradingData, etc.)

## React Conventions
- React 19 with functional components only
- Custom hooks for business logic separation
- useState, useEffect, useMemo for state management
- Component composition over inheritance

## File Organization
- **Components**: `src/components/` - Reusable UI components
- **Hooks**: `src/hooks/` - Custom business logic hooks
- **Types**: `src/types/` - TypeScript interfaces and types
- **Utils**: `src/utils/` - Pure utility functions
- **Lib**: `src/lib/` - External service integrations

## Naming Conventions
- Components: PascalCase (e.g., `AddPositionForm.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `usePositions.ts`)
- Types: PascalCase interfaces (e.g., `Position`, `TradingData`)
- Utilities: camelCase functions
- Files: kebab-case or PascalCase for components

## ESLint Configuration
- TypeScript ESLint recommended rules
- React Hooks rules enforced
- React Refresh plugin for development
- No custom overrides, following standard practices

## Styling
- Tailwind CSS utility classes
- No custom CSS modules
- PostCSS for processing
- Responsive design patterns