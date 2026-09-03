import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Tailwind CSS — utilities de diseño (dual theme vía `dark:`)
import './index.css'

// Design system en CSS variables (claro/oscuro)
import './styles/variables.css'   // Variables CSS globales
import './styles/base.css'         // Reset y estilos base
import './styles/components.css'   // Componentes reutilizables

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
