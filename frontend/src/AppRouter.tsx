// Define todas las rutas con guard de autenticación real
import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage      from './pages/LoginPage'
import DashboardPage  from './pages/DashboardPage'
import ProcessesPage  from './pages/ProcessesPage'
import SettingsPage from './pages/SettingsPage'
import MinecraftPage from './pages/MinecraftPage'
import MinecraftDetailPage from './pages/MinecraftDetailPage'
import PowerPage from './pages/PowerPage'
import DatabasesPage from './pages/DatabasesPage'
import WebPage from './pages/WebPage'

// Verifica si hay token válido en sesión
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = sessionStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={
        <PrivateRoute><DashboardPage /></PrivateRoute>
      } />

      {/* Nueva ruta de procesos */}
      <Route path="/processes" element={
        <PrivateRoute><ProcessesPage /></PrivateRoute>
      } />

      <Route path="/minecraft" element={
        <PrivateRoute><MinecraftPage /></PrivateRoute>
      } />
      <Route path="/minecraft/:id" element={
        <PrivateRoute><MinecraftDetailPage /></PrivateRoute>
      } />

      <Route path="/power" element={
        <PrivateRoute><PowerPage /></PrivateRoute>
      } />

      <Route path="/databases" element={
        <PrivateRoute><DatabasesPage /></PrivateRoute>
      } />

      <Route path="/web" element={
        <PrivateRoute><WebPage /></PrivateRoute>
      } />

      <Route path="/settings" element={
        <PrivateRoute><SettingsPage /></PrivateRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
