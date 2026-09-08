import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const configModules = typeof (import.meta as any)?.glob === 'function'
  ? (import.meta as any).glob('../firebase-applet-config.json', { eager: true })
  : {};
const rawConfig: any = Object.values(configModules)[0] ? ((Object.values(configModules)[0] as any).default || Object.values(configModules)[0]) : {};

const defaultFirebaseConfig = {
  apiKey: "AIzaSyCvtuoTPMd_e3UQ-V6CLyReDuiiJS7-1_8",
  authDomain: "bse-nexus.firebaseapp.com",
  projectId: "bse-nexus",
  storageBucket: "bse-nexus.firebasestorage.app",
  messagingSenderId: "1048233708069",
  appId: "1:1048233708069:web:6b3252dec7e05012318dcc"
};

const firebaseConfig = {
  apiKey: (rawConfig?.apiKey && rawConfig.apiKey.trim() !== '') ? rawConfig.apiKey.trim() : defaultFirebaseConfig.apiKey,
  authDomain: (rawConfig?.authDomain && rawConfig.authDomain.trim() !== '') ? rawConfig.authDomain.trim() : defaultFirebaseConfig.authDomain,
  projectId: (rawConfig?.projectId && rawConfig.projectId.trim() !== '') ? rawConfig.projectId.trim() : defaultFirebaseConfig.projectId,
  storageBucket: (rawConfig?.storageBucket && rawConfig.storageBucket.trim() !== '') ? rawConfig.storageBucket.trim() : defaultFirebaseConfig.storageBucket,
  messagingSenderId: (rawConfig?.messagingSenderId && rawConfig.messagingSenderId.trim() !== '') ? rawConfig.messagingSenderId.trim() : defaultFirebaseConfig.messagingSenderId,
  appId: (rawConfig?.appId && rawConfig.appId.trim() !== '') ? rawConfig.appId.trim() : defaultFirebaseConfig.appId
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.trim() !== '' &&
  !firebaseConfig.apiKey.includes('Placeholder') &&
  !firebaseConfig.apiKey.includes('FakeKey')
);

// Clear stale tokens and caches from previous project on startup
if (typeof window !== 'undefined') {
  try {
    const lastProject = localStorage.getItem('bse_nexus_firebase_project');
    const currentProject = firebaseConfig.projectId || 'bse-nexus';
    if (lastProject && lastProject !== currentProject) {
      console.info(`[Auth] Resetting stale session cache for project: ${currentProject}`);
      localStorage.removeItem('bse_nexus_auth_session');
      localStorage.removeItem('bse_nexus_fb_id_token');
    }
    localStorage.setItem('bse_nexus_firebase_project', currentProject);

    // Sanitize any malformed non-JWT token from localStorage
    const existingFbToken = localStorage.getItem('bse_nexus_fb_id_token');
    if (existingFbToken && existingFbToken.split('.').length !== 3) {
      localStorage.removeItem('bse_nexus_fb_id_token');
    }
  } catch {}
}

// Initialize Firebase App for Auth
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Authentication instance
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});


