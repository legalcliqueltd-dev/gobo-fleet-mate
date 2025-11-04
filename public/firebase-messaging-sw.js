/* Firebase Messaging Service Worker (Compat API for simplicity) */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

const config = {
  apiKey: '%VITE_FIREBASE_API_KEY%',
  projectId: '%VITE_FIREBASE_PROJECT_ID%',
  messagingSenderId: '%VITE_FIREBASE_MESSAGING_SENDER_ID%',
  appId: '%VITE_FIREBASE_APP_ID%',
};

firebase.initializeApp(config);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'FleetTrackMate';
  const body = (payload.notification && payload.notification.body) || '';
  const icon = '/vite.svg';
  self.registration.showNotification(title, { body, icon });
});
