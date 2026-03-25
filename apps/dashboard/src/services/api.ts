import axios from 'axios';

const api = axios.create({
    baseURL: 'http://172.22.165.77/api',
});

// Inyecta el token JWT automáticamente en cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export const authService = {
    login: (username: string, password: string) =>
        api.post('/auth/login', { username, password }),
    register: (username: string, password: string) =>
        api.post('/auth/register', { username, password }),
};

export const dockerService = {
    getContainers: () => api.get('/docker/containers'),
    getInfo: () => api.get('/docker/info'),
};

export default api;