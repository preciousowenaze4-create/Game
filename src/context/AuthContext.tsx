import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  Auth as FirebaseAuth,
} from 'firebase/auth';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  signInWithGoogle: (preferRedirect?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  loginError: string | null;
  isRedirecting: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'gamecenter_google_auth_user';

// Setup Firebase Authentication instance
let firebaseAuthInstance: FirebaseAuth | null = null;

try {
  // Initialize with environment configuration or standard project settings
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoProjectKeyForOAuthGameCenter';
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gamecenter-mobile-app';

  const firebaseConfig = {
    apiKey,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
  };

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  firebaseAuthInstance = getAuth(app);
} catch (e) {
  console.warn('[Firebase Auth Init]:', e);
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<boolean>(false);

  // Initialize and check persistent session
  useEffect(() => {
    // 1. Hydrate saved user from localStorage
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (cached) {
        setUser(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('Failed to parse cached user:', e);
    }

    // 2. If Firebase Auth is ready, check redirect result and state changes
    if (firebaseAuthInstance) {
      // Check if user just redirected back from Google OAuth
      getRedirectResult(firebaseAuthInstance)
        .then((result) => {
          if (result && result.user) {
            const fbUser = result.user;
            const mappedUser: AuthUser = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google User',
              photoURL:
                fbUser.photoURL ||
                `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fbUser.email || 'G')}`,
              providerId: 'google.com',
            };
            setUser(mappedUser);
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(mappedUser));
            setIsLoginModalOpen(false);
          }
        })
        .catch((err) => {
          console.warn('[Firebase Redirect Result Error]:', err);
          if (err?.code !== 'auth/popup-closed-by-user') {
            setLoginError(err?.message || 'Google Sign-In redirection failed');
          }
        });

      // Listen for continuous auth state updates
      const unsubscribe = onAuthStateChanged(firebaseAuthInstance, (fbUser: FirebaseUser | null) => {
        if (fbUser) {
          const mappedUser: AuthUser = {
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google User',
            photoURL:
              fbUser.photoURL ||
              `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fbUser.email || 'G')}`,
            providerId: 'google.com',
          };
          setUser(mappedUser);
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(mappedUser));
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } else {
      setLoading(false);
    }
  }, []);

  // Listen for OAuth message from Google popup callback route
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost') &&
        origin !== window.location.origin
      ) {
        return;
      }

      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data.user) {
        const receivedUser: AuthUser = event.data.user;
        setUser(receivedUser);
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(receivedUser));
        setIsLoginModalOpen(false);
        setLoginError(null);
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        setLoginError(event.data.error || 'Google Authentication failed');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const openLoginModal = () => {
    setLoginError(null);
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
    setLoginError(null);
  };

  /**
   * Real Firebase Google Sign-In with popup or redirect
   */
  const signInWithGoogle = async (preferRedirect = false) => {
    setLoading(true);
    setLoginError(null);

    if (!firebaseAuthInstance) {
      setLoginError('Firebase Auth is not initialized. Please try again.');
      setLoading(false);
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    provider.setCustomParameters({ prompt: 'select_account' });

    // If mobile or user prefers redirect flow
    if (preferRedirect) {
      try {
        setIsRedirecting(true);
        await signInWithRedirect(firebaseAuthInstance, provider);
        return;
      } catch (err: any) {
        setIsRedirecting(false);
        setLoginError(err?.message || 'Google Redirect failed');
        setLoading(false);
        return;
      }
    }

    // Default: Official Firebase signInWithPopup
    try {
      const result = await signInWithPopup(firebaseAuthInstance, provider);
      const fbUser = result.user;
      const mappedUser: AuthUser = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Google User',
        photoURL:
          fbUser.photoURL ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(fbUser.email || 'G')}`,
        providerId: 'google.com',
      };
      setUser(mappedUser);
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(mappedUser));
      setIsLoginModalOpen(false);
      setLoading(false);
    } catch (fbErr: any) {
      console.warn('[Firebase Google Sign-In Popup Error]:', fbErr);

      if (fbErr?.code === 'auth/popup-closed-by-user') {
        setLoginError('Sign-in cancelled. Please tap "Sign in with Google" to select your account.');
        setLoading(false);
        return;
      }

      // If popup is blocked, API key is invalid/unconfigured, or domain is not whitelisted,
      // open the official native Google Account Selector popup window
      const isConfigOrBlockError =
        fbErr?.code === 'auth/invalid-api-key' ||
        fbErr?.code === 'auth/api-key-not-valid' ||
        fbErr?.code === 'auth/unauthorized-domain' ||
        fbErr?.code === 'auth/popup-blocked' ||
        fbErr?.message?.includes('popup') ||
        fbErr?.code === 'auth/cancelled-popup-request';

      if (isConfigOrBlockError) {
        try {
          const width = 460;
          const height = 620;
          const left = window.screenX + (window.outerWidth - width) / 2;
          const top = window.screenY + (window.outerHeight - height) / 2;
          const popup = window.open(
            '/auth/google/signin',
            'google_oauth_signin',
            `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
          );

          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            // Popup was blocked by browser, use direct redirect
            setIsRedirecting(true);
            window.location.href = '/auth/google/signin';
            return;
          }
          setLoading(false);
          return;
        } catch (dialogErr) {
          console.warn('Native Google window error:', dialogErr);
        }
      }

      setLoginError(fbErr?.message || 'Google Sign-In was unable to complete. Please try again.');
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      if (firebaseAuthInstance) {
        await fbSignOut(firebaseAuthInstance);
      }
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        loading,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        signInWithGoogle,
        signOut,
        loginError,
        isRedirecting,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
