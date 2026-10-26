import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Brain,
  LifeBuoy,
  UploadCloud,
  MessageSquare,
  BarChart3,
  FolderOpen,
  Plus,
  LogOut,
  ChevronRight,
  Shield,
  Loader2,
  Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { repositoriesAPI } from '../services/api';

const ROL_COLORES = {
  ADMIN: 'text-indigo-400',
  LEGAL: 'text-emerald-400',
  FINANCIERO: 'text-amber-400',
  RECLUTADOR: 'text-cyan-400',
};

export default function Sidebar({ onRepoSelect, selectedRepo }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [repositorios, setRepositorios] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [showNewRepo, setShowNewRepo] = useState(false);
  const [newRepoNombre, setNewRepoNombre] = useState('');
  const [newRepoDept, setNewRepoDept] = useState('');
  const [creatingRepo, setCreatingRepo] = useState(false);

  const cargarRepositorios = async () => {
    try {
      setLoadingRepos(true);
      const res = await repositoriesAPI.list();
      const repos = res.data.repositorios || [];
      setRepositorios(repos);
      if (repos.length > 0 && onRepoSelect) {
        // Si no hay repositorio seleccionado o el actual ya no está en la lista permitida
        if (!selectedRepo || !repos.some((r) => r.id === selectedRepo.id)) {
          onRepoSelect(repos[0]);
        }
      }
    } catch {
      // Error silencioso en sidebar
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    cargarRepositorios();
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleCreateRepo = async (e) => {
    e.preventDefault();
    if (!newRepoNombre.trim() || !newRepoDept.trim()) return;

    setCreatingRepo(true);
    try {
      const res = await repositoriesAPI.create({
        nombre: newRepoNombre.trim(),
        departamento: newRepoDept.trim(),
      });
      const nuevo = res.data?.repositorio;
      setNewRepoNombre('');
      setNewRepoDept('');
      setShowNewRepo(false);
      await cargarRepositorios();
      if (nuevo && onRepoSelect) {
        onRepoSelect(nuevo);
      }
    } catch {
      // Silencioso
    } finally {
      setCreatingRepo(false);
    }
  };

  const navItems = [
    { to: '/pqrs', icon: LifeBuoy, label: 'Mesa de Ayuda PQRS' },
    { to: '/radicar', icon: Send, label: 'Portal Radicación' },
    { to: '/ingesta', icon: UploadCloud, label: 'Ingesta Documental' },
    { to: '/chat', icon: MessageSquare, label: 'Chat RAG IA' },
    ...(isAdmin ? [{ to: '/dashboard', icon: BarChart3, label: 'Dashboard / Logs' }] : []),
  ];

  return (
    <aside
      id="sidebar-nav"
      className="w-64 min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-sidebar)' }}
    >
      {/* ── Logo ── */}
      <div className="px-5 py-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
            <Brain className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg tracking-tight leading-none">DocuMind</h1>
            <p className="text-slate-500 text-[10px] font-medium mt-0.5">AI Document Engine</p>
          </div>
        </div>
      </div>

      {/* ── Menú Principal ── */}
      <nav className="px-3 py-4 flex-1 space-y-1">
        <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest px-2 mb-2">
          Navegación
        </p>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            id={`nav-${label.replace(/\s+/g, '-').toLowerCase()}`}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span>{label}</span>
          </NavLink>
        ))}

        {/* ── Repositorios ── */}
        <div className="pt-5">
          <div className="flex items-center justify-between px-2 mb-2">
            <p className="text-slate-600 text-[10px] font-semibold uppercase tracking-widest">
              Repositorios
            </p>
            <button
              id="btn-nuevo-repositorio"
              onClick={() => setShowNewRepo(!showNewRepo)}
              className="text-slate-500 hover:text-indigo-400 transition-colors"
              title="Crear repositorio"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Formulario nuevo repositorio */}
          {showNewRepo && (
            <form
              onSubmit={handleCreateRepo}
              className="mb-3 px-2 space-y-2 animate-fade-in"
            >
              <input
                type="text"
                placeholder="Nombre del repositorio"
                value={newRepoNombre}
                onChange={(e) => setNewRepoNombre(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                placeholder="Departamento"
                value={newRepoDept}
                onChange={(e) => setNewRepoDept(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={creatingRepo}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                {creatingRepo ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Crear'}
              </button>
            </form>
          )}

          {/* Lista de repositorios */}
          <div className="space-y-0.5">
            {loadingRepos ? (
              <div className="px-4 py-2 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin text-slate-600" />
                <span className="text-slate-600 text-xs">Cargando...</span>
              </div>
            ) : repositorios.length === 0 ? (
              <p className="text-slate-600 text-xs px-4 py-2">Sin repositorios aún.</p>
            ) : (
              repositorios.map((repo) => (
                <button
                  key={repo.id}
                  id={`repo-${repo.id}`}
                  onClick={() => onRepoSelect?.(selectedRepo?.id === repo.id ? null : repo)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-150 text-left ${
                    selectedRepo?.id === repo.id
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{repo.nombre}</p>
                    <p className="text-slate-600 text-[10px] truncate">{repo.departamento}</p>
                  </div>
                  {repo.total_documentos > 0 && (
                    <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">
                      {repo.total_documentos}
                    </span>
                  )}
                  {selectedRepo?.id === repo.id && (
                    <ChevronRight className="w-3 h-3 text-indigo-400" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </nav>

      {/* ── Bloque de Usuario ── */}
      <div
        className="m-3 rounded-xl p-4 border border-white/5"
        style={{ backgroundColor: 'var(--color-sidebar-footer)' }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">
              {user?.nombre?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user?.nombre || 'Usuario'}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <Shield className="w-2.5 h-2.5 text-slate-500" />
              <span className={`text-[10px] font-semibold ${ROL_COLORES[user?.rol] || 'text-slate-400'}`}>
                {user?.rol || 'N/A'}
              </span>
            </div>
          </div>
        </div>
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-rose-400 text-xs font-medium py-1.5 rounded-lg hover:bg-white/5 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
