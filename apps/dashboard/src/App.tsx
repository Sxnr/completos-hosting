import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Minecraft from './pages/Minecraft';
import Databases from './pages/Databases';
import WebHosting from './pages/WebHosting';
import Monitoring from './pages/Monitoring';
import GlobalToast from './components/GlobalToast';

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/" element={
                        <ProtectedRoute>
                            <Layout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<Dashboard />} />
                        <Route path="minecraft" element={<Minecraft />} />
                        <Route path="databases" element={<Databases />} />
                        <Route path="hosting" element={<WebHosting />} />
                        <Route path="monitoring" element={<Monitoring />} />
                    </Route>
                </Routes>
                <GlobalToast />  {/* ← movido aquí, fuera de <Routes> */}
            </BrowserRouter>
        </AuthProvider>
    );
}