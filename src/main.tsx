import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

const wadah = document.getElementById('root');
if (!wadah) throw new Error('Elemen #root tidak ditemukan di index.html');

createRoot(wadah).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
