import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { ShieldAlert, Ban, Lock, Plus, Trash2, Globe, AlertTriangle, History, Mail } from 'lucide-react';

const isValidIPv4 = (ip) => {
  const regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return regex.test((ip || '').trim());
};

const LOGIN_STATUS_LABELS = {
  SUCCESS_GOOGLE: { label: 'Muvaffaqiyatli (Google)', cls: 'bg-emerald-500/10 text-emerald-400' },
  SUCCESS: { label: 'Muvaffaqiyatli', cls: 'bg-emerald-500/10 text-emerald-400' },
  '2FA_SUCCESS': { label: '2FA muvaffaqiyatli', cls: 'bg-emerald-500/10 text-emerald-400' },
  FORBIDDEN_NOT_WHITELISTED: { label: 'Ruxsatsiz email', cls: 'bg-red-500/10 text-red-400' },
  FORBIDDEN_EMAIL_BLOCKED: { label: 'Bloklangan email', cls: 'bg-red-500/10 text-red-400' },
  FORBIDDEN_IP: { label: 'IP ruxsat etilmagan', cls: 'bg-amber-500/10 text-amber-400' },
  FORBIDDEN_NO_ALLOWED_EMAILS: { label: 'Whitelist sozlanmagan', cls: 'bg-amber-500/10 text-amber-400' },
  RATE_LIMITED_BLOCKED: { label: 'Rate-limit blok', cls: 'bg-red-500/10 text-red-400' },
  PASSWORD_LOGIN_REJECTED: { label: 'Parol taqiqlangan', cls: 'bg-red-500/10 text-red-400' },
  PASSWORD_BRUTE_FORCE_BLOCKED: { label: 'Parol brute-force', cls: 'bg-red-500/10 text-red-400' },
  '2FA_FAILED': { label: "2FA noto'g'ri", cls: 'bg-amber-500/10 text-amber-400' },
  '2FA_BRUTE_FORCE_BLOCKED': { label: '2FA brute-force', cls: 'bg-red-500/10 text-red-400' },
};

const statusInfo = (s) => LOGIN_STATUS_LABELS[s] || { label: s || '—', cls: 'bg-gray-500/10 text-gray-400' };

export default function AdminSecurity() {
  const queryClient = useQueryClient();
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newIpDesc, setNewIpDesc] = useState('');
  const [deleteModal, setDeleteModal] = useState({ open: false, ip: null });
  const [blockIpForm, setBlockIpForm] = useState({ ip_address: '', reason: '' });
  const [blockEmailForm, setBlockEmailForm] = useState({ email: '', reason: '' });
  const [unblockModal, setUnblockModal] = useState({ open: false, entry: null });

  const { data: blockedIps, isLoading: blockedLoading } = useQuery({
    queryKey: ['admin-blocked-ips'],
    queryFn: () => api.get('/api/admin/blocked-ips').then((res) => res.data),
  });

  const { data: allowedIps, isLoading: allowedLoading } = useQuery({
    queryKey: ['admin-allowed-ips'],
    queryFn: () => api.get('/api/admin/allowed-ips').then((res) => res.data),
  });

  const { data: loginLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-login-logs'],
    queryFn: () => api.get('/api/admin/login-logs').then((res) => res.data),
  });

  const { data: blockedEmails, isLoading: blockedEmailsLoading } = useQuery({
    queryKey: ['admin-blocked-emails'],
    queryFn: () => api.get('/api/admin/blocked-emails').then((res) => res.data),
  });

  const blockedItems = [
    ...(blockedIps || []).map((ip) => ({
      key: `ip-${ip.id}`,
      type: 'ip',
      id: ip.id,
      value: ip.ip_address,
      reason: ip.reason || 'Avtomatik bloklash',
      until: ip.blocked_until,
      blockedAt: ip.blocked_at,
      blockedBy: ip.triggered_by_email || null,
    })),
    ...(blockedEmails || []).map((em) => ({
      key: `email-${em.id}`,
      type: 'email',
      id: em.id,
      value: em.email,
      reason: em.reason || 'Admin tomonidan bloklandi',
      until: null,
      blockedAt: em.blocked_at,
      blockedBy: em.blocked_by || null,
    })),
  ];

  const addIpMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/allowed-ips', data),
    onSuccess: (res) => {
      toast.success(res.data?.message || "IP manzil ruxsat etilganlar ro'yxatiga qo'shildi");
      setNewIpAddress('');
      setNewIpDesc('');
      queryClient.invalidateQueries({ queryKey: ['admin-allowed-ips'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP qo'shishda xatolik"),
  });

  const deleteIpMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/admin/allowed-ips/${id}`),
    onSuccess: (res) => {
      toast.success(res.data?.message || "IP manzil o'chirildi");
      setDeleteModal({ open: false, ip: null });
      queryClient.invalidateQueries({ queryKey: ['admin-allowed-ips'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP o'chirishda xatolik"),
  });

  const unblockIpMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/admin/blocked-ips/${id}`),
    onSuccess: (res) => {
      toast.success(res.data?.message || "IP blokdan chiqarildi");
      setUnblockModal({ open: false, entry: null });
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-ips'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP blokdan chiqarishda xatolik"),
  });

  const blockIpMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/blocked-ips', data),
    onSuccess: (res) => {
      toast.success(res.data?.message || "IP manzil bloklandi");
      setBlockIpForm({ ip_address: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-ips'] });
      queryClient.invalidateQueries({ queryKey: ['admin-login-logs'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP bloklashda xatolik"),
  });

  const blockEmailMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/blocked-emails', data),
    onSuccess: (res) => {
      toast.success(res.data?.message || "Email manzil bloklandi");
      setBlockEmailForm({ email: '', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-emails'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Email bloklashda xatolik"),
  });

  const unblockEmailMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/admin/blocked-emails/${id}`),
    onSuccess: (res) => {
      toast.success(res.data?.message || "Email blokdan chiqarildi");
      setUnblockModal({ open: false, entry: null });
      queryClient.invalidateQueries({ queryKey: ['admin-blocked-emails'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Email blokdan chiqarishda xatolik"),
  });

  const handleAddIp = (e) => {
    e.preventDefault();
    if (!newIpAddress || !isValidIPv4(newIpAddress)) {
      toast.error("To'g'ri IPv4 manzilini kiriting (Masalan: 178.218.201.50)");
      return;
    }
    addIpMutation.mutate({ ip_address: newIpAddress.trim(), description: newIpDesc.trim() || "Admin IP" });
  };

  const handleBlockIp = (e) => {
    e.preventDefault();
    if (!blockIpForm.ip_address || !isValidIPv4(blockIpForm.ip_address)) {
      toast.error("To'g'ri IPv4 manzilini kiriting (Masalan: 178.218.201.50)");
      return;
    }
    blockIpMutation.mutate({
      ip_address: blockIpForm.ip_address.trim(),
      reason: blockIpForm.reason.trim() || "Admin tomonidan qo'lda bloklandi",
    });
  };

  const handleBlockEmail = (e) => {
    e.preventDefault();
    if (!blockEmailForm.email || !blockEmailForm.email.includes('@')) {
      toast.error("To'g'ri email manzilini kiriting");
      return;
    }
    blockEmailMutation.mutate({
      email: blockEmailForm.email.trim(),
      reason: blockEmailForm.reason.trim() || "Admin tomonidan bloklandi",
    });
  };

  const handleConfirmUnblock = () => {
    if (!unblockModal.entry) return;
    if (unblockModal.entry.type === 'ip') {
      unblockIpMutation.mutate(unblockModal.entry.id);
    } else {
      unblockEmailMutation.mutate(unblockModal.entry.id);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-1.5 h-8 rounded-full bg-red-500 inline-block"></span>
          Kirish Xavfsizligi & IP Whitelist
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Admin panel kirish xavfsizligi, kirish tarixi, IP/email bloklash va whitelist boshqaruvi
        </p>
      </div>

      <div className="space-y-6">
        {/* Allowed IPs / Whitelist */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">IP Whitelist (Ruxsat etilgan)</h3>
              <p className="text-xs text-gray-400">Faqat shu IP manzillar admin panelga kira oladi</p>
            </div>
          </div>

          <form onSubmit={handleAddIp} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newIpAddress}
              onChange={(e) => setNewIpAddress(e.target.value)}
              placeholder="IP manzil (masalan: 178.218.201.50)"
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition font-mono"
            />
            <input
              type="text"
              value={newIpDesc}
              onChange={(e) => setNewIpDesc(e.target.value)}
              placeholder="Tavsif"
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition"
            />
            <button
              type="submit"
              disabled={addIpMutation.isPending}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-1.5 min-h-[40px] disabled:opacity-50 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Qo'shish</span>
            </button>
          </form>

          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {allowedLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">Yuklanmoqda...</p>
            ) : (allowedIps || []).length > 0 ? (
              allowedIps.map((ip) => (
                <div key={ip.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-400">{ip.ip_address}</p>
                    <p className="text-xs text-gray-400 truncate">{ip.description || '—'} · @{ip.created_by || 'superadmin'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteModal({ open: true, ip })}
                    className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-950/50 transition shrink-0"
                    title="O'chirish"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">Ruxsat etilgan IP mavjud emas (Localhost ochiq)</p>
            )}
          </div>
        </div>

      </div>

      {/* Login History / Kirish Tarixi */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 shadow-md">
            <History className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Kirish Tarixi (Login Logs)</h3>
            <p className="text-xs text-gray-400">Oxirgi kirish urinishlari — istalmagan email/IP aniqlansa darhol bloklang</p>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-100/70 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Email / Username</th>
                <th className="py-3 px-4">IP Manzil</th>
                <th className="py-3 px-4 font-sans">Holat</th>
                <th className="py-3 px-4 font-sans">Vaqt</th>
                <th className="py-3 px-4 font-sans text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {logsLoading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400 font-sans text-xs">Yuklanmoqda...</td>
                </tr>
              ) : (loginLogs || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-gray-400 font-sans text-xs">Login tarixi hozircha bo'sh</td>
                </tr>
              ) : (
                (loginLogs || []).map((log) => {
                  const info = statusInfo(log.status);
                  const isEmail = String(log.username || '').includes('@');
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition">
                      <td className="py-3 px-4 text-gray-900 dark:text-white font-bold break-all">{log.username}</td>
                      <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400 break-all">{log.ip_address || '—'}</td>
                      <td className="py-3 px-4 font-sans">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase ${info.cls}`}>{info.label}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-sans text-[11px]">
                        {log.created_at ? new Date(log.created_at).toLocaleString('uz-UZ') : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                        <button
                          type="button"
                          disabled={!isEmail}
                          onClick={() => blockEmailMutation.mutate({ email: log.username.trim(), reason: "Login tarixidan bloklandi" })}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-[11px] transition disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isEmail ? "Bu emailni Admin Panel uchun bloklash" : "Faqat email manzillar bloklanadi"}
                        >
                          Email bloklash
                        </button>
                        <button
                          type="button"
                          disabled={!log.ip_address}
                          onClick={() => blockIpMutation.mutate({ ip_address: log.ip_address.trim(), reason: `Login tarixidan bloklandi (${log.username})` })}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-[11px] transition disabled:opacity-40 disabled:cursor-not-allowed ml-1.5"
                          title="Bu IP manzilni bloklash"
                        >
                          IP bloklash
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Birlashtirilgan Bloklanganlar Ro'yxati (IP + Email) */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 shadow-md">
              <Ban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bloklanganlar Ro'yxati</h3>
              <p className="text-xs text-gray-400">Bloklangan IP-lar va emaillar — bir joyda</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Jami: {blockedItems.length} ta</span>
        </div>

        <div className="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-gray-100/70 dark:bg-gray-900 text-gray-500 dark:text-gray-400 uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Tur</th>
                <th className="py-3 px-4">Qiymat</th>
                <th className="py-3 px-4 font-sans">Sabab</th>
                <th className="py-3 px-4 font-sans">Bloklangan Vaqt</th>
                <th className="py-3 px-4 font-sans">Bloklagan</th>
                <th className="py-3 px-4 font-sans text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {blockedLoading || blockedEmailsLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400 font-sans text-xs">Yuklanmoqda...</td>
                </tr>
              ) : blockedItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-400 font-sans text-xs">
                    Hech narsa bloklanmagan — hammasi xavfsiz
                  </td>
                </tr>
              ) : (
                blockedItems.map((item) => (
                  <tr key={item.key} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition">
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-extrabold uppercase ${
                        item.type === 'ip'
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-purple-500/10 text-purple-400'
                      }`}>
                        {item.type === 'ip' ? 'IP' : 'Email'}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-bold break-all ${
                      item.type === 'ip' ? 'text-red-700 dark:text-red-400' : 'text-purple-700 dark:text-purple-400'
                    }`}>
                      {item.value}
                    </td>
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300 font-sans">
                      {item.reason}
                      {item.until ? ` · ${new Date(item.until).toLocaleString('uz-UZ')}gacha` : ''}
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 font-sans text-[11px]">
                      {item.blockedAt ? new Date(item.blockedAt).toLocaleString('uz-UZ') : '—'}
                    </td>
                    <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400 font-sans">{item.blockedBy || '—'}</td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => setUnblockModal({ open: true, entry: { type: item.type, id: item.id, value: item.value } })}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition shrink-0"
                      >
                        Blokdan chiqarish
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Block: Email + IP */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 shadow-md">
            <Ban className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Qo'lda Bloklash</h3>
            <p className="text-xs text-gray-400">Email yoki IP manzilni darhol qo'lda bloklang</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Block Email */}
          <form onSubmit={handleBlockEmail} className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">Email bloklash</p>
            <input
              type="text"
              value={blockEmailForm.email}
              onChange={(e) => setBlockEmailForm({ ...blockEmailForm, email: e.target.value })}
              placeholder="qandaydir@email.com"
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 outline-none transition"
            />
            <input
              type="text"
              value={blockEmailForm.reason}
              onChange={(e) => setBlockEmailForm({ ...blockEmailForm, reason: e.target.value })}
              placeholder="Sabab (ixtiyoriy)"
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 outline-none transition"
            />
            <button
              type="submit"
              disabled={blockEmailMutation.isPending}
              className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 min-h-[38px]"
            >
              {blockEmailMutation.isPending ? 'Bloklanmoqda...' : 'Emailni Bloklash'}
            </button>
          </form>

          {/* Block IP */}
          <form onSubmit={handleBlockIp} className="space-y-2 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">IP manzilni bloklash</p>
            <input
              type="text"
              value={blockIpForm.ip_address}
              onChange={(e) => setBlockIpForm({ ...blockIpForm, ip_address: e.target.value })}
              placeholder="178.218.201.50"
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 outline-none transition"
            />
            <input
              type="text"
              value={blockIpForm.reason}
              onChange={(e) => setBlockIpForm({ ...blockIpForm, reason: e.target.value })}
              placeholder="Sabab (ixtiyoriy)"
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 outline-none transition"
            />
            <button
              type="submit"
              disabled={blockIpMutation.isPending}
              className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 min-h-[38px]"
            >
              {blockIpMutation.isPending ? 'Bloklanmoqda...' : 'IPni Bloklash'}
            </button>
          </form>
        </div>
      </div>

      {/* Blokdan Chiqarish Modal (IP + Email) */}
      {unblockModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-500 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Blokdan Chiqarish</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tasdiqlash talab etiladi</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Ushbu {unblockModal.entry?.type === 'ip' ? 'IP manzilni' : 'emailni'} (
              <span className="font-mono font-bold text-emerald-500">{unblockModal.entry?.value}</span>) blokdan chiqarishni tasdiqlaysizmi?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnblockModal({ open: false, entry: null })}
                className="flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs transition min-h-[42px]"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={unblockIpMutation.isPending || unblockEmailMutation.isPending}
                onClick={handleConfirmUnblock}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition min-h-[42px] disabled:opacity-50"
              >
                {(unblockIpMutation.isPending || unblockEmailMutation.isPending) ? "Jarayonda..." : "Blokdan Chiqarish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete IP Modal */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500 border-b border-gray-100 dark:border-gray-800 pb-3">
              <div className="p-2 bg-red-50 dark:bg-red-950/40 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">IP Ruxsatnomasini O'chirish</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tasdiqlash talab etiladi</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Ushbu IP manzilni (<span className="font-mono font-bold text-red-500">{deleteModal.ip?.ip_address}</span>) ruxsat etilganlar ro'yxatidan o'chirishni tasdiqlaysizmi?
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ open: false, ip: null })}
                className="flex-1 py-2.5 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold text-xs transition min-h-[42px]"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                disabled={deleteIpMutation.isPending}
                onClick={() => deleteIpMutation.mutate(deleteModal.ip?.id)}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold text-xs transition min-h-[42px] disabled:opacity-50"
              >
                {deleteIpMutation.isPending ? "O'chirilmoqda..." : "Ha, O'chirilsin"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security info banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex items-start gap-3">
          <Lock className="w-5 h-5 text-indigo-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">JWT Autentifikatsiya</p>
            <p className="text-xs text-gray-400 mt-0.5">Har bir so'rov Bearer token bilan himoyalangan</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Rate Limiting</p>
            <p className="text-xs text-gray-400 mt-0.5">Brute-force hujumlaridan avtomatik himoya</p>
          </div>
        </div>
      </div>
    </div>
  );
}

