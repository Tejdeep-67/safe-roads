import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const authAPI = {
  register: (email: string, password: string, fullName: string) =>
    apiClient.post('/auth/register', { email, password, full_name: fullName }),
  
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  
  verify: () => apiClient.get('/auth/verify'),
};

// User endpoints
export const userAPI = {
  getProfile: () => apiClient.get('/users/profile'),
  
  getReports: () => apiClient.get('/users/reports'),
  
  getStats: () => apiClient.get('/users/stats'),
};

// Report endpoints
export const reportAPI = {
  uploadReport: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post('/reports/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  createReport: (latitude: number, longitude: number, confidence: number, imageUrl?: string) =>
    apiClient.post('/reports', { latitude, longitude, confidence, image_url: imageUrl }),
  
  getReport: (reportId: string) => apiClient.get(`/reports/${reportId}`),
  
  deleteReport: (reportId: string) => apiClient.delete(`/reports/${reportId}`),
};

// Pothole endpoints
export const potholeAPI = {
  getAllPotholes: () => apiClient.get('/potholes'),
  
  getPothole: (potholeId: string) => apiClient.get(`/potholes/${potholeId}`),
  
  getPothelesNear: (latitude: number, longitude: number, radius?: number) =>
    apiClient.get(`/potholes/near/${latitude}/${longitude}?radius=${radius || 2}`),
  
  getPothelesOnRoute: (routeCoordinates: [number, number][], bufferMeters?: number) =>
    apiClient.post('/potholes/on-route', {
      route_coordinates: routeCoordinates,
      buffer_meters: bufferMeters || 30,
    }),
  
  verifyPothole: (potholeId: string, verified: boolean) =>
    apiClient.put(`/potholes/${potholeId}/verify`, { verified }),
};

export default apiClient;
