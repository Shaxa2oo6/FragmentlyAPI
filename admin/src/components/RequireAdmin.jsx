import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Admin403 from '../pages/Admin403';

export default function RequireAdmin({ allowedRoles = ['admin', 'superadmin', 'support'] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span>Admin Ruxsatlari Tekshirilmoqda...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  const userRole = (user.role || '').toLowerCase();
  const isAllowed = allowedRoles.some((r) => r.toLowerCase() === userRole);

  if (!isAllowed) {
    return <Admin403 />;
  }

  return <Outlet />;
}
