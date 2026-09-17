import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import {
  ShieldCheckIcon,
  WalletIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  TrashIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { shortenAddress } from '../utils/helpers';
import { useLanguage } from '../context/LanguageContext';
import Badge from '../components/common/Badge';
import Button from '../components/common/Button';
import { CardSkeleton } from '../components/common/Skeleton';

const WORD_PATTERN = /^[a-z]+$/;
const VALID_COUNTS = [12, 24];

function normalizeRawText(text) {
  if (!text) return '';
  return text.toLowerCase().replace(/[^a-z\s,;\n]/g, ' ');
}

function parseWords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[\s,;\n]+/)
    .map((w) => w.replace(/[^a-z]/g, ''))
    .filter(Boolean);
}

function formatBalance(value, digits = 4) {
  const n = Number(value || 0);
  if (Number.isFinite(n)) return n.toLocaleString('en-US', { maximumFractionDigits: digits });
  return '0';
}

export default function MnemonicToken() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [wordCountTarget, setWordCountTarget] = useState(24);
  const [rawInputText, setRawInputText] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [result, setResult] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: profile, refetch, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/users/me').then((res) => res.data).catch(() => api.get('/users/me').then((res) => res.data)),
  });

  const saveMnemonic = useMutation({
    mutationFn: (seed) => api.post('/api/v1/wallet/connect/', { mnemonic: seed }),
    onSuccess: (res) => {
      const info = res.data?.wallet_info;
      setResult(info || res.data);
      toast.success(t('mnConnectSuccessToast'));
      refetch();
      setTimeout(() => {
        navigate('/api-docs');
      }, 1000);
    },
    onError: (err) => {
      if (err?.response?.status === 429) {
        toast.error("So'rovlar limiti oshdi (Free tarif: 10 req/min). 30-60 soniya kuting va qayta urinib ko'ring.");
      } else {
        toast.error(err.response?.data?.detail || err.response?.data?.message || t('mnConnectError'));
      }
    },
  });

  const refreshWallet = useMutation({
    mutationFn: () => api.get('/api/wallet/balance'),
    onSuccess: (res) => {
      if (res.data?.success) {
        toast.success(t('mnBalanceUpdated', { ton: formatBalance(res.data.ton_balance), usdt: formatBalance(res.data.usdt_balance) }));
      }
      refetch();
    },
    onError: () => toast.error(t('mnBalanceUpdateFailed')),
  });

  const parsedWords = useMemo(() => parseWords(rawInputText), [rawInputText]);
  const currentCount = parsedWords.length;
  const isValidCount = currentCount === wordCountTarget || currentCount === 12 || currentCount === 24;
  const isMatchTarget = currentCount === wordCountTarget;
  const invalidWords = useMemo(() => parsedWords.filter((w) => !WORD_PATTERN.test(w)), [parsedWords]);
  const isValidFormat = parsedWords.length > 0 && invalidWords.length === 0;

  useEffect(() => {
    if (parsedWords.length === 12 && wordCountTarget !== 12) {
      setWordCountTarget(12);
    } else if (parsedWords.length === 24 && wordCountTarget !== 24) {
      setWordCountTarget(24);
    }
  }, [parsedWords.length]);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawInputText(text);
        toast.success(t('mnPasted'));
      } else {
        toast.error(t('mnClipboardEmpty'));
      }
    } catch {
      toast.error(t('mnClipboardReadError'));
    }
  };

  const handleClear = () => {
    setRawInputText('');
    setResult(null);
  };

  const handleRemoveWord = (indexToRemove) => {
    const updated = parsedWords.filter((_, idx) => idx !== indexToRemove);
    setRawInputText(updated.join(' '));
  };

  const handleSubmit = () => {
    if (parsedWords.length === 0) {
      toast.error(t('mnEmptyInput'));
      return;
    }
    if (!VALID_COUNTS.includes(parsedWords.length)) {
      toast.error(t('mnInvalidCount', { count: parsedWords.length }));
      return;
    }
    if (!isValidFormat) {
      toast.error(t('mnInvalidFormat'));
      return;
    }
    saveMnemonic.mutate(parsedWords.join(' '));
  };

  const copyText = (text) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
        toast.success(t('mnCopied'));
      },
      () => toast.error(t('mnCopyFailed'))
    );
  };

  const isConnected = Boolean(profile?.wallet_address);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <CardSkeleton rows={3} />
        <CardSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="card p-5 sm:p-8 bg-gradient-to-r from-[#131C31] via-[#1A2440] to-[#131C31] border-teal-500/20 relative overflow-hidden">
        <div className="absolute -right-8 -bottom-10 w-48 h-48 rounded-full bg-[#0D9488]/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <Badge tone="accent">
            <KeyIcon className="w-3.5 h-3.5" />
            {t('mnBadge')}
          </Badge>
          <h1 className="text-display text-white tracking-tight">{t('mnTitle')}</h1>
          <p className="text-sm text-gray-400 max-w-xl leading-relaxed">
            {t('mnDesc')}
          </p>
        </div>
      </div>

      {isConnected && (
        <div className="card p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#2ED9A0]/10 text-[#2ED9A0] flex items-center justify-center shrink-0">
                <WalletIcon className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-h2 font-bold text-gray-900 dark:text-white">{t('mnConnectedWallet')}</h3>
                  <Badge tone="success" dot>
                    {t('mnActive')}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg text-gray-700 dark:text-gray-300">
                    {shortenAddress(profile.wallet_address, 10, 8)}
                  </code>
                  <button
                    onClick={() => copyText(profile.wallet_address)}
                    className="icon-btn !w-8 !h-8"
                    title={t('copy')}
                  >
                    {copiedAddress ? (
                      <ClipboardDocumentCheckIcon className="w-4 h-4 text-[#2ED9A0]" />
                    ) : (
                      <ClipboardDocumentIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-caption">{t('mnBalance')}</p>
                <p className="text-h2 font-extrabold text-gray-900 dark:text-white">
                  {formatBalance(profile.balance_gram)} <span className="text-xs text-primary-500">TON</span>
                </p>
                <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatBalance(profile.balance_usdt)} <span className="text-xs">USDT</span>
                </p>
              </div>
              <button
                onClick={() => refreshWallet.mutate()}
                disabled={refreshWallet.isPending}
                className="icon-btn card"
                title={t('mnRefreshBalance')}
              >
                <ArrowPathIcon className={`w-5 h-5 ${refreshWallet.isPending ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={() => setShowForm(true)} className="w-full">
            <ArrowPathIcon className="w-4 h-4" />
            {t('mnReplaceWallet')}
          </Button>
        </div>
      )}

      <div className="card p-5 flex items-start gap-4 !border-amber-500/20">
        <ShieldCheckIcon className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-sm text-amber-600 dark:text-amber-400 leading-relaxed">
          <p className="font-bold">{t('mnSecurityTitle')}</p>
          <p>{t('mnSecurityDesc')}</p>
        </div>
      </div>

      {!isConnected || showForm ? (
        <div className="card p-5 sm:p-7 space-y-6">
          {showForm && (
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              <XMarkIcon className="w-4 h-4" />
              {t('cancel')}
            </button>
          )}

          <div className="flex items-center justify-between gap-4 flex-wrap border-b border-gray-200 dark:border-white/5 pb-4">
            <div className="flex items-center gap-2">
              <span className="text-label">{t('mnMode')}</span>
              <div className="inline-flex p-1 rounded-[10px] bg-gray-100 dark:bg-gray-800">
                {VALID_COUNTS.map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setWordCountTarget(cnt)}
                    className={`px-4 py-2 rounded-[8px] text-xs font-bold transition min-h-[38px] press-scale ${
                      wordCountTarget === cnt
                        ? 'bg-primary-500 text-white shadow-[0_4px_14px_rgba(20,184,166,0.3)]'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {t('mnWordCount', { count: cnt })}
                  </button>
                ))}
              </div>
            </div>

            <Badge
              tone={isMatchTarget ? 'success' : currentCount > 0 ? 'warning' : 'neutral'}
              dot
            >
              {t('mnCounter', { current: currentCount, target: wordCountTarget })}
            </Badge>
          </div>

          <div className="space-y-3">
            <label className="field-label">{t('mnSeedLabel')}</label>
            <div className="relative">
              <textarea
                rows={4}
                value={rawInputText}
                onChange={(e) => setRawInputText(e.target.value)}
                placeholder={t('mnPlaceholder')}
                className="input-field !font-mono !rounded-[12px] !text-sm leading-relaxed"
              />
              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                {rawInputText && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={handleClear}
                    className="!min-h-[36px] !bg-gray-200 dark:!bg-gray-700 hover:!bg-red-500 hover:!text-white"
                  >
                    <TrashIcon className="w-3.5 h-3.5" />
                    {t('mnClear')}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={handlePasteFromClipboard}
                  className="!min-h-[36px]"
                >
                  <ClipboardDocumentIcon className="w-4 h-4" />
                  {t('mnPaste')}
                </Button>
              </div>
            </div>
          </div>

          {parsedWords.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {t('mnAutoDetected', { count: parsedWords.length })}
                </span>
                <span className="text-caption">{t('mnRemoveHint')}</span>
              </div>

              <div className="mono-box !max-h-56 flex flex-wrap gap-2 content-start">
                {parsedWords.map((word, idx) => {
                  const isValidWord = WORD_PATTERN.test(word);
                  return (
                    <div
                      key={`${word}-${idx}`}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-mono font-medium transition shadow-sm ${
                        isValidWord
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-white/5'
                          : 'bg-red-500/10 text-red-500 border border-red-500/30'
                      }`}
                    >
                      <span className="text-[10px] font-bold text-gray-400">{idx + 1}.</span>
                      <span>{word}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveWord(idx)}
                        className="ml-1 text-gray-400 hover:text-red-500 rounded-full p-0.5 transition"
                        title={t('mnRemove')}
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-gray-200 dark:border-white/5">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!isValidCount || !isValidFormat || saveMnemonic.isPending}
              className="flex-1 !min-h-[48px]"
            >
              {saveMnemonic.isPending ? (
                <>
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  {t('mnSubmitPending')}
                </>
              ) : (
                <>
                  <WalletIcon className="w-5 h-5" />
                  {t('mnSubmit')}
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClear}
              disabled={!rawInputText}
              className="!min-h-[48px]"
            >
              {t('mnClearForm')}
            </Button>
          </div>

          {result && (
            <div className="mt-2 p-5 rounded-xl bg-[#2ED9A0]/10 border border-[#2ED9A0]/20 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="w-7 h-7 text-[#2ED9A0] shrink-0" />
                <div>
                  <h4 className="text-h2 font-bold text-[#2ED9A0]">{t('mnSuccessTitle')}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('mnSuccessDesc')}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/5">
                  <span className="text-caption block mb-1">{t('mnAddress')}</span>
                  <code className="mono-box !max-h-[4rem] !rounded-[8px] text-xs text-gray-900 dark:text-white">
                    {result.address || result.wallet_address}
                  </code>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-white/5 space-y-2">
                  <div>
                    <span className="text-caption block mb-1">{t('mnBalance')}</span>
                    <span className="text-sm font-extrabold text-primary-500">
                      {formatBalance(result.balance_gram || result.balance_ton)} TON
                    </span>
                  </div>
                  <div>
                    <span className="text-caption block mb-1">{t('mnBalanceUsdt')}</span>
                    <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatBalance(result.balance_usdt)} USDT
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
