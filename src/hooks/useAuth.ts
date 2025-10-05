import { useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { signIn, signUp, signOut, auth } from '../lib/firebase';
import type { AuthForm, AuthMode } from '../types/trading';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState<AuthForm>({ email: '', password: '' });
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setShowAuthModal(true);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      let result;
      if (authMode === 'login') {
        result = await signIn(authForm.email, authForm.password);
      } else {
        result = await signUp(authForm.email, authForm.password);
      }

      if (result.success) {
        setShowAuthModal(false);
        setAuthForm({ email: '', password: '' });
      } else {
        setAuthError(result.error || 'Authentication failed');
      }
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('🔒 Log out? Your data will sync back when you log in again.')) {
      await signOut();
      setShowAuthModal(true);
    }
  };

  return {
    user,
    showAuthModal,
    setShowAuthModal,
    authMode,
    setAuthMode,
    authForm,
    setAuthForm,
    authError,
    authLoading,
    handleAuth,
    handleLogout,
  };
};