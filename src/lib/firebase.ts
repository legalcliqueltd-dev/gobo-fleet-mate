// Lazy load Firebase to avoid React version conflicts
let firebasePromise: Promise<any> | null = null;
let messagingPromise: Promise<any> | null = null;
let appInstance: any = null;

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export async function getFcmMessaging() {
  try {
    // Lazy load Firebase modules
    if (!firebasePromise) {
      firebasePromise = Promise.all([
        import('firebase/app'),
        import('firebase/messaging')
      ]);
    }
    
    const [{ initializeApp, getApps }, { getMessaging, isSupported }] = await firebasePromise;
    
    // Initialize app only once
    if (!appInstance) {
      const apps = getApps();
      appInstance = apps.length > 0 ? apps[0] : initializeApp(config);
    }
    
    if (!messagingPromise) {
      const supported = await isSupported();
      messagingPromise = supported ? Promise.resolve(getMessaging(appInstance)) : Promise.resolve(null);
    }
    
    return messagingPromise;
  } catch (error) {
    console.error('Firebase initialization error:', error);
    return null;
  }
}
