import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Toaster } from 'sonner';
import { StoreProvider } from './lib/store';
import App from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Tooltip.Provider delayDuration={400}>
      <StoreProvider>
        <App />
        <Toaster theme="system" position="bottom-right" richColors closeButton />
      </StoreProvider>
    </Tooltip.Provider>
  </React.StrictMode>,
);
