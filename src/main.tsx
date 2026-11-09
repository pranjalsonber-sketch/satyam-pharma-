import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupAutoOfflineSync } from './lib/offlinePosStore';

// Register Service Worker for offline asset caching & PWA resilience
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[SW] Service Worker registered with scope:', registration.scope);
      },
      (err) => {
        console.warn('[SW] Service Worker registration failed:', err);
      }
    );
  });
}

// Initialize automated background sync engine for offline POS transactions
setupAutoOfflineSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
