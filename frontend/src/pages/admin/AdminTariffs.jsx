import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { getErrorMessage } from '../../utils/helpers';
import { useLanguage } from '../../context/LanguageContext';
import { SparklesIcon, ArrowPathIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline';
import Modal from '../../components/common/Modal';
import Button from '../../components/common/Button';

export default function AdminTariffs() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const { data: tariffs, isLoading } = useQuery({
    queryKey: ['admin-tariffs'],
    queryFn: () => api.get('/api/admin/tariffs').then((res) => res.data),
  });

  const { data: wallet } = useQuery({
    queryKey: ['admin-wallet'],
    queryFn: () => api.get('/api/admin/platform-wallet').then((res) => res.data),
  });

  const updateTariff = useMutation({
    mutationFn: ({ tariffId, data }) => api.put(`/api/admin/tariffs/${tariffId}`, data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const createTariff = useMutation({
    mutationFn: (data) => api.post('/api/admin/tariffs', data),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
      setShowAdd(false);
      setNewForm({});
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const deleteTariff = useMutation({
    mutationFn: (tariffId) => api.delete(`/api/admin/tariffs/${tariffId}`),
    onSuccess: (res) => {
      toast.success(res.data.message);
      queryClient.invalidateQueries({ queryKey: ['admin-tariffs'] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const [editing, setEditing] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newForm, setNewForm] = useState({});

  const isFree = (tariff) => Number(tariff?.price_gram) === 0;
  const isDoimiy = (tariff) => Number(tariff?.duration_days) === 0;

  const handleCreate = () => {
    const price = Number(newForm.price_gram || 0);
    const data = {
      name: newForm.name?.trim(),
      price_gram: price,
      price_usdt: 0,
      commission_percent: Number(newForm.commission_percent || 0),
      rate_limit_per_min: Number(newForm.rate_limit_per_min || 1),
      description: newForm.description?.trim() || null,
      features: newForm.features?.trim() || null,
    };
    if (price === 0) {
      // Free tarif — muddat doimiy (tugamaydi)
      data.duration_days = 0;
    } else {
      data.duration_days = Number(newForm.duration_days || 30);
    }
    createTariff.mutate(data);
  };

  const handleSave = (tariff) => {
    const form = editing[tariff.id] || {};
    const data = {
      // Free tarif uchun narx doim 0 TON da qulflangan
      price_gram: isFree(tariff)
        ? 0
        : form.price_gram !== undefined
        ? Number(form.price_gram)
        : tariff.price_gram,
      price_usdt: 0,
      commission_percent:
        form.commission_percent !== undefined ? Number(form.commission_percent) : tariff.commission_percent,
      rate_limit_per_min:
        form.rate_limit_per_min !== undefined ? Number(form.rate_limit_per_min) : tariff.rate_limit_per_min,
      description: form.description ?? tariff.description,
    };
    if (form.features !== undefined) data.features = form.features;
    if (form.duration_days !== undefined && !isFree(tariff)) data.duration_days = Number(form.duration_days);
    updateTariff.mutate({ tariffId: tariff.id, data });
    setEditing((prev) => ({ ...prev, [tariff.id]: undefined }));
  };

  const setField = (tariffId, key, value) => {
    setEditing((prev) => ({ ...prev, [tariffId]: { ...prev[tariffId], [key]: value } }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-h1">{t('atTitle')}</h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('atSubtitle')}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          <PlusIcon className="w-4 h-4" />
          <span>{t('atAddTariff')}</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(tariffs || []).map((tariff) => {
            const form = editing[tariff.id] || {};
            return (
              <div
                key={tariff.id}
                className="card p-6 space-y-4 card-lift"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 shrink-0">
                    <SparklesIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {tariff.name}
                      {tariff.is_archived && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {t('atArchived')}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-gray-400 truncate">{tariff.description}</p>
                  </div>
                  {tariff.is_archived && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(tariff)}
                      title={t('atDelete')}
                      className="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition shrink-0"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {t('atPriceGram')}
                    </label>
                    {isFree(tariff) ? (
                      <div>
                        <input
                          type="number"
                          step="0.01"
                          value={0}
                          disabled
                          className="input-field opacity-60"
                        />
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                          {t('atPriceFreeNote')}
                        </p>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={tariff.price_gram}
                        onChange={(e) => setField(tariff.id, 'price_gram', e.target.value)}
                        className="input-field"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {t('atCommissionPct')}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      defaultValue={tariff.commission_percent}
                      onChange={(e) => setField(tariff.id, 'commission_percent', e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {t('atRateLimit')}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      defaultValue={tariff.rate_limit_per_min}
                      onChange={(e) => setField(tariff.id, 'rate_limit_per_min', e.target.value)}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {t('atDurationDays')}
                    </label>
                    {isFree(tariff) || isDoimiy(tariff) ? (
                      <div>
                        <input
                          type="text"
                          value={t('atDurationPermanent')}
                          disabled
                          className="input-field opacity-60"
                        />
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                          {t('atDurationPermanentNote')}
                        </p>
                      </div>
                    ) : (
                      <input
                        type="number"
                        step="1"
                        min="1"
                        defaultValue={tariff.duration_days || 30}
                        onChange={(e) => setField(tariff.id, 'duration_days', e.target.value)}
                        className="input-field"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                      {t('atFeatures')}
                    </label>
                    <textarea
                      rows={4}
                      defaultValue={
                        Array.isArray(tariff.features) ? tariff.features.join('\n') : tariff.features || ''
                      }
                      onChange={(e) => setField(tariff.id, 'features', e.target.value)}
                      className="input-field resize-y"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleSave(tariff)}
                  disabled={updateTariff.isPending}
                  className="btn btn-primary w-full"
                >
                  {t('save')}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Platform Wallet Info */}
      {wallet && (
        <div className="card p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            {t('atPlatformWallet')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('atAddress')}</p>
              <p className="text-xs font-mono text-gray-900 dark:text-white break-all">
                {wallet.wallet_address}
              </p>            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('atBalanceTon')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {wallet.balance_gram?.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('atTotalCommission')}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {wallet.total_commission_gram?.toFixed(2)} TON
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Yangi tarif qo'shish */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title={t('atAddTariffTitle')}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('atName')} *
            </label>
            <input
              type="text"
              value={newForm.name || ''}
              onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))}
              className="input-field"
              placeholder="Free, Lite, Pro..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('atDescription')}
            </label>
            <input
              type="text"
              value={newForm.description || ''}
              onChange={(e) => setNewForm((p) => ({ ...p, description: e.target.value }))}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('atPriceGram')}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={newForm.price_gram ?? ''}
              onChange={(e) => setNewForm((p) => ({ ...p, price_gram: e.target.value }))}
              className="input-field"
              placeholder="0.00"
            />
            {Number(newForm.price_gram || 0) === 0 && (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                {t('atPriceFreeNote')} — {t('atDurationPermanentNote')}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t('atCommissionPct')}
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={newForm.commission_percent ?? ''}
                onChange={(e) => setNewForm((p) => ({ ...p, commission_percent: e.target.value }))}
                className="input-field"
                placeholder="5"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                {t('atRateLimit')}
              </label>
              <input
                type="number"
                step="1"
                min="1"
                value={newForm.rate_limit_per_min ?? ''}
                onChange={(e) => setNewForm((p) => ({ ...p, rate_limit_per_min: e.target.value }))}
                className="input-field"
                placeholder="100"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('atDurationDays')}
            </label>
            {Number(newForm.price_gram || 0) === 0 ? (
              <div>
                <input
                  type="text"
                  value={t('atDurationPermanent')}
                  disabled
                  className="input-field opacity-60"
                />
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                  {t('atDurationPermanentNote')}
                </p>
              </div>
            ) : (
              <input
                type="number"
                step="1"
                min="1"
                value={newForm.duration_days ?? ''}
                onChange={(e) => setNewForm((p) => ({ ...p, duration_days: e.target.value }))}
                className="input-field"
                placeholder="30"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('atFeatures')}
            </label>
            <textarea
              rows={4}
              value={newForm.features || ''}
              onChange={(e) => setNewForm((p) => ({ ...p, features: e.target.value }))}
              className="input-field resize-y"
            />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setShowAdd(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={createTariff.isPending || !newForm.name?.trim()}
            onClick={handleCreate}
          >
            {createTariff.isPending ? t('processing') : t('atAddTariff')}
          </Button>
        </div>
      </Modal>

      {/* Arxivlangan tarifni o'chirish tasdiqlash */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('atDeleteConfirmTitle')}
      >
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-500 shrink-0">
            <TrashIcon className="w-5 h-5" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {t('atDeleteConfirmDesc')}{' '}
            <span className="font-bold text-gray-900 dark:text-white">{deleteTarget?.name}</span>
          </p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={deleteTariff.isPending}
            onClick={() => deleteTariff.mutate(deleteTarget.id)}
          >
            {deleteTariff.isPending ? t('processing') : t('atDelete')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
