import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ADMIN_ROLES = ['admin', 'superadmin', 'support'];

export default function AdminRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login?admin=true" replace />;
  }

  const role = (user.role || '').toLowerCase();
  if (!ADMIN_ROLES.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
