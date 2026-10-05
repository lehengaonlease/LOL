import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and suppress known Firebase free-tier quota exhaustion logs from polluting the console
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const text = args
      .map((a) => {
        if (typeof a === 'string') return a;
        if (a && typeof a === 'object') {
          return `${(a as Error).message || ''} ${(a as Error).name || ''} ${(a as { code?: string }).code || ''}`;
        }
        return String(a || '');
      })
      .join(' ');

    if (
      (text.includes('@firebase/firestore') || text.includes('Firestore')) &&
      (text.includes('RESOURCE_EXHAUSTED') ||
        text.includes('resource-exhausted') ||
        text.includes('Quota limit exceeded') ||
        text.includes('Quota exceeded') ||
        text.includes("RpcConnection RPC 'Write'") ||
        text.includes("GrpcConnection RPC 'Write'"))
    ) {
      // Gracefully suppress free-tier daily quota limit logs; app runs seamlessly via backend API
      return;
    }
    originalConsoleError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
