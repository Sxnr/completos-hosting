import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface AuthContextType {
    token: string | null;
    usuario: string | null;
    login: (token: string, usuario: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [usuario, setUsuario] = useState<string | null>(localStorage.getItem('usuario'));

    const login = (newToken: string, newUsuario: string) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('usuario', newUsuario);
        setToken(newToken);
        setUsuario(newUsuario);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('usuario');
        setToken(null);
        setUsuario(null);
    };

    return (
        <AuthContext.Provider value={{ token, usuario, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);