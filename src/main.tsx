import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Handle benign network abort errors gracefully (e.g., page navigation, reload, iframe refresh)
const isAbortException = (err: any): boolean => {
  if (!err) return false;
  const msg = typeof err?.message === 'string' ? err.message.toLowerCase() : typeof err === 'string' ? err.toLowerCase() : '';
  const name = typeof err?.name === 'string' ? err.name : '';
  return (
    name === 'AbortError' ||
    err?.code === 'cancelled' ||
    msg.includes('aborted') ||
    msg.includes('abort') ||
    msg.includes('the user aborted a request')
  );
};

window.addEventListener('unhandledrejection', (event) => {
  if (isAbortException(event.reason)) {
    event.preventDefault();
  }
});

window.addEventListener('error', (event) => {
  if (isAbortException(event.error) || isAbortException(event.message)) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
