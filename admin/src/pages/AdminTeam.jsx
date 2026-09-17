import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import {
  UserPlusIcon,
  XMarkIcon,
  ShieldCheckIcon,
  ShieldExclamationIcon,
  TrashIcon,
  PlusIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

const isValidIPv4 = (ip) => {
  const regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return regex.test((ip || '').trim());
};

export default function AdminTeam() {
  const queryClient = useQueryClient();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [teamForm, setTeamForm] = useState({
    username: '',
    email: '',
    password: '',
    role: 'admin',
  });

  // Allowed IP Whitelist state
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newIpDesc, setNewIpDesc] = useState('');
  const [deleteIpModal, setDeleteIpModal] = useState({ open: false, ip: null });
  const [unblockIpModal, setUnblockIpModal] = useState({ open: false, ip: null });

  const { data: teamList, isLoading: teamLoading } = useQuery({
    queryKey: ['admin-team'],
    queryFn: () => api.get('/api/admin/team').then((res) => res.data),
  });

  const { data: allowedIps, isLoading: allowedLoading } = useQuery({
    queryKey: ['admin-allowed-ips'],
    queryFn: () => api.get('/api/admin/allowed-ips').then((res) => res.data),
  });

  const { data: blockedIps, isLoading: blockedLoading } = useQuery({
    queryKey: ['admin-blocked-ips'],
    queryFn: () => api.get('/api/admin/blocked-ips').then((res) => res.data),
  });

  const unblockIpMutation = useMutation({
    mutationFn: (ipId) => api.delete(`/api/admin/blocked-ips/${ipId}`),
    onSuccess: (res) => {
      toast.success(res.data?.message || "IP blokdan chiqarildi");
      setUnblockIpModal({ open: false, ip: null });
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-ips'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP blokdan chiqarishda xatolik"),
  });

  const createAdminMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/team/invite', data),
    onSuccess: (res) => {
      toast.success(res.data?.message || "Yangi admin yaratildi");
      setAddModalOpen(false);
      setTeamForm({ username: '', email: '', password: '', role: 'admin' });
      queryClient.invalidateQueries({ queryKey: ['admin-team'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Admin qo'shishda xatolik"),
  });

  const addIpMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/allowed-ips', data),
    onSuccess: (res) => {
      toast.success(res.data?.message || "IP manzil ruxsat berilganlar ro'yxatiga qo'shildi");
      setNewIpAddress('');
      setNewIpDesc('');
      queryClient.invalidateQueries({ queryKey: ['admin-allowed-ips'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP manzil qo'shishda xatolik"),
  });

  const deleteIpMutation = useMutation({
    mutationFn: (ipId) => api.delete(`/api/admin/allowed-ips/${ipId}`),
    onSuccess: (res) => {
      toast.success(res.data?.message || "IP manzil o'chirildi");
      setDeleteIpModal({ open: false, ip: null });
      queryClient.invalidateQueries({ queryKey: ['admin-allowed-ips'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP o'chirishda xatolik"),
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!teamForm.username || !teamForm.email || !teamForm.password) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    createAdminMutation.mutate(teamForm);
  };

  const handleAddIpSubmit = (e) => {
    e.preventDefault();
    if (!newIpAddress || !isValidIPv4(newIpAddress)) {
      toast.error("To'g'ri IPv4 manzilini kiriting (Masalan: 178.218.201.50)");
      return;
    }
    addIpMutation.mutate({ ip_address: newIpAddress.trim(), description: newIpDesc.trim() || "Admin IP" });
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-7 bg-indigo-600 rounded-full inline-block" />
            Admin Jamoasi & Kirish Xavfsizligi
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Admin xodimlar va IP-manzil bo'yicha kirish ruxsatnomalarini boshqarish.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAddModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 min-h-[44px] shrink-0 active:scale-95"
        >
          <UserPlusIcon className="w-4 h-4" />
          <span>Yangi Admin Qo'shish</span>
        </button>
      </div>

      {/* Admin Team Members Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm space-y-2">
        <div className="p-4 bg-gray-50/70 dark:bg-gray-950/60 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            Admin Team Members (Admin Xodimlar)
          </h3>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Jami: {(teamList || []).length} nafar admin
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="py-3.5 px-4">Admin Username</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Rol</th>
                <th className="py-3.5 px-4">Oxirgi Kirish IP</th>
                <th className="py-3.5 px-4">Oxirgi Kirish Vaqti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {teamLoading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : (teamList || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Admin foydalanuvchilar topilmadi
                  </td>
                </tr>
              ) : (
                (teamList || []).map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">@{a.username}</td>
                    <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">{a.email}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${
                        a.role === 'superadmin'
                          ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800'
                          : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                      }`}>
                        {a.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                      {a.last_login_ip || '127.0.0.1'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-500 dark:text-gray-400 text-[11px]">
                      {a.last_login ? new Date(a.last_login).toLocaleString('uz-UZ') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IP Whitelist Management Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                IP Manzil Xavfsizligi (IP Whitelist Guard)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Faqat ko'rsatilgan IP-manzillardan Admin panelga kirishga ruxsat beriladi
              </p>
            </div>
          </div>
        </div>

        {/* Add IP Form */}
        <form onSubmit={handleAddIpSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={newIpAddress}
            onChange={(e) => setNewIpAddress(e.target.value)}
            placeholder="IP Manzil (masalan, 178.218.201.50)"
            className="p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <input
            type="text"
            value={newIpDesc}
            onChange={(e) => setNewIpDesc(e.target.value)}
            placeholder="Tavsif (Masalan: Uy / Ofis IP)"
            className="p-3 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />

          <button
            type="submit"
            disabled={addIpMutation.isPending}
            className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2 min-h-[42px] disabled:opacity-50 active:scale-95"
          >
            <PlusIcon className="w-4 h-4" />
            <span>+ IP Ruxsatnomasini Qo'shish</span>
          </button>
        </form>

        {/* Allowed IP Table */}
        <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-950/50">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-100/70 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Ruxsat etilgan IP Manzil</th>
                <th className="py-3 px-4 font-sans">Tavsif</th>
                <th className="py-3 px-4 font-sans">Biriktirgan Admin</th>
                <th className="py-3 px-4 font-sans text-right">O'chirish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {allowedLoading ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400 font-sans text-xs">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : (allowedIps || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-gray-400 font-sans text-xs">
                    IP Whitelist bo'sh (Defolt: Localhost hamda barcha IP lar ochiq)
                  </td>
                </tr>
              ) : (
                (allowedIps || []).map((ip) => (
                  <tr key={ip.id} className="hover:bg-gray-100/60 dark:hover:bg-gray-900/60 transition">
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">{ip.ip_address}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-sans">{ip.description || '—'}</td>
                    <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400 font-sans">@{ip.created_by || 'superadmin'}</td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => setDeleteIpModal({ open: true, ip })}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 transition inline-flex items-center gap-1"
                        title="O'chirish"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blocked IPs Management Section */}
      <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400">
              <ShieldExclamationIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Avtomatik Bloklangan IP-lar
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Ruxsatsiz kirish urinishida avtomatik bloklangan IP-manzillar
              </p>
            </div>
          </div>
        </div>

        <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50/50 dark:bg-gray-950/50">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-100/70 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Bloklangan IP</th>
                <th className="py-3 px-4 font-sans">Sabab</th>
                <th className="py-3 px-4 font-sans">Urinish Qilgan Email</th>
                <th className="py-3 px-4 font-sans">Bloklangan Vaqt</th>
                <th className="py-3 px-4 font-sans text-right">Blokdan Chiqarish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {blockedLoading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400 font-sans text-xs">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : (blockedIps || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400 font-sans text-xs">
                    Bloklangan IP-lar yo'q. Tizim xavfsiz.
                  </td>
                </tr>
              ) : (
                (blockedIps || []).map((ip) => (
                  <tr key={ip.id} className="hover:bg-gray-100/60 dark:hover:bg-gray-900/60 transition">
                    <td className="py-3 px-4 text-red-600 dark:text-red-400 font-bold">{ip.ip_address}</td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-sans">{ip.reason || '—'}</td>
                    <td className="py-3 px-4 text-amber-600 dark:text-amber-400 font-sans">{ip.triggered_by_email || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-sans">
                      {ip.blocked_at ? new Date(ip.blocked_at).toLocaleString('uz-UZ') : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => setUnblockIpModal({ open: true, ip })}
                        className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 transition inline-flex items-center gap-1"
                        title="Blokdan chiqarish"
                      >
                        <CheckIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete IP Whitelist Modal */}
      {deleteIpModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-xl">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">IP Ruxsatnomasini O'chirish</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tasdiqlash talab etiladi</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Ushbu IP manzilni (<span className="font-mono font-bold text-red-500">{deleteIpModal.ip?.ip_address}</span>) ruxsat etilganlar ro'yxatidan o'chirishni tasdiqlaysizmi?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteIpModal({ open: false, ip: null })}
                className="flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs transition min-h-[42px]"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={deleteIpMutation.isPending}
                onClick={() => deleteIpMutation.mutate(deleteIpModal.ip?.id)}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition min-h-[42px] disabled:opacity-50"
              >
                {deleteIpMutation.isPending ? "O'chirilmoqda..." : "Ha, O'chirilsin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock IP Modal */}
      {unblockIpModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-500 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
                <ShieldCheckIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">IP Manzilni Blokdan Chiqarish</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tasdiqlash talab etiladi</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Ushbu IP manzilni (<span className="font-mono font-bold text-emerald-500">{unblockIpModal.ip?.ip_address}</span>) blokdan chiqarishni tasdiqlaysizmi?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnblockIpModal({ open: false, ip: null })}
                className="flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs transition min-h-[42px]"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={unblockIpMutation.isPending}
                onClick={() => unblockIpMutation.mutate(unblockIpModal.ip?.id)}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition min-h-[42px] disabled:opacity-50"
              >
                {unblockIpMutation.isPending ? "Jarayonda..." : "Blokdan Chiqarish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Admin Modal */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-3">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Yangi Admin Biriktirish
              </h3>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg transition"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Username:</label>
                <input
                  type="text"
                  required
                  value={teamForm.username}
                  onChange={(e) => setTeamForm({ ...teamForm, username: e.target.value })}
                  placeholder="new_admin"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Email:</label>
                <input
                  type="email"
                  required
                  value={teamForm.email}
                  onChange={(e) => setTeamForm({ ...teamForm, email: e.target.value })}
                  placeholder="admin@fragmently-api.uz"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Parol:</label>
                <input
                  type="password"
                  required
                  value={teamForm.password}
                  onChange={(e) => setTeamForm({ ...teamForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-gray-600 dark:text-gray-400 mb-1">Admin Roli:</label>
                <select
                  value={teamForm.role}
                  onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value })}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="admin">Admin (Kundalik Boshqaruv)</option>
                  <option value="support">Support (Faqat ko'rish va Refund)</option>
                  <option value="superadmin">Superadmin (To'liq Ruxsat)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={createAdminMutation.isPending}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition min-h-[44px] disabled:opacity-50"
                >
                  {createAdminMutation.isPending ? 'Yaratilmoqda...' : 'Admin Yaratish'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition min-h-[44px]"
                >
                  Bekor qilish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

