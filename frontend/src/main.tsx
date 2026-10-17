import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './styles/global.css';
import './styles/atelier.css';
import './styles/smartshoots-amoled-app.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (false && 'serviceWorker' in navigator && import.meta.env.PROD) {
  // disabled
}
