import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import 'mapbox-gl/dist/mapbox-gl.css';

// Register service worker for Firebase push notifications
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js').then(async (reg) => {
    if (!reg) {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
