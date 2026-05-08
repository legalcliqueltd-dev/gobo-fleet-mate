import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RootApp from 'app-entry';
import '@/index.css';
import { trackingService } from '@/services/trackingService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// Resume persistent tracking from storage on cold start.
// This must run BEFORE any React mounts so the singleton is alive
// regardless of which page the user lands on.
trackingService.resumeFromStorage().catch((err) => {
  console.warn('[main] resumeFromStorage failed:', err);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RootApp />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
