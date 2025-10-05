# Codebase Structure

## Root Directory
- `package.json` - Dependencies and scripts
- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `eslint.config.js` - ESLint rules and plugins
- `tsconfig.json` - TypeScript configuration
- `CLAUDE.md` - Project instructions for Claude Code
- `.env.local` - Environment variables (not in git)

## Source Directory (`src/`)

### Main Application Files
- `main.tsx` - React app entry point
- `App.tsx` - Simple wrapper component
- `futures-trading-tool.tsx` - Main application component (~2000+ lines)
- `futures-trading-tool-original.tsx` - Backup of original monolithic component

### Modular Architecture
- **`components/`** - UI Components
  - `AuthModal.tsx` - Authentication modal
  - `Header.tsx` - Application header
  - `Dashboard.tsx` - Main dashboard view
  - `AddPositionForm.tsx` - Form for adding positions
  - `PositionList.tsx` - List of trading positions

- **`hooks/`** - Custom React Hooks
  - `useAuth.ts` - Authentication logic
  - `useFirebaseSync.ts` - Firebase synchronization
  - `usePositions.ts` - Position management
  - `useWebSocketPrices.ts` - Real-time price updates
  - `useLocalStorage.ts` - Local storage operations

- **`types/`** - TypeScript Definitions
  - `trading.ts` - Core trading interfaces and types

- **`utils/`** - Utility Functions
  - `calculations.ts` - Trading calculation utilities

- **`lib/`** - External Integrations
  - `firebase.ts` - Firebase configuration and functions

- **`assets/`** - Static Assets
  - `react.svg` - React logo

## Configuration Files
- TypeScript: Strict mode with modern ES2020+ target
- ESLint: React hooks and TypeScript recommended rules
- Tailwind: Standard configuration with content scanning
- Vite: React plugin with standard setup