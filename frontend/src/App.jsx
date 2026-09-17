import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout/Layout';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import AdminRoute from './components/Layout/AdminRoute';
import Loader from './components/common/Loader';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Profile = lazy(() => import('./pages/Profile'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Settings = lazy(() => import('./pages/Settings'));
const Subscriptions = lazy(() => import('./pages/Subscriptions'));
const MnemonicToken = lazy(() => import('./pages/MnemonicToken'));
const Terms = lazy(() => import('./pages/Terms'));
const Help = lazy(() => import('./pages/Help'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminTransactions = lazy(() => import('./pages/admin/AdminTransactions'));
const AdminTariffs = lazy(() => import('./pages/admin/AdminTariffs'));
const AdminHealth = lazy(() => import('./pages/admin/AdminHealth'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 daqiqalik client-side kesh
      gcTime: 1000 * 60 * 15,   // 15 daqiqa xotirada saqlash
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <Toaster position="top-center" toastOptions={{ style: { maxWidth: 'calc(100vw - 32px)' } }} />
              <Suspense fallback={<Loader />}>
              <Routes>
                {/* Public Landing Page */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />

                {/* Authenticated Dashboard App */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/transactions" element={<Transactions />} />
                    <Route path="/subscriptions" element={<Subscriptions />} />
                    <Route path="/mnemonic" element={<MnemonicToken />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/api-docs" element={<ApiDocs />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/help" element={<Help />} />
                  </Route>
                </Route>

                {/* Admin Panel */}
                <Route element={<AdminRoute />}>
                  <Route element={<Layout />}>
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminOverview />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="transactions" element={<AdminTransactions />} />
                      <Route path="tariffs" element={<AdminTariffs />} />
                      <Route path="health" element={<AdminHealth />} />
                    </Route>
                  </Route>
                </Route>

                {/* Catch-all redirect to Landing Page */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;