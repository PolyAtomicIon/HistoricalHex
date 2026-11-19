import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HostApp } from './HostApp';
import '../ui/base.css';
import './host.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HostApp />
  </StrictMode>,
);
