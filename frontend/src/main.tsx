import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Importar el design system en orden correcto
import './styles/variables.css'   // Variables CSS globales
import './styles/base.css'         // Reset y estilos base
import './styles/components.css'   // Componentes reutilizables

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)