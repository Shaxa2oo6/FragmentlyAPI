import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import {
  CreditCardIcon,
  PencilSquareIcon,
  WalletIcon,
  ShieldCheckIcon,
  PlusIcon,
  TrashIcon,
  UserPlusIcon,
  ExclamationTriangleIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

const inputCls =
  'w-full bg-white dark:bg-slate-800/60 border border-gray-300 dark:border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-all';
const textareaCls =
  'w-full bg-white dark:bg-slate-800/60 border border-gray-300 dark:border-slate-700/80 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none transition-all resize-none';
const labelCls = 'text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 block';

export default function AdminTariffs() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('commission'); // 'commission', 'wallet', 'security'

  // Tab 1: Commission & Tariff States
  const [editingTariff, setEditingTariff] = useState(null);
  const [confirmModalData, setConfirmModalData] = useState(null);
  const [createTariffModal, setCreateTariffModal] = useState(false);
  const [deleteTariffTarget, setDeleteTariffTarget] = useState(null);
  const [tariffForm, setTariffForm] = useState({
    name: '',
    price_gram: 0,
    price_usdt: 0,
    commission_percent: 5.0,
    rate_limit_per_min: 60,
    description: '',
    duration_days: 30,
    features_text: '',
    badge: '',
    is_active: true,
  });
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    price_gram: 0,
    price_usdt: 0,
    commission_percent: 5.0,
    rate_limit_per_min: 60,
    duration_days: 30,
    features_text: '',
    badge: '',
  });

  // Tab 2: Wallet Change States
  const [seedPhrase, setSeedPhrase] = useState('');
  const [seedWalletType, setSeedWalletType] = useState('v4R2');
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);

  // Tab 3: Security & IP Whitelist States
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newIpDesc, setNewIpDesc] = useState('');

  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('admin');

  // Queries
  const { data: tariffs, isLoading: isTariffsLoading } = useQuery({
    queryKey: ['admin-tariffs'],
    queryFn: () => api.get('/api/admin/settings/commission').then((res) => res.data),
  });

  const { data: platformWallet, isLoading: isWalletLoading } = useQuery({
    queryKey: ['admin-platform-wallet'],
    queryFn: () => api.get('/api/admin/settings/wallet').then((res) => res.data),
  });

  const { data: allowedIps, isLoading: isIpsLoading } = useQuery({
    queryKey: ['admin-allowed-ips'],
    queryFn: () => api.get('/api/admin/settings/ip-whitelist').then((res) => res.data),
  });

  const { data: adminUsers, isLoading: isAdminUsersLoading } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => api.get('/api/admin/settings/admin-users').then((res) => res.data),
  });

  // Mutations
  const updateCommissionMutation = useMutation({
    mutationFn: (data) => api.put('/api/admin/settings/commission', data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setConfirmModalData(null);
      setEditingTariff(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Komissiyani o'zgartirishda xatolik"),
  });

  const updateTariffFullMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/api/v1/admin/tariffs/${id}`, data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setEditingTariff(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Tarifni yangilashda xatolik"),
  });

  const createTariffMutation = useMutation({
    mutationFn: (data) => api.post('/api/v1/admin/tariffs', data),
    onSuccess: (res) => {
      toast.success(res.data.message || "Yangi tarif yaratildi");
      setCreateTariffModal(false);
      setCreateForm({ name: '', description: '', price_gram: 0, price_usdt: 0, commission_percent: 5.0, rate_limit_per_min: 60, duration_days: 30, features_text: '', badge: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Tarif yaratishda xatolik"),
  });

  const deleteTariffMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/v1/admin/tariffs/${id}`),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setDeleteTariffTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Tarifni o'chirishda xatolik"),
  });

  const connectSeedMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/platform-wallet/connect-seed', data),
    onSuccess: (res) => {
      toast.success(res.data.message || "Platforma hamyoni seed-phrase orqali ulandi");
      setSeedPhrase('');
      setShowSeedConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['admin-platform-wallet'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Seed-phrase ulashda xatolik"),
  });

  const disconnectSeedMutation = useMutation({
    mutationFn: () => api.post('/api/admin/platform-wallet/disconnect-seed'),
    onSuccess: (res) => {
      toast.success(res.data.message || "Seed-phrase bog'lanish bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ['admin-platform-wallet'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Bog'lanishni bekor qilishda xatolik"),
  });

  const addIpMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/settings/ip-whitelist', data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setNewIpAddress('');
      setNewIpDesc('');
      queryClient.invalidateQueries({ queryKey: ['admin-allowed-ips'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP qo'shishda xatolik"),
  });

  const deleteIpMutation = useMutation({
    mutationFn: (id) => api.delete(`/api/admin/settings/ip-whitelist/${id}`),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-allowed-ips'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "IP o'chirishda xatolik"),
  });

  const addAdminUserMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/settings/admin-users', data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setNewAdminEmail('');
      setNewAdminUsername('');
      queryClient.invalidateQueries({ queryKey: ['admin-users-list'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Admin qo'shishda xatolik"),
  });

  // Handlers
  const handleStartEdit = (t) => {
    setEditingTariff(t);
    setTariffForm({
      name: t.name,
      price_gram: t.price_gram,
      price_usdt: t.price_usdt,
      commission_percent: t.commission_percent,
      rate_limit_per_min: t.rate_limit_per_min,
      description: t.description || '',
      duration_days: t.duration_days || 30,
      features_text: Array.isArray(t.features) ? t.features.join('\n') : (t.features || ''),
      badge: t.badge || '',
      is_active: t.is_active !== false,
    });
  };

  const handleCreateTariffSubmit = (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      toast.error("Tarif nomini kiriting");
      return;
    }
    createTariffMutation.mutate({
      name: createForm.name.trim(),
      description: createForm.description || null,
      price_gram: parseFloat(createForm.price_gram) || 0,
      price_usdt: parseFloat(createForm.price_usdt) || 0,
      commission_percent: parseFloat(createForm.commission_percent) ?? 5.0,
      rate_limit_per_min: parseInt(createForm.rate_limit_per_min, 10) || 60,
      duration_days: parseInt(createForm.duration_days, 10) || 30,
      features: createForm.features_text.split('\n').map((s) => s.trim()).filter(Boolean),
      badge: createForm.badge.trim() || null,
    });
  };

  const handleDeleteTariffConfirm = () => {
    if (!deleteTariffTarget) return;
    deleteTariffMutation.mutate(deleteTariffTarget.id);
  };

  const handleConnectSeedSubmit = (e) => {
    e.preventDefault();
    const wordCount = seedPhrase.trim().split(/\s+/).length;
    if (wordCount !== 24) {
      toast.error(`Seed-phrase faqat 24 so'zdan iborat bo'lishi kerak (topildi: ${wordCount})`);
      return;
    }
    setShowSeedConfirm(true);
  };

  const handleExecuteConnectSeed = () => {
    connectSeedMutation.mutate({
      seed_phrase: seedPhrase.trim(),
      wallet_type: seedWalletType,
    });
  };

  const handlePromptCommissionConfirm = (e) => {
    e.preventDefault();
    if (!editingTariff) return;
    setConfirmModalData({
      tariff: editingTariff,
      oldCommission: editingTariff.commission_percent,
      newCommission: tariffForm.commission_percent,
      form: tariffForm,
    });
  };

  const buildTariffPayload = (form) => ({
    name: form.name.trim(),
    price_gram: parseFloat(form.price_gram) || 0,
    price_usdt: parseFloat(form.price_usdt) || 0,
    commission_percent: parseFloat(form.commission_percent) || 0,
    rate_limit_per_min: parseInt(form.rate_limit_per_min, 10) || 60,
    duration_days: parseInt(form.duration_days, 10) || 30,
    description: form.description || null,
    features: form.features_text.split('\n').map((s) => s.trim()).filter(Boolean),
    badge: form.badge.trim() || null,
    is_active: form.is_active !== false,
    is_archived: form.is_active !== false ? false : undefined,
  });

  const handleExecuteCommissionUpdate = () => {
    if (!confirmModalData) return;
    updateCommissionMutation.mutate({
      tariff_name: confirmModalData.form.name.trim(),
      commission_percent: confirmModalData.newCommission,
    });
    updateTariffFullMutation.mutate({
      id: confirmModalData.tariff.id,
      data: buildTariffPayload(confirmModalData.form),
    });
  };

  const handleAddIpSubmit = (e) => {
    e.preventDefault();
    if (!newIpAddress || newIpAddress.length < 7) {
      toast.error("IP manzilni kiriting");
      return;
    }
    addIpMutation.mutate({ ip_address: newIpAddress, description: newIpDesc });
  };

  const handleAddAdminSubmit = (e) => {
    e.preventDefault();
    if (!newAdminEmail.includes('@')) {
      toast.error("Email manzilni kiriting");
      return;
    }
    addAdminUserMutation.mutate({
      email: newAdminEmail,
      username: newAdminUsername || newAdminEmail.split('@')[0],
      role: newAdminRole,
    });
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight break-words">
          Tarif va Komissiya Sozlamalari (Control Center)
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">
          Komissiya foizlarini, platforma payout hamyonini va backend xavfsizlik hamda IP whitelist sozlamalarini boshqaring.
        </p>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('commission')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition shrink-0 ${
            activeTab === 'commission'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
              : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <CreditCardIcon className="w-4 h-4" />
          <span>Komissiya & Tarif Foizlari</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('wallet')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition shrink-0 ${
            activeTab === 'wallet'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
              : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <WalletIcon className="w-4 h-4" />
          <span>Platforma Hamyon Manzili</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition shrink-0 ${
            activeTab === 'security'
              ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
              : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          <ShieldCheckIcon className="w-4 h-4" />
          <span>Xavfsizlik & IP Whitelist</span>
        </button>
      </div>

      {/* TAB 1: COMMISSION & TARIFF RATES */}
      {activeTab === 'commission' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-300 flex-1 min-w-[280px]">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-indigo-400 shrink-0" />
                <span>
                  Har bir tarif komissiyasi va so'rov limitlari backend `PUT /api/admin/settings/commission` orqali darhol kuchga kiradi.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreateTariffModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition shadow-lg shadow-primary-500/20 shrink-0"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Yangi Tarif Qo'shish</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {isTariffsLoading ? (
              <div className="col-span-3 text-center py-8 text-xs text-gray-500">Tariflar yuklanmoqda...</div>
            ) : (
              (tariffs || []).map((t) => (
                <div
                  key={t.id}
                  className={`bg-white dark:bg-gray-900 border rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden transition ${
                    t.is_archived
                      ? 'border-gray-200 dark:border-gray-800 opacity-50'
                      : t.name === 'Pro'
                      ? 'border-amber-500/40 bg-gradient-to-b from-white dark:from-gray-900 via-white dark:via-gray-900 to-amber-50 dark:to-amber-950/20'
                      : t.name === 'Lite'
                      ? 'border-indigo-500/40 bg-gradient-to-b from-white dark:from-gray-900 via-white dark:via-gray-900 to-indigo-50 dark:to-indigo-950/20'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white truncate">{t.name} Plan</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border shrink-0 ${
                            t.is_archived
                              ? 'bg-gray-700/30 text-gray-400 border-gray-600'
                              : t.is_active === false
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {t.is_archived ? 'Arxivlangan' : t.is_active === false ? 'Nofaol' : 'Faol'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(t)}
                        className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-indigo-500 dark:text-indigo-400 transition"
                        title="Komissiya & Narxlarni Tahrirlash"
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                      </button>
                      {!t.is_archived && (
                        <button
                          type="button"
                          onClick={() => setDeleteTariffTarget(t)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
                          title="Tarifni o'chirish (arxivlash)"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800/80 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Joriy Komissiya (%):</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">{t.commission_percent}%</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Narx (TON / USDT):</span>
                      <span className="font-bold text-gray-900 dark:text-white font-mono">
                        {t.price_gram} TON / ${t.price_usdt}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Rate Limit:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-300 font-mono">{t.rate_limit_per_min} req / min</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Muddati:</span>
                      <span className="font-bold text-gray-900 dark:text-white font-mono">{t.duration_days || 30} kun</span>
                    </div>

                    {t.badge && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Badge:</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                          {t.badge}
                        </span>
                      </div>
                    )}

                    {Array.isArray(t.features) && t.features.length > 0 && (
                      <div className="pt-1">
                        <span className="text-gray-500 dark:text-gray-400 block mb-1">Xususiyatlar:</span>
                        <ul className="space-y-1">
                          {t.features.map((f, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-gray-700 dark:text-gray-300">
                              <CheckIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="leading-tight">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartEdit(t)}
                    className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-bold text-xs transition"
                  >
                    Komissiyani O'zgartirish
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PLATFORM WALLET MANAGEMENT */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl">
                  <WalletIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Platforma Hamyoni (24 so'zli seed-phrase)</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Barcha komissiyalar va tarif to'lovlari yig'iladigan rasmiy hamyon manzili</p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ● Live Active Payout Address
              </span>
            </div>

            <div className="bg-gray-100 dark:bg-gray-950 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">TON Manzil (TON / GRAM to'lovlar):</span>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <code className="text-xs font-mono text-emerald-600 dark:text-emerald-400 break-all bg-emerald-950/30 p-2 rounded-xl border border-emerald-500/30">
                    {platformWallet?.wallet_address || '— (hali ulanmagan — 24 so\'zli seed-phrase kiriting)'}
                  </code>
                  <div className="flex items-center gap-1.5 shrink-0 text-xs font-semibold text-emerald-500 dark:text-emerald-400">
                    <ShieldCheckIcon className="w-4 h-4" />
                    <span>Verified TON Address · {platformWallet?.wallet_type || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">USDT Manzil (USDT Jetton to'lovlar):</span>
                <code className="text-xs font-mono text-blue-600 dark:text-blue-400 break-all bg-blue-950/30 p-2 rounded-xl border border-blue-500/30 block">
                  {platformWallet?.usdt_wallet_address || '— (hali aniqlanmagan — seed-phrase ulanganda hisoblanadi)'}
                </code>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seed-Phrase Ulanish:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${
                    platformWallet?.seed_connected
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-gray-700/30 text-gray-400 border-gray-600'
                  }`}
                >
                  {platformWallet?.seed_connected ? 'Ulangan' : 'Ulanmagan'}
                </span>
                {platformWallet?.wallet_seed_hint && (
                  <code className="text-[10px] font-mono text-gray-500 break-all">{platformWallet.wallet_seed_hint}</code>
                )}
              </div>
            </div>
          </div>

          {/* Seed-Phrase orqali ulash (Double-wallet: TON + USDT) */}
          <div className="bg-white dark:bg-gray-900 border border-indigo-500/30 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheckIcon className="w-5 h-5 text-indigo-400" />
                24 So'zli Seed-Phrase Orqali Ulash (Double-Wallet)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                24 so'zli BIP39 seed-phrase kiriting — TON va USDT (Jetton) hamyon manzillari avtomatik
                hisoblanadi va shifrlangan holda saqlanadi. 2FA talab qilinmaydi.
              </p>
            </div>

            <form onSubmit={handleConnectSeedSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Seed-Phrase ({seedPhrase.trim() ? seedPhrase.trim().split(/\s+/).length : 0} ta so'z):
                </label>
                <textarea
                  rows={3}
                  required
                  value={seedPhrase}
                  onChange={(e) => setSeedPhrase(e.target.value)}
                  placeholder="24 ta so'zni bo'sh joy bilan kiriting..."
                  className="w-full p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Hamyon Turi:</label>
                <select
                  value={seedWalletType}
                  onChange={(e) => setSeedWalletType(e.target.value)}
                  className="w-full p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-primary-500"
                >
                  <option value="v4R2">v4R2 (standart — avtomatik tanlanadi)</option>
                  <option value="v5R1">v5R1 / W5</option>
                  <option value="v3R2">v3R2 (legacy)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={connectSeedMutation.isPending || seedPhrase.trim().split(/\s+/).length < 1}
                  className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition disabled:opacity-50 min-h-[44px]"
                >
                  {connectSeedMutation.isPending ? "Derivatsiya qilinmoqda..." : "Seed-Phrase Bilan Ulash"}
                </button>
                {platformWallet?.seed_connected && (
                  <button
                    type="button"
                    disabled={disconnectSeedMutation.isPending}
                    onClick={() => disconnectSeedMutation.mutate()}
                    className="px-4 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition disabled:opacity-50 min-h-[44px]"
                  >
                    {disconnectSeedMutation.isPending ? "Uzilmoqda..." : "Bog'lanishni Bekor Qilish"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY & IP WHITELIST */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* IP Whitelist Management (Section 3.4 & 4) */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheckIcon className="w-5 h-5 text-emerald-400" />
                  IP Whitelist Sozlamalari (Faqat Superadmin)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Backend har bir `/api/admin/*` so'rovida ruxsat etilgan IP manzillar ro'yxatini tekshiradi.
                </p>
              </div>
            </div>

            {/* Add IP Form */}
            <form onSubmit={handleAddIpSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <input
                type="text"
                required
                value={newIpAddress}
                onChange={(e) => setNewIpAddress(e.target.value)}
                placeholder="IP manzil (masalan: 178.218.201.50)"
                className="p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-mono"
              />
              <input
                type="text"
                value={newIpDesc}
                onChange={(e) => setNewIpDesc(e.target.value)}
                placeholder="Tavsif (masalan: Mir Notebook IP)"
                className="p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={addIpMutation.isPending}
                className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 min-h-[44px]"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Yangi IP Qo'shish</span>
              </button>
            </form>

            {/* IP Table */}
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 uppercase font-mono border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3">IP Manzil</th>
                    <th className="p-3">Tavsif</th>
                    <th className="p-3">Qo'shgan Admin</th>
                    <th className="p-3 text-right">Amal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60 font-mono">
                  {isIpsLoading ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-500">Yuklanmoqda...</td>
                    </tr>
                  ) : (allowedIps || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-500">Hali ruxsat etilgan IP mavjud emas (Localhost standart ruxsatda)</td>
                    </tr>
                  ) : (
                    (allowedIps || []).map((ip) => (
                      <tr key={ip.id} className="hover:bg-gray-100/60 dark:hover:bg-gray-800/40">
                        <td className="p-3 text-emerald-600 dark:text-emerald-400 font-bold">{ip.ip_address}</td>
                        <td className="p-3 text-gray-700 dark:text-gray-300 font-sans">{ip.description || '—'}</td>
                        <td className="p-3 text-indigo-600 dark:text-indigo-300">@{ip.created_by}</td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => deleteIpMutation.mutate(ip.id)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition"
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

          {/* Admin Users (admin_users table - Prompt 2.1 & 3.4) */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <UserPlusIcon className="w-5 h-5 text-indigo-400" />
                Ruxsat Etilgan Admin Foydalanuvchilar (`admin_users` jadvali)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Google OAuth orqali kirgan foydalanuvchi email manzili shu jadvalda bo'lishi shart!
              </p>
            </div>

            {/* Add Admin User Form */}
            <form onSubmit={handleAddAdminSubmit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <input
                type="email"
                required
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Google Email (masalan: admin@gmail.com)"
                className="p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-mono"
              />
              <input
                type="text"
                value={newAdminUsername}
                onChange={(e) => setNewAdminUsername(e.target.value)}
                placeholder="Username (masalan: ixtiyor)"
                className="p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-mono"
              />
              <select
                value={newAdminRole}
                onChange={(e) => setNewAdminRole(e.target.value)}
                className="p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold"
              >
                <option value="superadmin">Superadmin</option>
                <option value="admin">Admin</option>
                <option value="support">Support</option>
              </select>
              <button
                type="submit"
                disabled={addAdminUserMutation.isPending}
                className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 min-h-[44px]"
              >
                <UserPlusIcon className="w-4 h-4" />
                <span>Admin Qo'shish</span>
              </button>
            </form>

            {/* Admin Users Table */}
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 uppercase font-mono border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-3">Email</th>
                    <th className="p-3">Username</th>
                    <th className="p-3">Rol</th>
                    <th className="p-3">So'nggi Kirish</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800/60 font-mono">
                  {isAdminUsersLoading ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-500">Yuklanmoqda...</td>
                    </tr>
                  ) : (adminUsers || []).map((au) => (
                    <tr key={au.id} className="hover:bg-gray-100/60 dark:hover:bg-gray-800/40">
                      <td className="p-3 text-gray-900 dark:text-white font-bold">{au.email}</td>
                      <td className="p-3 text-indigo-600 dark:text-indigo-300">@{au.username}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {au.role}
                        </span>
                      </td>
                      <td className="p-3 text-gray-500 dark:text-gray-400 text-[11px]">
                        {au.last_login ? new Date(au.last_login).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL FOR COMMISSION CHANGES (Prompt 3.1) */}
      {confirmModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 border border-amber-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">O'zgarishni Tasdiqlash</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Komissiya stavkasini tasdiqlaysizmi?</p>
              </div>
            </div>

            <div className="p-4 bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                Haqiqatan ham <strong className="text-gray-900 dark:text-white">{confirmModalData.tariff.name}</strong> tarif komissiyasini{' '}
                <span className="text-red-400 font-mono font-bold">{confirmModalData.oldCommission}%</span> dan{' '}
                <span className="text-emerald-400 font-mono font-bold">{confirmModalData.newCommission}%</span> ga o'zgartirmoqchimisiz?
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 pt-1">
                Ushbu o'zgarish backend va barcha yangi tranzaksiyalar uchun audit log bilan darhol saqlanadi.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteCommissionUpdate}
                disabled={updateCommissionMutation.isPending}
                className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                {updateCommissionMutation.isPending ? 'Saqlanmoqda...' : 'Tasdiqlayman (Saqlash)'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmModalData(null)}
                className="px-4 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TARIFF EDIT MODAL */}
      {editingTariff && !confirmModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-slate-800/80 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight break-words">
                  Tarif Sozlamalarini Tahrirlash
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">{editingTariff.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTariff(null)}
                className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800/70 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition shrink-0"
              >
                <span className="sr-only">Yopish</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handlePromptCommissionConfirm} className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tarif Nomi</label>
                  <input
                    type="text"
                    required
                    value={tariffForm.name}
                    onChange={(e) => setTariffForm({ ...tariffForm, name: e.target.value })}
                    placeholder="masalan: Pro"
                    className={inputCls}
                  />
                </div>

                <div className="flex flex-col justify-end gap-1.5">
                  <label className="flex items-center justify-between w-full gap-3 rounded-xl border border-gray-300 dark:border-slate-700/80 bg-gray-100 dark:bg-slate-800/60 px-3.5 py-2.5 cursor-pointer">
                    <span className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wider">Tarif faol</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={tariffForm.is_active !== false}
                      onClick={() => setTariffForm({ ...tariffForm, is_active: !(tariffForm.is_active !== false) })}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        tariffForm.is_active !== false ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          tariffForm.is_active !== false ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                  {editingTariff.is_archived && (
                    <p className="text-[11px] leading-snug text-amber-500 dark:text-amber-400">
                      Ushbu tarif arxivlangan — "Tarif faol" yoqilsa avtomatik arxivdan chiqariladi va katalogda qayta ko'rinadi.
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Narxi (TON)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={tariffForm.price_gram}
                    onChange={(e) => setTariffForm({ ...tariffForm, price_gram: parseFloat(e.target.value) || 0 })}
                    placeholder="0.0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Narxi (USDT)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={tariffForm.price_usdt}
                    onChange={(e) => setTariffForm({ ...tariffForm, price_usdt: parseFloat(e.target.value) || 0 })}
                    placeholder="0.0"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Komissiya Ulushi (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    required
                    value={tariffForm.commission_percent}
                    onChange={(e) => setTariffForm({ ...tariffForm, commission_percent: parseFloat(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Rate Limit (req / min)</label>
                  <input
                    type="number"
                    min="1"
                    value={tariffForm.rate_limit_per_min}
                    onChange={(e) => setTariffForm({ ...tariffForm, rate_limit_per_min: parseInt(e.target.value) || 60 })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Muddati (kun)</label>
                  <input
                    type="number"
                    min="1"
                    value={tariffForm.duration_days}
                    onChange={(e) => setTariffForm({ ...tariffForm, duration_days: parseInt(e.target.value) || 30 })}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Badge</label>
                  <select
                    value={tariffForm.badge || ''}
                    onChange={(e) => setTariffForm({ ...tariffForm, badge: e.target.value })}
                    className={inputCls}
                  >
                    <option value="" className="bg-white dark:bg-slate-900">Yo'q</option>
                    <option value="standart" className="bg-white dark:bg-slate-900">Standart</option>
                    <option value="tezkor" className="bg-white dark:bg-slate-900">Tezkor</option>
                  <option value="vip" className="bg-white dark:bg-slate-900">VIP</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>Xususiyatlar</label>
                <textarea
                  rows={3}
                  value={tariffForm.features_text}
                  onChange={(e) => setTariffForm({ ...tariffForm, features_text: e.target.value })}
                  placeholder={"Daqiqasiga 30 ta so'rov\n2.5% komissiya\n30 kun faollik"}
                  className={textareaCls}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>Tavsif</label>
                <textarea
                  rows={2}
                  value={tariffForm.description}
                  onChange={(e) => setTariffForm({ ...tariffForm, description: e.target.value })}
                  placeholder="Tarif haqida qisqacha tavsif"
                  className={textareaCls}
                />
              </div>
              </div>

              <div className="sticky bottom-0 z-10 bg-white dark:bg-slate-900/95 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 px-6 py-4 flex flex-col-reverse sm:flex-row justify-end items-stretch sm:items-center gap-3 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingTariff(null)}
                  className="px-4 py-2.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition"
                >
                  Saqlash va Yangilash
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TARIFF MODAL */}
      {createTariffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900/95 backdrop-blur-md border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight">Yangi Tarif Yaratish</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Yangi tarif rejasini yarating</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateTariffModal(false)}
                className="p-2 rounded-xl bg-gray-100 dark:bg-slate-800/70 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition shrink-0"
              >
                <span className="sr-only">Yopish</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateTariffSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Tarif Nomi</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="masalan: Starter"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Badge</label>
                <select
                  value={createForm.badge || ''}
                  onChange={(e) => setCreateForm({ ...createForm, badge: e.target.value })}
                  className={inputCls}
                >
                  <option value="" className="bg-white dark:bg-slate-900">Yo'q</option>
                  <option value="standart" className="bg-white dark:bg-slate-900">Standart</option>
                  <option value="tezkor" className="bg-white dark:bg-slate-900">Tezkor</option>
                  <option value="vip" className="bg-white dark:bg-slate-900">VIP</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Narxi (TON)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={createForm.price_gram}
                  onChange={(e) => setCreateForm({ ...createForm, price_gram: e.target.value })}
                  placeholder="0.0"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Narxi (USDT)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={createForm.price_usdt}
                  onChange={(e) => setCreateForm({ ...createForm, price_usdt: e.target.value })}
                  placeholder="0.0"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Komissiya Ulushi (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={createForm.commission_percent}
                  onChange={(e) => setCreateForm({ ...createForm, commission_percent: e.target.value })}
                  placeholder="5.0"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Rate Limit (req / min)</label>
                <input
                  type="number"
                  min="1"
                  value={createForm.rate_limit_per_min}
                  onChange={(e) => setCreateForm({ ...createForm, rate_limit_per_min: e.target.value })}
                  placeholder="60"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Muddati (kun)</label>
                <input
                  type="number"
                  min="1"
                  value={createForm.duration_days}
                  onChange={(e) => setCreateForm({ ...createForm, duration_days: e.target.value })}
                  placeholder="30"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Tavsif</label>
                <input
                  type="text"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  placeholder="Tarif haqida qisqacha tavsif"
                  className={inputCls}
                />
              </div>

              <div className="md:col-span-2">
                <label className={labelCls}>Xususiyatlar</label>
                <textarea
                  rows={3}
                  value={createForm.features_text}
                  onChange={(e) => setCreateForm({ ...createForm, features_text: e.target.value })}
                  placeholder={"Daqiqasiga 30 ta so'rov\n2.5% komissiya\n30 kun faollik"}
                  className={textareaCls}
                />
              </div>

              <div className="md:col-span-2 sticky bottom-0 bg-white dark:bg-slate-900/95 backdrop-blur-md -mx-6 -mb-6 px-6 py-4 border-t border-gray-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row justify-end items-stretch sm:items-center gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setCreateTariffModal(false)}
                  className="px-4 py-2.5 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={createTariffMutation.isPending}
                  className="px-5 py-2.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {createTariffMutation.isPending ? "Yaratilmoqda..." : "Tarifni Yaratish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE TARIFF CONFIRM MODAL */}
      {deleteTariffTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 border border-red-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-2xl">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Tarifni O'chirish</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Bu amal orqaga qaytarilmaydi (arxivlash).</p>
              </div>
            </div>

            <p className="text-xs text-gray-700 dark:text-gray-300">
              <strong className="text-gray-900 dark:text-white">{deleteTariffTarget.name}</strong> tarifi{' '}
              <strong className="text-gray-900 dark:text-white">{deleteTariffTarget.price_gram} TON / ${deleteTariffTarget.price_usdt}</strong>{' '}
              narxlari bilan birga arxivlanadi va public katalogda endi ko'rinmaydi. Davom etasizmi?
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleDeleteTariffConfirm}
                disabled={deleteTariffMutation.isPending}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                {deleteTariffMutation.isPending ? "O'chirilmoqda..." : "Ha, O'chirish"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTariffTarget(null)}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEED CONNECT CONFIRM MODAL */}
      {showSeedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 border border-indigo-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-2xl">
                <ShieldCheckIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white">Seed-Phrase Ulashni Tasdiqlash</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Platforma hamyonini shu ibora bilan ulashni tasdiqlaysizmi?</p>
              </div>
            </div>

            <div className="p-4 bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                Seed-phrase (<strong className="text-gray-900 dark:text-white">{seedPhrase.trim().split(/\s+/).length} so'z</strong>) tekshirilib,
                TON va USDT manzillari hisoblanadi. Iboraning o'zi <strong className="text-gray-900 dark:text-white">shifrlangan holda</strong> saqlanadi
                va boshqa hech kimga ko'rinmaydi.
              </p>
              <code className="block text-[10px] font-mono text-gray-500 dark:text-gray-400 break-all bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-800">
                {seedPhrase.trim()}
              </code>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteConnectSeed}
                disabled={connectSeedMutation.isPending}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                {connectSeedMutation.isPending ? 'Derivatsiya qilinmoqda...' : 'Tasdiqlayman (Ulash)'}
              </button>
              <button
                type="button"
                onClick={() => setShowSeedConfirm(false)}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
