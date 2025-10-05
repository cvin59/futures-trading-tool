# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Start development server:**
```bash
npm run dev
```

**Build for production:**
```bash
npm run build
```

**Lint code:**
```bash
npm run lint
```

**Preview production build:**
```bash
npm run preview
```

## Architecture Overview

This is a React + TypeScript + Vite application for futures trading position management with Firebase backend integration.

**Main Application Structure:**
- `src/main.tsx` - React app entry point
- `src/App.tsx` - Simple wrapper component that renders FuturesTradingTool
- `src/futures-trading-tool.tsx` - Main application component (~2000+ lines) containing all trading logic
- `src/lib/firebase.ts` - Firebase authentication and Firestore integration

**Key Technologies:**
- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide React icons
- **Build Tool:** Vite with React plugin
- **Backend:** Firebase (Auth + Firestore)
- **Styling:** Tailwind CSS with PostCSS

**Core Features:**
- Futures position tracking (LONG/SHORT positions)
- Real-time price updates via Binance WebSocket API
- Position calculations (PNL, DCA levels, take profit levels)
- Firebase user authentication and data synchronization
- Local storage fallback for offline functionality

**Main Data Structures:**
- `Position` interface: Comprehensive position data including entry, current price, DCA levels, take profit levels, PNL calculations
- `TradingData` interface: User's wallet balance, trading fee, positions array
- Firebase integration handles user-specific data persistence

**Development Notes:**
- **Refactored Architecture**: Originally a single 1700+ line component, now split into modular components and custom hooks
- **Component Structure**:
  - `src/components/` - Reusable UI components (AuthModal, Header, Dashboard, AddPositionForm, PositionList)
  - `src/hooks/` - Custom hooks for business logic (useAuth, useFirebaseSync, usePositions, useWebSocketPrices, useLocalStorage)
  - `src/types/` - TypeScript interfaces and types
  - `src/utils/` - Utility functions for calculations and formatting
- Uses React hooks for state management (useState, useEffect, useMemo)
- Real-time price updates via WebSocket connections to Binance
- Firebase config uses environment variables (VITE_FIREBASE_*)
- Environment file: `.env.local` (not tracked in git)
- Original large component backed up as `futures-trading-tool-original.tsx`;

## Development Rules

### General
- Update existing docs (Markdown files) in `./docs` directory before any code refactoring
- Add new docs (Markdown files) to `./docs` directory after new feature implementation (do not create duplicated docs)
- use `context7` mcp tools for docs of plugins/packages
- use `senera` mcp tools for semantic retrieval and editing capabilities