import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión desde localStorage al iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem('documind_token');
    const storedUser = localStorage.getItem('documind_user');

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('documind_token');
        localStorage.removeItem('documind_user');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await authAPI.login(email, password);
    const { token: newToken, usuario } = response.data;

    localStorage.setItem('documind_token', newToken);
    localStorage.setItem('documind_user', JSON.stringify(usuario));

    setToken(newToken);
    setUser(usuario);

    return usuario;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('documind_token');
    localStorage.removeItem('documind_user');
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.rol === 'ADMIN';
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAdmin, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
