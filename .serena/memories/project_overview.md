# Futures Trading Tool - Project Overview

## Purpose
This is a React-based web application for futures trading position management with real-time market data integration. The tool allows users to:
- Track LONG/SHORT futures positions
- Monitor real-time price updates via Binance WebSocket API
- Calculate PNL, DCA levels, and take profit levels
- Sync data with Firebase backend
- Use local storage as offline fallback

## Tech Stack
- **Frontend Framework**: React 19 with TypeScript
- **Build Tool**: Vite with React plugin
- **Styling**: Tailwind CSS with PostCSS
- **Backend**: Firebase (Authentication + Firestore)
- **Icons**: Lucide React
- **Real-time Data**: Binance WebSocket API
- **State Management**: React hooks (useState, useEffect, useMemo)

## Architecture
Originally a monolithic 1700+ line component, now refactored into:
- **Components**: Modular UI components in `src/components/`
- **Hooks**: Custom business logic hooks in `src/hooks/`
- **Types**: TypeScript interfaces in `src/types/`
- **Utils**: Calculation and formatting utilities in `src/utils/`
- **Firebase Integration**: Authentication and Firestore setup in `src/lib/`

## Key Data Structures
- `Position`: Comprehensive position data with entry, current price, DCA/TP levels, PNL
- `TradingData`: User wallet balance, trading fee, positions array
- Firebase handles user-specific data persistence with local storage fallback