import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlayerApp } from './PlayerApp';
import '../ui/base.css';
import './play.css';

document.body.classList.add('player-page');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerApp />
  </StrictMode>,
);
