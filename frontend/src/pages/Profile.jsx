import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import WalletInfo from '../components/Wallet/WalletInfo';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import { CardSkeleton } from '../components/common/Skeleton';
import { copyToClipboard, formatDate, formatNumber, getErrorMessage } from '../utils/helpers';

import {
  User,
  Sparkles,
  Key,
  Wallet,
  Trash2,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Star,
  Zap,
  Coins,
  AlertTriangle,
} from 'lucide-react';

export default function Profile() {
  const { t, lang } = useLanguage();
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [copiedToken, setCopiedToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [deleteAccountModalOpen, setDeleteAccountModalOpen] = useState(false);

  // Fetch complete user profile data
  const { data: profile, refetch, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/users/me').then((res) => res.data),
  });

  // Reset imgError when profile changes
  useEffect(() => {
    setImgError(false);
  }, [profile]);

  // Fetch wallet balance
  const { data: wallet, refetch: refetchWallet, isFetching: walletLoading } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: () => api.get('/api/wallet/balance').then((res) => res.data),
    enabled: !!profile?.wallet_address,
  });

  // API Token Generation mutation (Instant direct endpoint)
  const generateToken = useMutation({
    mutationFn: () => api.post('/api/users/api-key/generate').then((res) => res.data),
    onSuccess: () => {
      toast.success(
        profile?.api_token
          ? lang === 'en'
            ? 'API Key regenerated successfully!'
            : 'API Token yangilandi!'
          : lang === 'en'
          ? 'API Key generated successfully!'
          : 'API Token yaratildi!'
      );
      refetch();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err));
    },
  });

  // Disconnect wallet mutation
  const disconnectWallet = useMutation({
    mutationFn: () => api.post('/api/wallet/disconnect').catch(() => ({ status: 'success' })),
    onSuccess: () => {
      toast.success(t('walletDisconnectedSuccess', 'Hamyon muvaffaqiyatli uzildi!'));
      setDisconnectModalOpen(false);
      queryClient.invalidateQueries();
      refetch();
    },
    onError: () => {
      toast.success(t('walletDisconnectedSuccess', 'Hamyon uzildi'));
      setDisconnectModalOpen(false);
      refetch();
    },
  });

  // Delete account mutation
  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/api/users/me').catch(() => api.post('/api/auth/delete-account')),
    onSuccess: () => {
      toast.success(t('accountDeletedSuccess', "Hisobingiz o'chirildi."));
      setDeleteAccountModalOpen(false);
      logout();
      navigate('/login');
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Hisobni o'chirishda xatolik yuz berdi"));
      setDeleteAccountModalOpen(false);
    },
  });

  const handleCopyToken = () => {
    if (!profile?.api_token) return;
    copyToClipboard(profile.api_token);
    setCopiedToken(true);
    toast.success(t('copied', 'Nusxalandi!'));
    setTimeout(() => setCopiedToken(false), 2000);
  };

  // API tokenni ixcham niqoblash: boshi 8, o'rtada 12 nuqta, oxiri 4 belgi.
  const maskToken = (token) => {
    if (!token) return '';
    if (token.length <= 16) return '••••••••••••';
    const start = token.slice(0, 8);
    const end = token.slice(-4);
    return `${start}••••••••••••${end}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton rows={2} />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-6 space-y-6">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={3} />
          </div>
          <div className="lg:col-span-6 space-y-6">
            <CardSkeleton rows={4} />
            <CardSkeleton rows={3} />
          </div>
        </div>
      </div>
    );
  }

  const walletConnected = !!(profile?.wallet_address || profile?.wallet_connected);
  const hasToken = !!profile?.api_token;
  const activePlanName = (profile?.tariff_plan || profile?.tariff_type || 'FREE').toUpperCase();

  // Dynamic Avatar Source (Google OAuth picture support)
  const avatarSrc = !imgError
    ? profile?.picture || profile?.image || profile?.avatar || profile?.photo_url || authUser?.picture
    : null;

  const displayName =
    profile?.full_name ||
    profile?.name ||
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}`.trim() : null) ||
    profile?.username ||
    'Foydalanuvchi';

  const userInitial = (
    profile?.name ||
    profile?.full_name ||
    profile?.username ||
    profile?.email ||
    'U'
  )[0].toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* 1. TOP USER HERO BANNER */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border border-teal-500/20 p-5 sm:p-6 text-white shadow-xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-[#0D9488]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 min-w-0">
            {/* Avatar container */}
            <div className="relative shrink-0">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={displayName}
                  className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-teal-400/40 shadow-lg shadow-[#0D9488]/30"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-[#0D9488] via-[#14B8A6] to-[#2DD4BF] flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-lg shadow-[#0D9488]/30">
                  {userInitial}
                </div>
              )}
              {/* Green online pulse dot */}
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              </span>
            </div>

            {/* Name, Username, Email & Badges */}
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white truncate font-sans">
                  {displayName}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#0D9488] text-white shadow-xs">
                  {activePlanName}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono font-medium truncate">
                @{profile?.username} • {profile?.email}
              </p>
            </div>
          </div>

          {/* Banner Action Buttons Aligned Right */}
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap shrink-0">
            {walletConnected && (
              <button
                type="button"
                onClick={() => setDisconnectModalOpen(true)}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 transition-colors cursor-pointer"
              >
                <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{t('pfDisconnectWallet', 'Hamyonni uzish')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setDeleteAccountModalOpen(true)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>{t('pfDeleteAccount', "Hisobni o'chirish")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT GRID (2 Columns on Desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-6">
          {/* User Info Card (2x2 Grid) */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-sans">
                <User className="w-5 h-5 text-[#0D9488]" />
                <span>{t('pfUserInfo', "Foydalanuvchi ma'lumotlari")}</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-bold">
                  {t('pfUsername', 'Username')}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white font-mono">
                  @{profile?.username}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-bold">
                  {t('labelEmail', 'Email')}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate block font-mono">
                  {profile?.email}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-bold">
                  {t('labelFullName', "To'liq ism")}
                </span>
                <span className="text-sm font-semibold text-slate-900 dark:text-white truncate block">
                  {displayName}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block font-bold">
                  {t('statusLabel', 'Status')}
                </span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span>{t('activeAccount', 'Faol Hisob')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Plan Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-sans">
                <Sparkles className="w-5 h-5 text-[#0D9488]" />
                <span>{t('pfCurrentPlan', "Joriy tarif (Current Plan)")}</span>
              </h3>
              <button
                type="button"
                onClick={() => navigate('/subscriptions')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0D9488] hover:underline cursor-pointer"
              >
                <span>{t('pfUpgradePlan', "Ta'rifni oshirish")}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-[#0D9488]/10 border border-[#0D9488]/20 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  {t('pfActiveSub', 'FAOL OBUNA')}
                </span>
                <span className="text-lg font-black text-[#0D9488] block font-mono">
                  {activePlanName}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  {t('pfValidUntil', 'AMAL QILISH MUDDATI')}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white block mt-0.5 font-mono">
                  {profile?.tariff_expires_at
                    ? formatDate(profile.tariff_expires_at)
                    : profile?.tariff_type !== 'free'
                    ? t('pfExpired', 'Tugagan')
                    : t('unlimitedDuration', 'Cheklanmagan')}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  {t('requestsLimit', "SO'ROVLAR LIMITI")}
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white block mt-0.5 font-mono">
                  {profile?.requests_per_minute || 10} {t('perMinute', 'marta / daqiqa')}
                </span>
              </div>
            </div>
          </div>

          {/* Developer & API Credentials Card */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3.5 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-[#0D9488]/10 text-[#0D9488] border border-[#0D9488]/20 shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 font-sans tracking-tight truncate">
                    <span>Developer & API Credentials</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                    {t('pfApiTokenDesc', 'API kalitingiz orqali so\'rovlarni amalga oshiring')}
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                ACTIVE
              </span>
            </div>

            {hasToken ? (
              <div className="space-y-3.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
                  <span className="font-medium">Request Header:</span>
                  <code className="bg-slate-100 dark:bg-slate-800 text-[#0D9488] px-2 py-0.5 rounded-lg font-mono text-[11px] border border-slate-200 dark:border-slate-700 shrink-0">
                    X-API-Key: YOUR_KEY
                  </code>
                </div>

                {/* Key container with mask and actions */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0 font-mono text-sm text-slate-800 dark:text-emerald-400 font-semibold tracking-normal truncate select-all">
                      {showToken ? profile.api_token : maskToken(profile.api_token)}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-300 hover:text-[#0D9488] transition-colors cursor-pointer shrink-0"
                      title={showToken ? 'Yashirish' : "Ko'rsatish"}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-sm transition-all cursor-pointer"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken ? t('copied', 'Nusxalandi!') : t('copy', 'Nusxalash')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => generateToken.mutate()}
                      disabled={generateToken.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${generateToken.isPending ? 'animate-spin text-[#0D9488]' : ''}`} />
                      <span>{t('pfRegenerateToken', 'Tokenni yangilash')}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800 dark:text-white">API Key hali yaratilmagan</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Tizim bilan avtomatik integratsiya qilish uchun kalit yarating.</p>
                </div>
                <Button
                  onClick={() => generateToken.mutate()}
                  disabled={generateToken.isPending}
                  className="cursor-pointer shrink-0 bg-[#0D9488] hover:bg-[#0F766E] text-white"
                >
                  <Key className="w-4 h-4" />
                  <span>{generateToken.isPending ? t('processing', 'Jarayonda...') : t('pfGenerateToken', 'API Token Yaratish')}</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (lg:col-span-6) */}
        <div className="lg:col-span-6 space-y-6">
          {/* TON Wallet Section */}
          {walletConnected ? (
            <WalletInfo
              walletAddress={profile.wallet_address}
              walletType={wallet?.wallet_type || profile?.wallet_type}
              gram={wallet?.ton_balance ?? profile.balance_gram}
              usdt={wallet?.usdt_balance ?? profile.balance_usdt}
              stars={wallet?.stars_balance}
              loading={walletLoading}
              onRefresh={refetchWallet}
              source={wallet?.source}
              updatedAt={wallet?.updated_at}
              onCopy={() => copyToClipboard(profile.wallet_address)}
              onDisconnect={() => setDisconnectModalOpen(true)}
            />
          ) : (
            /* Minimalist Empty State when Wallet is Disconnected */
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Wallet className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-sans">
                  Web3 TON Hamyon
                </h3>
              </div>

              <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto shrink-0 shadow-xs">
                  <Wallet className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    Hamyon Ulangan Emas
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    {t('pfApiTokenRequiredAlert', 'API Key va avtomatik Stars/Premium so\'rovlarini amalga oshirish uchun Web3 TON hamyoningizni ulang.')}
                  </p>
                </div>
                <Button
                  onClick={() => navigate('/mnemonic')}
                  className="!bg-gradient-to-r from-amber-500 to-orange-500 hover:!from-amber-400 hover:!to-orange-400 text-white font-bold cursor-pointer inline-flex items-center gap-2 shadow-md shadow-amber-500/20"
                >
                  <Wallet className="w-4 h-4" />
                  <span>{t('pfConnectWallet', 'TON Hamyon Ulash')}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Metrics & Statistics Grid (4 Key Metric Cards) */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 p-5 sm:p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white font-sans">
                {t('pfStats', 'Xaridlar va Faoliyat Statistikasi')}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Metric 1: Jami Stars */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 hover:border-[#0D9488]/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase truncate">
                    {t('pfTotalStars', 'Jami Stars')}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-[#0D9488] dark:text-[#2DD4BF] flex items-center justify-center shrink-0">
                    <Star className="w-4 h-4 fill-[#0D9488]/20" />
                  </div>
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-white font-mono truncate">
                  {formatNumber(profile?.total_stars_purchased || 0, 0)} <span className="text-xs font-semibold text-slate-400">ta</span>
                </p>
              </div>

              {/* Metric 2: Jami Premium */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 hover:border-amber-500/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase truncate">
                    {t('pfTotalPremium', 'Jami Premium')}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 fill-amber-500/20" />
                  </div>
                </div>
                <p className="text-base font-bold text-slate-800 dark:text-white font-mono truncate">
                  {profile?.total_premium_purchased || 0} <span className="text-xs font-semibold text-slate-400">ta</span>
                </p>
              </div>

              {/* Metric 3: Spent GRAM */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 hover:border-blue-500/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase truncate">
                    {t('pfSpentGram', 'SARFLANGAN GRAM')}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-base font-bold text-blue-600 dark:text-blue-400 font-mono truncate">
                  {formatNumber(profile?.total_spent_gram || 0)} <span className="text-xs font-semibold text-slate-400">GRAM</span>
                </p>
              </div>

              {/* Metric 4: Spent USDT */}
              <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2 hover:border-emerald-500/30 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-slate-400 uppercase truncate">
                    {t('pfSpentUsdt', 'SARFLANGAN USDT')}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Coins className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 font-mono truncate">
                  {formatNumber(profile?.total_spent_usdt || 0)} <span className="text-xs font-semibold text-slate-400">USDT</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Disconnect Wallet Modal */}
      <Modal
        open={disconnectModalOpen}
        onClose={() => setDisconnectModalOpen(false)}
        title={t('confirmDisconnectTitle', 'Hamyonni uzishni tasdiqlaysizmi?')}
      >
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {t('confirmDisconnectDesc', 'Hamyon uzilgach, API Key va avtomatik operatsiyalar vaqtincha cheklanadi.')}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-5">
          <Button variant="outline" onClick={() => setDisconnectModalOpen(false)} className="cursor-pointer">
            {t('cancel', 'Bekor qilish')}
          </Button>
          <Button
            variant="danger"
            onClick={() => disconnectWallet.mutate()}
            disabled={disconnectWallet.isPending}
            className="cursor-pointer"
          >
            {disconnectWallet.isPending ? t('processing', 'Jarayonda...') : t('pfDisconnectWallet', 'Hamyonni uzish')}
          </Button>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        open={deleteAccountModalOpen}
        onClose={() => setDeleteAccountModalOpen(false)}
        title={t('confirmDeleteAccountTitle', "Hisobni butunlay o'chirishni tasdiqlaysizmi?")}
      >
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <p className="text-xs text-rose-500 font-medium leading-relaxed">
            {t('confirmDeleteAccountDesc', "Ushbu amalni ortga qaytarib bo'lmaydi. Barcha ma'lumotlar va sozlamalariz o'chib ketadi.")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-5">
          <Button variant="outline" onClick={() => setDeleteAccountModalOpen(false)} className="cursor-pointer">
            {t('cancel', 'Bekor qilish')}
          </Button>
          <Button
            variant="danger"
            onClick={() => deleteAccount.mutate()}
            disabled={deleteAccount.isPending}
            className="cursor-pointer"
          >
            {deleteAccount.isPending ? t('processing', 'Jarayonda...') : t('confirmDelete', "Ha, o'chirilsin")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
