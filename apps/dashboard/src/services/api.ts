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

export const minecraftService = {
  getServers: () =>
    api.get('/minecraft'),
  createServer: (data: { nombre: string; version: string; memoria: string; puerto: number }) =>
    api.post('/minecraft/create', data),
  startServer: (id: string) =>
    api.post(`/minecraft/${id}/start`),
  stopServer: (id: string) =>
    api.post(`/minecraft/${id}/stop`),
  restartServer: (id: string) =>
    api.post(`/minecraft/${id}/restart`),
  deleteServer: (id: string) =>
    api.delete(`/minecraft/${id}`),
  getStats: (id: string) =>
    api.get(`/minecraft/${id}/stats`),
  getLogs: (id: string) =>
    api.get(`/minecraft/${id}/logs`),
  getPlayers: (id: string) =>
    api.get(`/minecraft/${id}/players`),
  sendCommand: (id: string, command: string) =>
    api.post(`/minecraft/${id}/command`, { command }),
  getFiles: (id: string, path = '') =>
    api.get(`/minecraft/${id}/files`, { params: { path } }),
  deleteFile: (id: string, path: string) =>
    api.delete(`/minecraft/${id}/files`, { params: { path } }),
  downloadWorld: (id: string) =>
    api.get(`/minecraft/${id}/download-world`, { responseType: 'blob' }),
};


export default api;