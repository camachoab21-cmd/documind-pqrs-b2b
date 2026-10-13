import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import IngestaDocumental from './pages/IngestaDocumental';
import ChatRAG from './pages/ChatRAG';
import DashboardTI from './pages/DashboardTI';
import GestionPqrs from './pages/GestionPqrs';
import PortalRadicacionPublica from './pages/PortalRadicacionPublica';

/**
 * Layout principal de la aplicación (sidebar + contenido)
 */
function AppLayout() {
  const [selectedRepo, setSelectedRepo] = useState(null);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar permanente */}
      <Sidebar onRepoSelect={setSelectedRepo} selectedRepo={selectedRepo} />

      {/* Área de contenido principal */}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/pqrs" element={<GestionPqrs />} />
          <Route path="/radicar" element={<PortalRadicacionPublica />} />
          <Route path="/ingesta" element={<IngestaDocumental selectedRepo={selectedRepo} />} />
          <Route path="/chat" element={<ChatRAG selectedRepo={selectedRepo} />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredRole="ADMIN">
                <DashboardTI />
              </ProtectedRoute>
            }
          />
          {/* Redirección por defecto */}
          <Route path="*" element={<Navigate to="/pqrs" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Cargando DocuMind...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Ruta pública de login */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/pqrs" replace /> : <Login />}
      />

      {/* Ruta pública de radicación y seguimiento ciudadano */}
      <Route path="/radicar" element={<PortalRadicacionPublica />} />

      {/* Rutas protegidas con layout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
