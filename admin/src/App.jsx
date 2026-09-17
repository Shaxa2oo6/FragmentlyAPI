import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

import RequireAdmin from './components/RequireAdmin';
import AdminLayout from './components/AdminLayout';
import IPWhitelistGuard from './components/IPWhitelistGuard';

import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminTransactions from './pages/AdminTransactions';
import AdminTariffs from './pages/AdminTariffs';
import PlatformWallet from './pages/PlatformWallet';
import AdminFinance from './pages/AdminFinance';
import AdminHealth from './pages/AdminHealth';
import AdminAuditLogs from './pages/AdminAuditLogs';
import AdminTeam from './pages/AdminTeam';
import AdminSettings from './pages/AdminSettings';
import AdminSecurity from './pages/AdminSecurity';
import Admin403 from './pages/Admin403';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Toaster position="top-right" />
            <IPWhitelistGuard>
              <Routes>
                {/* Login & 403 */}
                <Route path="/login" element={<AdminLogin />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/403" element={<Admin403 />} />
                <Route path="/admin/403" element={<Admin403 />} />

                {/* Protected Admin Routes */}
                <Route element={<RequireAdmin />}>
                  <Route element={<AdminLayout />}>
                    <Route path="/" element={<Navigate to="/admin/dashboard" />} />
                    <Route path="/admin" element={<Navigate to="/admin/dashboard" />} />
                    <Route path="/admin/dashboard" element={<AdminDashboard />} />
                    <Route path="/admin/users" element={<AdminUsers />} />
                    <Route path="/admin/transactions" element={<AdminTransactions />} />
                    <Route path="/admin/tariffs" element={<AdminTariffs />} />
                    <Route path="/admin/wallet" element={<PlatformWallet />} />
                    <Route path="/admin/finance" element={<AdminFinance />} />
                    <Route path="/admin/health" element={<AdminHealth />} />
                    <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
                    <Route path="/admin/team" element={<AdminTeam />} />
                    <Route path="/admin/settings" element={<AdminSettings />} />
                    <Route path="/admin/security" element={<AdminSecurity />} />
                  </Route>
                </Route>

                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </IPWhitelistGuard>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
