/** @format */

import axios, { CanceledError } from "axios";
export { CanceledError };
import { API_URL } from "../config";

const CREDENTIAL_ENDPOINTS = /^\/auth\/(login|register|google|refresh|logout)$/;

export const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `JWT ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    
    if (error.response?.status === 401 && 
        !originalRequest._retry && 
        // credential endpoints answer 401 for bad credentials; refreshing would not help
        !CREDENTIAL_ENDPOINTS.test(originalRequest.url ?? '')) {
      
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("No refresh token available");
        }
        
        const response = await axios.post(`${API_URL}/auth/refresh`, 
          { refreshToken },
          { withCredentials: true }
        );
        
        if (response.data.accessToken && response.data.refreshToken) {
          localStorage.setItem("accessToken", response.data.accessToken);
          localStorage.setItem("refreshToken", response.data.refreshToken);
          originalRequest.headers.Authorization = `JWT ${response.data.accessToken}`;
          return axios(originalRequest);
        }
      } catch {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
      }
    }
    
    return Promise.reject(error);
  }
);
