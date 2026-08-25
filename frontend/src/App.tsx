// Punto de entrada principal de la app
// Aquí vive el router y la lógica de rutas protegidas
import { BrowserRouter } from 'react-router-dom'
import AppRouter from './AppRouter'
import { ToastProvider } from './components/Toast'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppRouter />
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App