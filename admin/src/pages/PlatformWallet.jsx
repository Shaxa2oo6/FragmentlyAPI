import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import {
  ArrowUpRightIcon,
  ShieldCheckIcon,
  XMarkIcon,
  WalletIcon,
  CheckCircleIcon,
  DocumentDuplicateIcon,
  KeyIcon,
  LinkIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { formatNumber } from '../utils/helpers';

const WALLET_TYPES = [
  { value: 'v4R2', label: 'v4R2 (standart)' },
  { value: 'v5R1', label: 'v5R1 / W5' },
  { value: 'v3R2', label: 'v3R2 (legacy)' },
];

const REQUIRED_WORD_COUNT = 24;

const copyToClipboard = (text, label) => {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(`${label} nusxalandi`))
      .catch(() => toast.error("Nusxalashda xatolik yuz berdi"));
  } else {
    toast.error("Brauzer clipboard'ni qo'llab-quvvatlamaydi");
  }
};

const shorten = (addr) => {
  if (!addr) return '';
  return addr.length <= 14 ? addr : `${addr.slice(0, 8)}...${addr.slice(-6)}`;
};

const AddressRow = ({ label, value, icon: Icon = WalletIcon }) => (
  <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl border border-gray-200 dark:border-gray-800 p-3">
    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1">
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
    <div className="flex items-center justify-between gap-3 mt-1.5">
      <code className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 break-all leading-snug">{value}</code>
      {value && (
        <button
          type="button"
          onClick={() => copyToClipboard(value, label)}
          className="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition shrink-0"
          title="Nusxalash"
        >
          <DocumentDuplicateIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  </div>
);

const BalanceCard = ({ title, value, unit, source, stored, storedLabel, prefix = '' }) => (
  <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 sm:p-6 space-y-3 shadow-xl relative overflow-hidden">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</span>
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${source === 'live' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
        {source === 'live' ? 'Real On-Chain' : 'Saqlangan'}
      </span>
    </div>
    <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white font-mono break-words">
      {prefix}{formatNumber(value)} <span className="text-sm text-emerald-400 font-sans">{unit}</span>
    </div>
    {source === 'live' && stored != null && (
      <p className="text-[11px] text-gray-500 break-words">Baza qiymati: {storedLabel(stored)}</p>
    )}
  </div>
);

export default function PlatformWallet() {
  const queryClient = useQueryClient();

  const [seedPhrase, setSeedPhrase] = useState('');
  const [seedWalletType, setSeedWalletType] = useState('v4R2');
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({
    destination_address: '',
    amount: 0,
    currency: 'TON',
  });

  const { data: pWallet, refetch: refetchWallet, isFetching: walletFetching } = useQuery({
    queryKey: ['admin-platform-wallet'],
    queryFn: () => api.get('/api/admin/platform-wallet').then((res) => res.data),
  });

  const seedWordCount = seedPhrase.trim() ? seedPhrase.trim().split(/\s+/).length : 0;
  const seedConnected = pWallet?.is_connected || pWallet?.seed_connected || pWallet?.wallet_seed_connected || false;

  const connectWalletMutation = useMutation({
    mutationFn: (data) => api.post('/api/admin/platform-wallet/connect', data),
    onSuccess: (res) => {
      toast.success(res.data.message || "Platforma hamyoni seed-phrase orqali ulandi");
      setSeedPhrase('');
      setShowSeedConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['admin-platform-wallet'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Platforma hamyonini ulashda xatolik"),
  });

  const disconnectSeedMutation = useMutation({
    mutationFn: () => api.post('/api/admin/platform-wallet/disconnect-seed'),
    onSuccess: (res) => {
      toast.success(res.data.message || "Seed-phrase bog'lanish bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ['admin-platform-wallet'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Bog'lanishni bekor qilishda xatolik"),
  });

  const withdrawMutation = useMutation({
    mutationFn: (data) => api.post('/api/v1/admin/platform-wallet/withdraw', data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setWithdrawModalOpen(false);
      setWithdrawForm({ destination_address: '', amount: 0, currency: 'TON' });
      queryClient.invalidateQueries({ queryKey: ['admin-platform-wallet'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Mablag' chiqarishda xatolik"),
  });

  const handleSeedSubmit = (e) => {
    e.preventDefault();
    if (seedWordCount !== REQUIRED_WORD_COUNT) {
      toast.error(`Seed-phrase faqat ${REQUIRED_WORD_COUNT} ta so'zdan iborat bo'lishi kerak (topildi: ${seedWordCount})`);
      return;
    }
    setShowSeedConfirm(true);
  };

  const handleExecuteConnectSeed = () => {
    connectWalletMutation.mutate({
      seed_phrase: seedPhrase.trim(),
      wallet_type: seedWalletType,
    });
  };

  const handleDisconnectSeed = () => {
    if (!window.confirm("Seed-phrase bog'lanishini bekor qilasizmi? Shifrlangan ibora o'chiriladi.")) return;
    disconnectSeedMutation.mutate();
  };

  const handleWithdrawSubmit = (e) => {
    e.preventDefault();
    if (!withdrawForm.destination_address || withdrawForm.destination_address.length < 40) {
      toast.error("Hamyon manzilini to'liq kiriting");
      return;
    }
    if (withdrawForm.amount <= 0) {
      toast.error("Mablag' miqdorini kiriting");
      return;
    }
    withdrawMutation.mutate(withdrawForm);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header + Refresh (top-right) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight break-words">
            Platforma Hamyoni va Balans Monitoringi
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words">
            Hamyon faqat 24 so'zli seed-phrase (mnemonic) orqali ulanadi. TON + USDT (Jetton) manzillari
            avtomatik hisoblanadi, real on-chain balanslar TonAPI orqali ko'rsatiladi.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={() => refetchWallet()}
            disabled={walletFetching}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2 min-h-[44px] shrink-0 active:scale-98 disabled:opacity-50"
            title="Balanslarni yangilash"
          >
            <ArrowPathIcon className={`w-4 h-4 ${walletFetching ? 'animate-spin' : ''}`} />
            <span>Balanslarni Yangilash</span>
          </button>
          {seedConnected && (
            <button
              type="button"
              onClick={() => setWithdrawModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2 min-h-[44px] shrink-0 active:scale-98"
            >
              <ArrowUpRightIcon className="w-4 h-4 shrink-0" />
              <span>Balansni Chiqarish</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. 24 SO'ZLI SEED-PHRASE FORMA (YUQORI QISM) */}
      <div className="bg-white dark:bg-gray-900 border border-indigo-500/30 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
        <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
          <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2 break-words">
            <KeyIcon className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>24 So'zli Seed-Phrase Orqali Ulash</span>
          </h3>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 break-words">
            Seed-phrase kiritilgach platformaning TON va USDT (Jetton) manzillari avtomatik hisoblanadi,
            on-chain balanslar TonAPI orqali olinadi va ibora Fernet (AES-256) bilan shifrlanadi. 2FA so'ralmaydi.
          </p>
        </div>

        <form onSubmit={handleSeedSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">
              24 so'zli Seed-Phrase ({seedWordCount} ta so'z):
            </label>
            <textarea
              rows={3}
              required
              value={seedPhrase}
              onChange={(e) => setSeedPhrase(e.target.value)}
              placeholder="24 ta so'zni bo'sh joy bilan ajratib kiriting (word1 word2 ... word24)"
              className="w-full p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-primary-500 outline-none resize-none break-all"
            />
            <p className={`mt-1 text-[11px] font-bold ${seedWordCount === REQUIRED_WORD_COUNT ? 'text-emerald-600 dark:text-emerald-400' : seedWordCount > 0 ? 'text-amber-500 dark:text-amber-400' : 'text-gray-500 dark:text-gray-500'}`}>
              {seedWordCount === REQUIRED_WORD_COUNT
                ? `To'g'ri: ${seedWordCount} so'z BIP39`
                : seedWordCount > 0
                ? `24 ta so'z talab qilinadi (topildi: ${seedWordCount})`
                : '24 so\'zli mnemonic kiriting'}
            </p>
          </div>

          <div>
            <label className="block font-bold text-gray-700 dark:text-gray-300 mb-1">Hamyon Turi:</label>
            <select
              value={seedWalletType}
              onChange={(e) => setSeedWalletType(e.target.value)}
              className="w-full p-3 bg-gray-100 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold text-xs focus:ring-2 focus:ring-primary-500"
            >
              {WALLET_TYPES.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={connectWalletMutation.isPending || seedWordCount < 1}
              className="flex-1 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition disabled:opacity-50 min-h-[44px]"
            >
              {connectWalletMutation.isPending ? "Derivatsiya qilinmoqda..." : "Hamyonni Ulash va Saqlash"}
            </button>
            {seedConnected && (
              <button
                type="button"
                disabled={disconnectSeedMutation.isPending}
                onClick={handleDisconnectSeed}
                className="px-4 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition disabled:opacity-50 min-h-[44px]"
                title="Seed-phrase bog'lanishni bekor qilish"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* 2. ULANGAN HAMYON MA'LUMOTLARI VA BALANS MONITORINGI (PASTKI QISM) */}
      {seedConnected ? (
        <>
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-4 sm:p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-3 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl shrink-0">
                  <WalletIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white break-words">Rasmiy Platforma Hamyoni</h3>
                  <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 break-words">
                    Komissiya tushumlari yig'iladigan TON + USDT (Jetton) manzillari
                  </p>
                </div>
              </div>

              <span className="px-3 py-1 rounded-full text-[11px] sm:text-xs font-mono font-bold border flex items-center gap-1.5 bg-indigo-500/10 text-indigo-300 border-indigo-500/30">
                <CheckCircleIcon className="w-4 h-4 shrink-0" />
                <span>Seed-Phrase Ulangan</span>
                <span>· {pWallet?.wallet_type || 'v4R2'}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <AddressRow label="Platforma TON Manzili" value={pWallet?.ton_address || pWallet?.wallet_address} icon={WalletIcon} />
              <AddressRow label="Platforma USDT Jetton Manzili" value={pWallet?.usdt_address || pWallet?.usdt_wallet_address} icon={LinkIcon} />
            </div>

            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
              <KeyIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Shifrlangan seed (Fernet): {pWallet?.wallet_seed_hint || '—'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <BalanceCard
              title="JORIY PLATFORMA TON BALANSI"
              value={pWallet?.ton_balance ?? pWallet?.balance_gram ?? 0}
              unit="TON"
              source={pWallet?.balance_source}
              stored={pWallet?.stored_balance_gram}
              storedLabel={(v) => `${formatNumber(v)} TON`}
            />
            <BalanceCard
              title="JORIY PLATFORMA USDT BALANSI"
              value={pWallet?.usdt_balance ?? pWallet?.balance_usdt ?? 0}
              unit="USDT"
              prefix="$"
              source={pWallet?.balance_source}
              stored={pWallet?.stored_balance_usdt}
              storedLabel={(v) => `$${formatNumber(v)} USDT`}
            />
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-3xl p-8 sm:p-12 text-center space-y-3 shadow-xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 flex items-center justify-center">
            <WalletIcon className="w-7 h-7" />
          </div>
          <h3 className="text-base sm:text-lg font-extrabold text-gray-900 dark:text-white">
            Hamyon hali ulanmagan
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto break-words">
            Platforma hamyonini ulash uchun yuqoridagi formaga 24 so'zli seed-phrase (mnemonic) kiriting.
            TON va USDT (Jetton) manzillari hamda real on-chain balanslar avtomatik hisoblanadi.
          </p>
        </div>
      )}

      {/* SEED CONNECT CONFIRM MODAL */}
      {showSeedConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 border border-indigo-500/40 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-800 p-5 shrink-0">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl shrink-0">
                <ShieldCheckIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-gray-900 dark:text-white break-words">Seed-Phrase Ulashni Tasdiqlash</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 break-words">Platforma hamyonini shu ibora bilan ulashni tasdiqlaysizmi?</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3">
              <div className="p-4 bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl text-xs space-y-2">
                <p className="text-gray-700 dark:text-gray-300 break-words">
                  Seed-phrase (<strong className="text-gray-900 dark:text-white">{seedWordCount} so'z</strong>) tekshirilib, TON va USDT
                  manzillari hisoblanadi. Iboraning o'zi <strong className="text-gray-900 dark:text-white">shifrlangan holda</strong> saqlanadi.
                </p>
                <code className="block text-[10px] font-mono text-gray-500 dark:text-gray-400 break-all bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-200 dark:border-gray-800 max-h-28 overflow-y-auto custom-scrollbar">
                  {seedPhrase.trim()}
                </code>
                <p className="flex items-start gap-1.5 text-[11px] text-amber-500 dark:text-amber-400 pt-1">
                  <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
                  Bu ibora platformaning komissiya hamyonini to'liq boshqaradi. Faqat o'zingiz ishonadigan hamyonni kiriting.
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSeedConfirm(false)}
                className="order-2 sm:order-1 px-4 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition min-h-[44px] flex-1"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={handleExecuteConnectSeed}
                disabled={connectWalletMutation.isPending}
                className="order-1 sm:order-2 flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                {connectWalletMutation.isPending ? 'Derivatsiya qilinmoqda...' : 'Tasdiqlayman (Ulash)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      {withdrawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 p-5 shrink-0">
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 min-w-0">
                <ShieldCheckIcon className="w-5 h-5 text-emerald-400 shrink-0" />
                <span className="truncate">Mablag' Chiqarish (Superadmin)</span>
              </h3>
              <button type="button" onClick={() => setWithdrawModalOpen(false)} className="p-1 text-gray-400 hover:text-gray-900 dark:hover:text-white shrink-0">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-3 text-xs">
              <div>
                <label className="block text-gray-500 dark:text-gray-400 mb-1">Valyuta:</label>
                <select
                  value={withdrawForm.currency}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, currency: e.target.value })}
                  className="w-full p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-bold"
                >
                  <option value="TON">TON</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-500 dark:text-gray-400 mb-1">Qabul Qiluvchi Hamyon Manzili:</label>
                <input
                  type="text"
                  required
                  value={withdrawForm.destination_address}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, destination_address: e.target.value })}
                  placeholder="UQDEaY3DeB-f2jZms..."
                  className="w-full p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-mono break-all"
                />
              </div>

              <div>
                <label className="block text-gray-500 dark:text-gray-400 mb-1">Chiqariladigan Summa:</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white font-mono"
                />
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-gray-900 pt-4 flex flex-col sm:flex-row gap-2 -mx-5 px-5 pb-0 border-t border-gray-200 dark:border-gray-800 -mb-5 mt-6">
                <button
                  type="button"
                  onClick={() => setWithdrawModalOpen(false)}
                  className="order-2 sm:order-1 flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition min-h-[44px]"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={withdrawMutation.isPending}
                  className="order-1 sm:order-2 flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition min-h-[44px]"
                >
                  {withdrawMutation.isPending ? 'Bajarilmoqda...' : 'Chiqarishni Tasdiqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
