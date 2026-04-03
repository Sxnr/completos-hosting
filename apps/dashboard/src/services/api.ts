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

// Manejo global de errores
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const msg = err.response?.data?.error || err.message || 'Error desconocido';
        window.dispatchEvent(new CustomEvent('app:error', { detail: msg }));
        if (err.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);


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