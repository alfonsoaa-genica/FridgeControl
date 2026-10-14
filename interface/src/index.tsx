import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';

// 1. PRIMERO: Importamos la configuración para que se ejecute el i18n.init()
import i18n from './i18n/config';

// 2. SEGUNDO: Validamos inmediatamente si cargó
console.log(">>> i18n cargado:", i18n.isInitialized);

import App from './App';
const container = document.getElementById('root');
const root = createRoot(container!);

// 3. TERCERO: Renderizamos la App cuando ya el motor debería estar listo
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
