import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const res = await api.get('/api/users/me');
      setUser(res.data);
    } catch (error) {
      // Try refresh token if available
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshRes = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
          const newAccessToken = refreshRes.data.access_token;
          localStorage.setItem('access_token', newAccessToken);
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;

          // Retry fetching user profile with new token
          const userRes = await api.get('/api/users/me');
          setUser(userRes.data);
          setLoading(false);
          return;
        } catch (refreshErr) {
          console.error("Token refresh failed:", refreshErr);
        }
      }

      // If refresh fails or no refresh token, log out
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const res = await api.post('/api/auth/login', { username, password });
    const { access_token, refresh_token, user: userData } = res.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

    setUser(userData);
    toast.success('Xush kelibsiz!');
    return userData;
  };

  const register = async (data) => {
    const res = await api.post('/api/auth/register', data);
    const { access_token, refresh_token, user: userData } = res.data;

    localStorage.setItem('access_token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

    setUser(userData);
    toast.success("Ro'yxatdan o'tdingiz!");
    return userData;
  };

  const googleLogin = async (tokenData) => {
    try {
      const res = await api.post('/api/auth/google', tokenData);
      const { access_token, refresh_token, user: userData } = res.data;

      localStorage.setItem('access_token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      setUser(userData);
      toast.success('Google orqali kirdingiz!');
      return userData;
    } catch (err) {
      if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
        throw new Error("Backend serverga ulanib bo'lmadi (http://localhost:8000). Backend server ishga tushirilganini tekshiring.");
      }
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    toast.success('Chiqdingiz');
  };

  const updateUser = (data) => {
    setUser((prev) => ({ ...prev, ...data }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}