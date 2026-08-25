// Punto de entrada principal de la app
// Aquí vive el router y la lógica de rutas protegidas
import { BrowserRouter } from 'react-router-dom'
import AppRouter from './AppRouter'
import { ToastProvider } from './components/Toast'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App