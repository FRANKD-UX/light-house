import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { view } from '@forge/bridge';
import { IssueContext } from '../../app/src/IssueContext';
import '../../app/src/styles.css';
void view.theme.enable().catch(() => {
  /* Host theme is unavailable in a local preview. */
});
const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root).render(
  <StrictMode>
    <IssueContext />
  </StrictMode>,
);
