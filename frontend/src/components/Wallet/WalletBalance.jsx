import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { formatNumber } from '../../utils/helpers';

export default function WalletBalance() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [balance, setBalance] = useState({
    ton: user?.balance_gram ?? 0
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  // Balansni olish
  const fetchBalance = async (showToast = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/wallet/balance').catch(() => api.get('/wallet/balance'));
      
      if (response.data.success) {
        setBalance({
          ton: response.data.ton_balance ?? response.data.balance_gram ?? 0
        });
        setLastUpdated(response.data.updated_at ? new Date(response.data.updated_at) : new Date());
        
        if (showToast) {
          toast.success(t('wbUpdated'));
        }
      } else {
        setError(response.data.message || response.data.error || t('wbFetchError'));
      }
    } catch (err) {
      setError(err.response?.data?.message || t('wbServerError'));
      if (showToast) {
        toast.error(t('wbUpdateFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Har 30 soniyada avtomatik yangilash
  useEffect(() => {
    if (user?.wallet_address) {
      fetchBalance();
      
      const interval = setInterval(() => {
        fetchBalance();
      }, 30000); // 30 soniya
      
      return () => clearInterval(interval);
    }
  }, [user?.wallet_address]);

  // Wallet ulanganmi?
  if (!user?.wallet_address) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-xl border border-amber-200 dark:border-amber-800/30">
        <p className="text-amber-800 dark:text-amber-400 text-sm">
          {t('wbNotConnected')}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-h2">
          {t('wbTitle')}
        </h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-caption text-gray-500 dark:text-gray-400">
              🕐 {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchBalance(true)}
            disabled={loading}
            className="icon-btn text-gray-500 dark:text-gray-400 disabled:opacity-50"
            title={t('refreshBalance')}
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm text-red-500 bg-red-500/5 border border-red-500/15">
          вќЊ {error}
        </div>
      )}

      {/* Wallet Address */}
      <div className="mb-4">
        <p className="text-caption mb-1">{t('wbAddress')}</p>
        <code className="mono-box !max-h-[2.5rem] !rounded-[8px] text-xs">{user.wallet_address}</code>
      </div>

      {/* Balances */}
      <div className="grid grid-cols-1 gap-3">
        {/* TON Balance */}
        <div className="p-4 rounded-xl bg-[#0D9488]/8 border border-[#0D9488]/15">
          <div className="flex items-center justify-between">
            <p className="text-caption">{t('wbGramBalance')}</p>
            {loading && (
              <div className="w-4 h-4 border-2 border-[#0D9488] border-t-transparent rounded-full animate-spin"></div>
            )}
          </div>
          <p className="text-lg font-bold text-primary-500">
            {formatNumber(balance.ton)} TON
          </p>
        </div>
      </div>

      {/* Refresh button */}
      <button
        onClick={() => fetchBalance(true)}
        disabled={loading}
        className="w-full py-2 mt-3 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition disabled:opacity-50"
      >
        {loading ? t('wbUpdating') : t('refreshBalance')}
      </button>
    </div>
  );
}
