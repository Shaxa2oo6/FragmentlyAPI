import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import { CheckIcon } from '@heroicons/react/24/solid';
import {
  ExclamationTriangleIcon,
  WalletIcon,
  SparklesIcon,
  TagIcon,
  ArrowPathIcon,
  BoltIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { useLanguage } from '../context/LanguageContext';
import { CardSkeleton } from '../components/common/Skeleton';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import SubscriptionHistory from '../components/Subscriptions/SubscriptionHistory';
import { formatNumber, getErrorMessage } from '../utils/helpers';

const CONFIRM_ATTEMPTS = 6;
const CONFIRM_DELAY = 3000;

const DURATION_OPTIONS = [
  { months: 1, discount: 0, label: '1 oy', discountBadge: null },
  { months: 3, discount: 10, label: '3 oy', discountBadge: '-10%' },
  { months: 6, discount: 20, label: '6 oy', discountBadge: '-20%' },
  { months: 12, discount: 30, label: '12 oy', discountBadge: '-30%' },
];

export default function Subscriptions() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalPlan, setModalPlan] = useState(null);
  const [currency, setCurrency] = useState('ton');
  const [durationMonths, setDurationMonths] = useState(1);
  const [autoRenew, setAutoRenew] = useState(true);

  const [pendingTx, setPendingTx] = useState(null);
  const [guardModal, setGuardModal] = useState(false);

  const {
    data: rawTariffData,
    isLoading: plansLoading,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ['tariff-plans'],
    queryFn: () => api.get('/api/v1/tariffs/').then((res) => res.data),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 15000,
  });

  const { data: userTariffData } = useQuery({
    queryKey: ['user-tariff'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/user/tariff');
        return res.data;
      } catch {
        const res = await api.get('/api/users/me');
        return res.data;
      }
    },
  });

  const userTariff = userTariffData?.user || userTariffData || {};
  const walletConnected = !!userTariff?.wallet_connected || !!userTariff?.wallet_address;
  const currentPlan = userTariff?.tariff_type || userTariff?.tariff_plan || userTariff?.tariff_name || 'free';
  const hasActivePaid = currentPlan !== 'free';

  const rawPlans = Array.isArray(rawTariffData)
    ? rawTariffData
    : Array.isArray(rawTariffData?.plans)
    ? rawTariffData.plans
    : Array.isArray(rawTariffData?.tariffs)
    ? rawTariffData.tariffs
    : Array.isArray(rawTariffData?.data)
    ? rawTariffData.data
    : [];

  const plans = rawPlans.map((plan) => {
    const planId = (plan.id || plan.tariff_id || plan.code || 'free').toString().toLowerCase();
    const planName = plan.name || plan.tariff_name || plan.title || planId.toUpperCase();
    const priceGram = Number(plan.price_gram ?? plan.price_ton ?? plan.price_gram_monthly ?? 0);
    const priceUsdt = Number(plan.price_usdt ?? plan.price_usdt_monthly ?? 0);

    let commissionPct = plan.commission_percent;
    if (commissionPct === undefined && plan.commission_rate !== undefined) {
      commissionPct = plan.commission_rate <= 1 ? plan.commission_rate * 100 : plan.commission_rate;
    }
    commissionPct = Number(commissionPct ?? 0);

    const rateLimit = Number(plan.rate_limit_per_min ?? plan.requests_per_minute ?? plan.rate_limit ?? 10);
    const description = plan.description || plan.desc || '';
    const features = Array.isArray(plan.features) ? plan.features : [];

    return {
      ...plan,
      id: planId,
      name: planName,
      price_gram: priceGram,
      price_usdt: priceUsdt,
      commission_percent: commissionPct,
      rate_limit_per_min: rateLimit,
      description,
      features,
    };
  });

  const invalidateAll = () => {
    ['dashboard-stats', 'transactions', 'subscription-history', 'tariff-plans', 'settings-profile', 'profile', 'wallet-balance', 'user-tariff'].forEach(
      (key) => queryClient.invalidateQueries({ queryKey: [key] })
    );
  };

  const buy = useMutation({
    mutationFn: (body) => api.post('/api/tariff/buy', body).then((res) => res.data),
    onSuccess: (res) => {
      if (res.status === 'completed') {
        toast.success(`${res.plan_name || ''} ${t('tariffActivated')}`);
        setModalPlan(null);
        setPendingTx(null);
        invalidateAll();
      } else if (res.status === 'pending') {
        toast(t('waitingConfirm'), { icon: 'вЏі' });
        setPendingTx({ transaction_id: res.transaction_id, tx_hash: res.tx_hash });
      }
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, t('paymentFailedMsg')));
      setModalPlan(null);
      setPendingTx(null);
    },
  });

  useEffect(() => {
    if (!pendingTx) return undefined;
    let attempt = 0;
    const timer = setInterval(async () => {
      attempt += 1;
      try {
        const res = await api.post('/api/tariff/confirm', pendingTx);
        toast.success(res.data?.message || t('tariffActivated'));
        clearInterval(timer);
        setPendingTx(null);
        setModalPlan(null);
        invalidateAll();
      } catch (err) {
        if (attempt >= CONFIRM_ATTEMPTS) {
          clearInterval(timer);
          toast.error(getErrorMessage(err, t('paymentFailedMsg')));
          setPendingTx(null);
          setModalPlan(null);
        }
      }
    }, CONFIRM_DELAY);
    return () => clearInterval(timer);
  }, [pendingTx]);

  const handleBuy = (plan) => {
    if (Number(plan.price_gram) === 0) {
      toast(t('freePlanCannotBuy') || 'Free tarifni xarid qilib bo\'lmaydi');
      return;
    }
    if (hasActivePaid) {
      toast(t('activeTariffNotice') || 'Sizda allaqachon faol obuna mavjud. Amaldagi muddat tugagach yangi tarif olishingiz mumkin.');
      return;
    }
    if (!walletConnected) {
      setGuardModal(true);
      return;
    }
    setCurrency('ton');
    setDurationMonths(1);
    setAutoRenew(true);
    setModalPlan(plan);
  };

  const closeModal = () => {
    if (buy.isPending || pendingTx) return;
    setModalPlan(null);
  };

  const selectedDurationObj = DURATION_OPTIONS.find((d) => d.months === durationMonths) || DURATION_OPTIONS[0];
  const baseMonthlyPrice = modalPlan
    ? currency === 'ton'
      ? modalPlan.price_gram
      : modalPlan.price_usdt
    : 0;

  const rawTotal = baseMonthlyPrice * durationMonths;
  const discountAmount = (rawTotal * selectedDurationObj.discount) / 100;
  const finalTotal = Math.max(0, rawTotal - discountAmount);

  const handleConfirmPurchase = () => {
    if (!modalPlan) return;
    buy.mutate({
      plan_id: modalPlan.id,
      currency,
      duration_months: durationMonths,
      auto_renew: autoRenew,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 text-gray-900 dark:text-white">{t('subscriptionsTitle')}</h1>
        <p className="text-caption mt-1">{t('subscriptionsSubtitle')}</p>
      </div>

      <div className="card p-5">
        <h2 className="text-caption uppercase tracking-wider mb-4">{t('currentTariffBlock')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 items-center">
          <div>
            <span className="text-caption block mb-1">{t('activePlan')}</span>
            <span className="text-h2 font-bold text-primary-500 uppercase">
              {userTariff.tariff_name || currentPlan || 'Free'}
            </span>
          </div>
          <div>
            <span className="text-caption block mb-1">{t('planStatus')}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {currentPlan === 'free'
                ? t('unlimitedDuration')
                : `${userTariff.expires_in_days ?? 0} ${t('daysLabel')}`}
            </span>
          </div>
          <div>
            <span className="text-caption block mb-1">{t('requestsLimit')}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {userTariff.requests_per_minute ?? 10} {t('perMinute')}
            </span>
          </div>
        </div>
      </div>

      {plansLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : plans.length === 0 ? (
        <div className="card border-dashed p-8">
          <div className="empty-state">
            <div className="empty-state-icon">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-h2 text-gray-900 dark:text-white">
              {t('noTariffsAvailable') || 'Hozircha obunada darajalar mavjud emas'}
            </h3>
            <p className="text-body max-w-md mx-auto">
              {t('noTariffsSubtitle') || 'Admin panel orqali tariflar qo\'shilishi bilanoq bu yerda namoyon bo\'ladi.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan || plan.name.toLowerCase() === currentPlan.toLowerCase();
            return (
              <div
                key={plan.id}
                className={`card card-lift p-6 flex flex-col justify-between ${
                  isCurrent ? '!border-primary-500/50 ring-1 ring-primary-500/30' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-h2 text-gray-900 dark:text-white">{plan.name}</h3>
                    {isCurrent && <Badge tone="success">{t('activeBadge')}</Badge>}
                  </div>
                  <div className="mt-4 mb-5">
                    <span className="text-display text-gray-900 dark:text-white">
                      {plan.price_gram === 0 ? t('freePlan') : `${formatNumber(plan.price_gram)} GRAM`}
                    </span>
                    {plan.price_gram > 0 && (
                      <span className="text-sm text-gray-500 ml-1">/ {t('perMonth')}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span className="badge badge-accent">
                      <BoltIcon className="w-3.5 h-3.5" />
                      {t('planRateLimit')} {plan.rate_limit_per_min} {t('perMinute')}
                    </span>
                    <span className="badge badge-neutral">
                      <TagIcon className="w-3.5 h-3.5" />
                      {t('planCommission')} {plan.commission_percent}%
                    </span>
                  </div>

                  <ul className="space-y-2.5 mb-6">
                    {plan.description ? (
                      <li className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                        <CheckIcon className="w-4 h-4 text-[#2ED9A0] shrink-0" />
                        <span>{plan.description}</span>
                      </li>
                    ) : null}
                    {Array.isArray(plan.features) &&
                      plan.features.map((feat, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <CheckIcon className="w-4 h-4 text-[#2ED9A0] shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                  </ul>
                </div>

                <div className="w-full space-y-2">
                  {Number(plan.price_gram) === 0 ? (
                    /* Free tarif: "Xarid qilish" tugmasi YO'Q — o'rniga joriy/faol badge */
                    <div className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-[10px] border border-[#2ED9A0]/40 bg-[#2ED9A0]/10 text-[#2ED9A0] text-xs font-bold">
                      {isCurrent ? (
                        <>
                          <CheckIcon className="w-4 h-4" />
                          {t('yourPlan')} В· {t('freePlan')}
                        </>
                      ) : (
                        <>{t('freePlan')}</>
                      )}
                    </div>
                  ) : isCurrent ? (
                    <Button variant="outline" disabled className="w-full">
                      {t('yourPlan')}
                    </Button>
                  ) : hasActivePaid ? (
                    /* Boshqa pullik tarif faol bo'lsa — yangi tarif qulflangan */
                    <>
                      <Button disabled className="w-full opacity-60">
                        <LockClosedIcon className="w-4 h-4" />
                        {t('activeTariffShort')}
                      </Button>
                      <p className="text-center text-[12px] leading-snug text-gray-400 dark:text-gray-500 px-1">
                        {t('activeTariffNotice')}
                      </p>
                    </>
                  ) : (
                    <Button
                      variant="primary"
                      onClick={() => handleBuy(plan)}
                      disabled={buy.isPending}
                      className="w-full"
                    >
                      {t('buyPlan')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SubscriptionHistory />

      <Modal
        open={!!modalPlan}
        onClose={closeModal}
        title={`${modalPlan?.name || ''} ${t('buyPlan')}`}
        className="sm:max-w-md"
      >
        <div className="space-y-4">
          {/* Muddat tanlash (Period selector) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span>{t('selectDuration') || 'Muddatni tanlang:'}</span>
              {selectedDurationObj.discount > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <TagIcon className="w-3 h-3" />
                  {selectedDurationObj.discount}% chegirma
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.months}
                  type="button"
                  onClick={() => setDurationMonths(opt.months)}
                  className={`relative py-2.5 px-1 rounded-xl text-xs font-bold transition flex flex-col items-center justify-center border min-h-[52px] ${
                    durationMonths === opt.months
                      ? 'bg-teal-50 border-2 border-teal-600 text-teal-700 dark:bg-teal-500/15 dark:border-teal-500 dark:text-teal-300'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.discountBadge && (
                    <span className="mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      {opt.discountBadge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* To'lov usuli (Payment method) */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('payMethodTitle') || "To'lov valyutasi:"}
            </label>
            <div className="flex justify-between items-center p-3 rounded-xl border border-teal-200 bg-teal-50/50 dark:border-teal-500/30 dark:bg-teal-500/10">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-teal-100 dark:bg-teal-500/20 text-teal-600 dark:text-teal-300 flex items-center justify-center">
                  <BoltIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">GRAM (TON)</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Toncoin</p>
                </div>
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">
                {formatNumber(modalPlan?.price_gram)} <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">/ oy</span>
              </span>
            </div>
          </div>

          {/* Avto-yangilash (Auto-renew toggle) */}
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">{t('autoRenewLabel') || 'Avto-yangilash'}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Har oy avtomatik yechish</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoRenew}
              onClick={() => setAutoRenew(!autoRenew)}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                autoRenew ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  autoRenew ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* To'lov yakuni (Summary Box) */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Boshlang'ich narx ({durationMonths} oy):</span>
              <span className="font-mono">{formatNumber(rawTotal)} GRAM</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span>Chegirma ({selectedDurationObj.discount}%):</span>
                <span className="font-mono">-{formatNumber(discountAmount)} GRAM</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <span className="text-sm text-slate-700 dark:text-slate-300 font-semibold">Jami To'lov:</span>
              <span className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono">
                {formatNumber(finalTotal)} GRAM
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleConfirmPurchase}
            disabled={buy.isPending || !!pendingTx}
            className="w-full !min-h-[44px] !py-3 !rounded-xl !bg-teal-600 hover:!bg-teal-700 !text-white !font-medium !shadow-md !shadow-teal-200 dark:!shadow-teal-900/30 !inline-flex !items-center !justify-center !gap-2 !transition"
          >
            {pendingTx ? t('waitingConfirm') : buy.isPending ? t('confirming') : t('confirmPayment')}
            {buy.isPending && <ArrowPathIcon className="w-4 h-4 animate-spin" />}
          </Button>
        </div>
      </Modal>

      <Modal open={guardModal} onClose={() => setGuardModal(false)} title={t('sbWalletRequiredTitle')}>
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
            <ExclamationTriangleIcon className="w-6 h-6" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {t('sbWalletRequiredDesc')}
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setGuardModal(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => {
              setGuardModal(false);
              navigate('/mnemonic');
            }}
            className="!bg-gradient-to-r from-amber-500 to-orange-500 hover:!from-amber-400 hover:!to-orange-400"
          >
            <WalletIcon className="w-4 h-4" />
            {t('goToWalletPage')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
