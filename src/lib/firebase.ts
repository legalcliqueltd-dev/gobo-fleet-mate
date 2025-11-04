import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: ReturnType<typeof initializeApp> | null = null;
let messagingPromise: Promise<import('firebase/messaging').Messaging | null> | null = null;

export async function getFcmMessaging() {
  if (!app) app = initializeApp(config);
  if (!messagingPromise) {
    messagingPromise = (await isSupported()) ? Promise.resolve(getMessaging(app)) : Promise.resolve(null);
  }
  return messagingPromise;
}
