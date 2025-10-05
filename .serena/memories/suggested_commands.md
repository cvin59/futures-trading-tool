# Suggested Commands for Development

## Development Commands
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (includes TypeScript compilation)
- `npm run lint` - Run ESLint for code quality checks
- `npm run preview` - Preview production build locally

## System Commands (Darwin/macOS)
- `ls` - List directory contents
- `cd` - Change directory
- `grep` - Search text patterns
- `find` - Find files and directories
- `git` - Version control operations
- `npm` - Node package manager

## Task Completion Workflow
1. Run `npm run lint` to check code quality
2. Run `npm run build` to ensure TypeScript compilation succeeds
3. Test functionality manually with `npm run dev`
4. Commit changes if everything passes

## Environment Setup
- Environment variables stored in `.env.local` (not tracked in git)
- Firebase config uses VITE_FIREBASE_* environment variables
- Node.js and npm required for development