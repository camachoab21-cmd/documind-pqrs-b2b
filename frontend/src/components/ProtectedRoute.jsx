import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Ruta protegida que requiere autenticación.
 * Opcionalmente puede requerir un rol específico.
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 text-sm font-medium">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.rol !== requiredRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center card p-10 max-w-md">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Acceso Denegado</h2>
          <p className="text-slate-500 text-sm">
            Esta sección requiere rol <span className="font-bold text-indigo-600">{requiredRole}</span>.
            Tu rol actual es <span className="font-bold text-slate-700">{user?.rol}</span>.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
