import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from './app/providers';
import { AppRouter } from './app/router';
import './styles/globals.css';
import { USE_MOCKS } from './lib/constants';

// Automatically normalize legacy hash routes (e.g. /#/enterprise-login -> /login)
if (typeof window !== 'undefined' && window.location.hash) {
  const hashPath = window.location.hash.replace(/^#/, '');
  if (hashPath.startsWith('/')) {
    let cleanPath = hashPath;
    if (hashPath === '/enterprise-login' || hashPath === '/customer-login' || hashPath === '/portal/login') cleanPath = '/login';
    window.history.replaceState(null, '', cleanPath);
  }
}

async function prepareApp() {
  if (USE_MOCKS) {
    try {
      const { worker } = await import('./mocks/browser');
      await worker.start({
        serviceWorker: {
          url: '/mockServiceWorker.js',
        },
        onUnhandledRequest: 'bypass',
      });
      console.log('[DealFlow360] MSW Mock Server initialized successfully');
    } catch (e) {
      console.warn('Failed to start MSW worker', e);
    }
  }
}

prepareApp().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </React.StrictMode>
  );
});
