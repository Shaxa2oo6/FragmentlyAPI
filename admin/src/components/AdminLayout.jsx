import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  Users,
  Wallet,
  ShoppingBag,
  CreditCard,
  HeartPulse,
  ClipboardList,
  Group,
  Settings,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

const adminNavItems = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Overview Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Foydalanuvchilar' },
  { to: '/admin/transactions', icon: ShoppingBag, label: 'Tranzaksiyalar' },
  { to: '/admin/tariffs', icon: CreditCard, label: 'Tarif & Komissiyalar' },
  { to: '/admin/wallet', icon: Wallet, label: 'Platforma Hamyoni' },
  { to: '/admin/finance', icon: TrendingUp, label: 'Moliyaviy Hisobot & Foyda' },
  { to: '/admin/health', icon: HeartPulse, label: 'Tizim Salomatligi' },
  { to: '/admin/audit-logs', icon: ClipboardList, label: 'Audit Logs', superadminOnly: true },
  { to: '/admin/team', icon: Group, label: 'Admin Jamoasi', superadminOnly: true },
  { to: '/admin/settings', icon: Settings, label: 'Sozlamalar' },
  { to: '/admin/security', icon: ShieldCheck, label: 'Kirish Xavfsizligi' },
];

export default function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    if (!isDesktop) return false;
    const saved = localStorage.getItem('admin_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem('admin_sidebar_open', String(next));
      return next;
    });
  };

  const userRole = (user?.role || 'admin').toLowerCase();
  const filteredNavItems = adminNavItems.filter(
    (item) => !item.superadminOnly || userRole === 'superadmin'
  );

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;
    if (q.includes('user') || q.includes('foy')) {
      navigate('/admin/users');
    } else if (q.includes('trans') || q.includes('tranz')) {
      navigate('/admin/transactions');
    } else if (q.includes('tarif') || q.includes('komiss')) {
      navigate('/admin/tariffs');
    } else if (q.includes('wallet') || q.includes('hamyon')) {
      navigate('/admin/wallet');
    } else if (q.includes('foyda') || q.includes('moliyaviy') || q.includes('finance') || q.includes('pul')) {
      navigate('/admin/finance');
    } else if (q.includes('audit') || q.includes('log')) {
      navigate('/admin/audit-logs');
    } else if (q.includes('team') || q.includes('jamoa')) {
      navigate('/admin/team');
    } else if (q.includes('xavf') || q.includes('sec')) {
      navigate('/admin/security');
    } else {
      navigate('/admin/dashboard');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">
      {/* Mobile Backdrop */}
      <div
        className={`lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 transform ${
          sidebarOpen
            ? 'translate-x-0 w-72'
            : '-translate-x-full w-72 lg:translate-x-0 lg:transform-none lg:w-20'
        }`}
      >
        {/* Logo Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between min-h-[64px]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow shrink-0">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 dark:text-white truncate">Fragmently</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Admin Panel</p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            title={sidebarOpen ? "Sidebar-ni yopish (Collapse)" : "Sidebar-ni ochish (Expand)"}
          >
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg bg-gray-100 dark:bg-gray-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin User Profile Section */}
        <div className="p-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-gray-50/60 dark:bg-gray-950/40">
          <div className={`flex items-center ${sidebarOpen ? 'gap-2.5' : 'justify-center'}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-xs font-extrabold shadow shrink-0">
              {user?.username?.[0]?.toUpperCase() || 'A'}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.username || 'Admin'}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {user?.email || 'admin@fragmently.uz'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => {
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className={({ isActive }) =>
                `flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} py-2.5 rounded-xl transition-all duration-200 min-h-[42px] ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100'
                }`
              }
              title={item.label}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium truncate">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} w-full py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-100 transition min-h-[42px]`}
            title={theme === 'dark' ? "Yorug' rejim" : "Qorong'u rejim"}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400 flex-shrink-0" /> : <Moon className="w-5 h-5 text-indigo-500 flex-shrink-0" />}
            {sidebarOpen && <span className="truncate">{theme === 'dark' ? "Yorug' rejim" : "Qorong'u rejim"}</span>}
          </button>

          <button
            type="button"
            onClick={() => {
              logout();
              navigate('/admin/login');
            }}
            className={`flex items-center ${sidebarOpen ? 'gap-3 px-4' : 'justify-center px-0'} w-full py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition min-h-[42px]`}
            title="Chiqish"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="truncate">Chiqish</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={toggleSidebar}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-xl bg-gray-100 dark:bg-gray-800 min-h-[40px] min-w-[40px] flex items-center justify-center transition"
              title={sidebarOpen ? "Menyuni berkitish" : "Menyuni ochish"}
            >
              <Menu className="w-5 h-5" />
            </button>

            <form onSubmit={handleSearch} className="relative flex-1 max-w-md hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Qidirish (masalan: Foydalanuvchilar, Tranzaksiyalar, Security...)"
                className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-gray-900 outline-none transition"
              />
            </form>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden lg:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Operational</span>
            </span>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-500 dark:text-gray-400"
              title="Mavzuni o'zgartirish"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            <button
              type="button"
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition relative text-gray-500 dark:text-gray-400"
              title="Bildirishnomalar"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500"></span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

