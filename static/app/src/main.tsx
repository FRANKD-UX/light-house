import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { view } from '@forge/bridge';
import { App } from './App';
import './styles.css';
void view.theme.enable().catch(() => {
  /* Local preview has no Forge host theme. */
});
const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
