import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { registerServiceWorker, unregisterStaleServiceWorkers } from './pwa';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void registerServiceWorker();
void unregisterStaleServiceWorkers();
