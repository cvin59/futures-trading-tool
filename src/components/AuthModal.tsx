import React from 'react';
import type { AuthMode, AuthForm } from '../types/trading';

interface AuthModalProps {
  show: boolean;
  authMode: AuthMode;
  setAuthMode: (mode: AuthMode) => void;
  authForm: AuthForm;
  setAuthForm: React.Dispatch<React.SetStateAction<AuthForm>>;
  authError: string;
  authLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  show,
  authMode,
  setAuthMode,
  authForm,
  setAuthForm,
  authError,
  authLoading,
  onSubmit,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full border border-gray-700">
        <h2 className="text-2xl font-bold mb-4 text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          {authMode === 'login' ? '🔐 Login' : '📝 Sign Up'}
        </h2>
        
        <p className="text-sm text-gray-400 mb-4 text-center">
          {authMode === 'login' 
            ? 'Login to sync your positions across all devices' 
            : 'Create an account to sync your data everywhere'}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="your@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>

          {authError && (
            <div className="bg-red-900/30 border border-red-600/50 rounded p-3 text-sm text-red-400">
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded px-4 py-2 font-semibold transition-colors"
          >
            {authLoading ? '⏳ Please wait...' : (authMode === 'login' ? '🔐 Login' : '📝 Sign Up')}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
            className="text-blue-400 hover:text-blue-300 text-sm underline"
            disabled={authLoading}
          >
            {authMode === 'login' 
              ? "Don't have an account? Sign up" 
              : 'Already have an account? Login'}
          </button>
        </div>

        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded text-xs text-gray-300">
          💡 <strong>Tip:</strong> Your data syncs automatically across all your devices when you're logged in. 
          You can also export/import your data anytime.
        </div>
      </div>
    </div>
  );
};