import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut as firebaseSignOut
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

console.log('🔥 Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? 'Set ✓' : 'Missing ✗',
  authDomain: firebaseConfig.authDomain ? 'Set ✓' : 'Missing ✗',
  projectId: firebaseConfig.projectId ? 'Set ✓' : 'Missing ✗',
  storageBucket: firebaseConfig.storageBucket ? 'Set ✓' : 'Missing ✗',
  messagingSenderId: firebaseConfig.messagingSenderId ? 'Set ✓' : 'Missing ✗',
  appId: firebaseConfig.appId ? 'Set ✓' : 'Missing ✗',
});

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

console.log('✅ Firebase initialized');

// Check if user is logged in
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Sign up with email/password
export const signUp = async (email: string, password: string) => {
  try {
    console.log('📝 Signing up:', email);
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log('✅ Sign up successful:', result.user.uid);
    return { success: true, user: result.user };
  } catch (error: any) {
    console.error('❌ Sign up error:', error);
    return { success: false, error: error.message };
  }
};

// Sign in with email/password
export const signIn = async (email: string, password: string) => {
  try {
    console.log('🔐 Signing in:', email);
    const result = await signInWithEmailAndPassword(auth, email, password);
    console.log('✅ Sign in successful:', result.user.uid);
    return { success: true, user: result.user };
  } catch (error: any) {
    console.error('❌ Sign in error:', error);
    return { success: false, error: error.message };
  }
};

// Sign out
export const signOut = async () => {
  try {
    console.log('👋 Signing out...');
    await firebaseSignOut(auth);
    console.log('✅ Sign out successful');
    return { success: true };
  } catch (error: any) {
    console.error('❌ Sign out error:', error);
    return { success: false, error: error.message };
  }
};

// Sign in anonymously (fallback)
export const signInAnonymouslyFn = async () => {
  try {
    console.log('🔐 Starting anonymous sign-in...');
    const result = await signInAnonymously(auth);
    console.log('✅ Anonymous sign-in successful:', result.user.uid);
    return { success: true, user: result.user };
  } catch (error: any) {
    console.error('❌ Anonymous sign-in error:', error);
    return { success: false, error: error.message };
  }
};

// Wait for auth to be ready
export const waitForAuth = (): Promise<any> => {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
};

// Ensure user is authenticated
export const ensureAuth = async () => {
  const user = auth.currentUser;
  if (user) {
    console.log('🔐 User already authenticated:', user.uid);
    return user;
  }

  // Wait for auth state to initialize
  console.log('⏳ Waiting for auth state...');
  const authUser = await waitForAuth();
  
  if (authUser) {
    console.log('🔐 User found:', authUser.uid);
    return authUser;
  }

  // No user - they need to sign in
  console.log('⚠️ No user authenticated');
  return null;
};

// Firestore helpers
export interface TradingData {
  wallet: number;
  tradingFee: number;
  positions: any[];
  lastUpdated: number;
}

// Position Trading Data interface for Firestore
export interface PositionTradingFirestoreData {
  tradeLogs: any[];
  assets: any[];
  takeProfitLevels: any[];
  dcaLevels: any[];
  portfolioMetrics: any;
  alerts: any[];
  initialCapital: number;
  availableCash: number;
  lastUpdated: number;
}

export const saveToFirestore = async (data: TradingData) => {
  try {
    console.log('💾 saveToFirestore: Starting...');
    const user = await ensureAuth();
    if (!user) {
      console.log('⚠️ saveToFirestore: No user authenticated');
      return false;
    }

    const userDoc = doc(db, 'users', user.uid);
    console.log('💾 saveToFirestore: Writing to users/' + user.uid);
    await setDoc(userDoc, {
      ...data,
      lastUpdated: Date.now(),
    }, { merge: true });

    console.log('✅ saveToFirestore: Success');
    return true;
  } catch (error) {
    console.error('❌ saveToFirestore: Error:', error);
    return false;
  }
};

export const loadFromFirestore = async (): Promise<TradingData | null> => {
  try {
    console.log('📥 loadFromFirestore: Starting...');
    const user = await ensureAuth();
    if (!user) {
      console.log('⚠️ loadFromFirestore: No user authenticated');
      return null;
    }

    const userDoc = doc(db, 'users', user.uid);
    console.log('📥 loadFromFirestore: Reading from users/' + user.uid);
    const docSnap = await getDoc(userDoc);

    if (docSnap.exists()) {
      console.log('✅ loadFromFirestore: Data found');
      return docSnap.data() as TradingData;
    }
    console.log('⚠️ loadFromFirestore: No data found');
    return null;
  } catch (error) {
    console.error('❌ loadFromFirestore: Error:', error);
    return null;
  }
};

export const subscribeToFirestore = (
  callback: (data: TradingData | null) => void
) => {
  let unsubscribe: (() => void) | null = null;

  console.log('👂 subscribeToFirestore: Starting subscription...');
  ensureAuth().then((user) => {
    if (!user) {
      console.log('⚠️ subscribeToFirestore: No user authenticated');
      return;
    }

    const userDoc = doc(db, 'users', user.uid);
    console.log('👂 subscribeToFirestore: Listening to users/' + user.uid);
    unsubscribe = onSnapshot(userDoc, (doc) => {
      if (doc.exists()) {
        console.log('📡 subscribeToFirestore: Data update received');
        callback(doc.data() as TradingData);
      } else {
        console.log('📡 subscribeToFirestore: Document deleted');
        callback(null);
      }
    }, (error) => {
      console.error('❌ subscribeToFirestore: Error:', error);
    });
  });

  return () => {
    console.log('🛑 subscribeToFirestore: Unsubscribing');
    if (unsubscribe) unsubscribe();
  };
};

// ========== POSITION TRADING FIRESTORE FUNCTIONS ==========

export const savePositionTradingToFirestore = async (data: PositionTradingFirestoreData) => {
  try {
    console.log('💾 savePositionTradingToFirestore: Starting...');
    const user = await ensureAuth();
    if (!user) {
      console.log('⚠️ savePositionTradingToFirestore: No user authenticated');
      return false;
    }

    const userDoc = doc(db, 'users', user.uid);
    console.log('💾 savePositionTradingToFirestore: Writing to users/' + user.uid);
    await setDoc(userDoc, {
      positionTrading: {
        ...data,
        lastUpdated: Date.now(),
      }
    }, { merge: true });

    console.log('✅ savePositionTradingToFirestore: Success');
    return true;
  } catch (error) {
    console.error('❌ savePositionTradingToFirestore: Error:', error);
    return false;
  }
};

export const loadPositionTradingFromFirestore = async (): Promise<PositionTradingFirestoreData | null> => {
  try {
    console.log('📥 loadPositionTradingFromFirestore: Starting...');
    const user = await ensureAuth();
    if (!user) {
      console.log('⚠️ loadPositionTradingFromFirestore: No user authenticated');
      return null;
    }

    const userDoc = doc(db, 'users', user.uid);
    console.log('📥 loadPositionTradingFromFirestore: Reading from users/' + user.uid);
    const docSnap = await getDoc(userDoc);

    if (docSnap.exists() && docSnap.data().positionTrading) {
      console.log('✅ loadPositionTradingFromFirestore: Data found');
      return docSnap.data().positionTrading as PositionTradingFirestoreData;
    }
    console.log('⚠️ loadPositionTradingFromFirestore: No position trading data found');
    return null;
  } catch (error) {
    console.error('❌ loadPositionTradingFromFirestore: Error:', error);
    return null;
  }
};

export const subscribeToPositionTradingFirestore = (
  callback: (data: PositionTradingFirestoreData | null) => void
) => {
  let unsubscribe: (() => void) | null = null;

  console.log('👂 subscribeToPositionTradingFirestore: Starting subscription...');
  ensureAuth().then((user) => {
    if (!user) {
      console.log('⚠️ subscribeToPositionTradingFirestore: No user authenticated');
      return;
    }

    const userDoc = doc(db, 'users', user.uid);
    console.log('👂 subscribeToPositionTradingFirestore: Listening to users/' + user.uid);
    unsubscribe = onSnapshot(userDoc, (doc) => {
      if (doc.exists() && doc.data().positionTrading) {
        console.log('📡 subscribeToPositionTradingFirestore: Data update received');
        callback(doc.data().positionTrading as PositionTradingFirestoreData);
      } else {
        console.log('📡 subscribeToPositionTradingFirestore: No position trading data');
        callback(null);
      }
    }, (error) => {
      console.error('❌ subscribeToPositionTradingFirestore: Error:', error);
    });
  });

  return () => {
    console.log('🛑 subscribeToPositionTradingFirestore: Unsubscribing');
    if (unsubscribe) unsubscribe();
  };
};