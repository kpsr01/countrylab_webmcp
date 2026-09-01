import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { registerWebMCPTools } from './webmcp/registerTools';
import './styles.css';

const webMCPRegistration = registerWebMCPTools();
webMCPRegistration.catch((error) => console.warn('[WebMCP] registration unavailable:', error));
const hot = (import.meta as ImportMeta & { hot?: { dispose(callback: () => void): void } }).hot;
if (hot) hot.dispose(() => { void webMCPRegistration.then(({ cleanup }) => cleanup()); });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
