import { Buffer } from 'buffer';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { canonicalRedirectUrl } from '../shared/site';

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

const redirectTo = canonicalRedirectUrl(window.location.hostname, `${window.location.pathname}${window.location.search}${window.location.hash}`);
if (redirectTo) {
  window.location.replace(redirectTo);
} else {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

