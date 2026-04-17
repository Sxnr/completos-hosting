// Punto de entrada principal de la app
// Aquí vive el router y la lógica de rutas protegidas
import { BrowserRouter } from 'react-router-dom'
import AppRouter from './AppRouter'

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}

export default App