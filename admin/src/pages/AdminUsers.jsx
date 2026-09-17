import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from 'react-hot-toast';
import {
  UsersIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  NoSymbolIcon,
  CreditCardIcon,
} from '@heroicons/react/24/outline';
import { shortenAddress, formatNumber } from '../utils/helpers';

export default function AdminUsers() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [tariffFilter, setTariffFilter] = useState('');
  const [walletFilter, setWalletFilter] = useState('');

  const [selectedUserId, setSelectedUserId] = useState(null);

  const [tariffModalUser, setTariffModalUser] = useState(null);
  const [newTariff, setNewTariff] = useState('Lite');
  const [tariffReason, setTariffReason] = useState('');

  const [blockModalUser, setBlockModalUser] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', page, searchTerm, roleFilter, tariffFilter, walletFilter],
    queryFn: () =>
      api
        .get('/api/v1/admin/users', {
          params: {
            page,
            limit: 15,
            q: searchTerm || undefined,
            role: roleFilter || undefined,
            tariff: tariffFilter || undefined,
            wallet_status: walletFilter || undefined,
          },
        })
        .then((res) => res.data),
  });

  const { data: userDetail } = useQuery({
    queryKey: ['admin-user-detail', selectedUserId],
    queryFn: () => api.get(`/api/v1/admin/users/${selectedUserId}`).then((res) => res.data),
    enabled: Boolean(selectedUserId),
  });

  const updateTariffMutation = useMutation({
    mutationFn: ({ userId, tariffPlan, reason }) =>
      api.put(`/api/v1/admin/users/${userId}/tariff`, { tariff_plan: tariffPlan, reason }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setTariffModalUser(null);
      setTariffReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Xatolik yuz berdi"),
  });

  const toggleBlockMutation = useMutation({
    mutationFn: ({ userId, reason }) =>
      api.post(`/api/v1/admin/users/${userId}/toggle-block`, { reason }),
    onSuccess: (res) => {
      toast.success(res.data.message);
      setBlockModalUser(null);
      setBlockReason('');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err.response?.data?.detail || "Xatolik yuz berdi"),
  });

  const handleApplyTariff = () => {
    if (!tariffReason || tariffReason.length < 5) {
      toast.error("O'zgartirish sababini yozing (kamida 5 ta belgi)");
      return;
    }
    updateTariffMutation.mutate({
      userId: tariffModalUser.id,
      tariffPlan: newTariff,
      reason: tariffReason,
    });
  };

  const handleApplyBlock = () => {
    if (!blockReason || blockReason.length < 5) {
      toast.error("Sababni kiriting (kamida 5 ta belgi)");
      return;
    }
    toggleBlockMutation.mutate({
      userId: blockModalUser.id,
      reason: blockReason,
    });
  };

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          Foydalanuvchilarni Boshqarish (User Management)
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Tizimdagi barcha foydalanuvchilar ro'yxati, tariflar va ruxsatlarni boshqarish.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Username / Email / Hamyon..."
              className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Barcha Rollar</option>
            <option value="user">User</option>
            <option value="reseller">Reseller</option>
            <option value="support">Support</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>

          <select
            value={tariffFilter}
            onChange={(e) => {
              setTariffFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Barcha Tariflar</option>
            <option value="Free">Free</option>
            <option value="Lite">Lite</option>
            <option value="Pro">Pro</option>
          </select>

          <select
            value={walletFilter}
            onChange={(e) => {
              setWalletFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Hamyon Holati</option>
            <option value="connected">Hamyon Ulangan</option>
            <option value="not_connected">Hamyon Ulanmagan</option>
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4">ID / User</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Tarif</th>
                <th className="py-3 px-4">Hamyon</th>
                <th className="py-3 px-4">Balans (TON / USDT)</th>
                <th className="py-3 px-4">Holat</th>
                <th className="py-3 px-4 text-right">Harakatlar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : (usersData?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Foydalanuvchilar topilmadi
                  </td>
                </tr>
              ) : (
                (usersData?.items || []).map((u) => (
                  <tr key={u.id} className="hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-white font-extrabold flex items-center justify-center text-[11px] shrink-0">
                          {u.username[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 dark:text-white truncate">@{u.username}</p>
                          <p className="text-[10px] text-gray-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-gray-200 dark:bg-gray-800 text-indigo-600 dark:text-indigo-300 border border-gray-300 dark:border-gray-700">
                        {u.role}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.tariff_plan === 'Pro'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : u.tariff_plan === 'Lite'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                            : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {u.tariff_plan || 'Free'}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-gray-700 dark:text-gray-300">
                      {u.wallet_address ? shortenAddress(u.wallet_address, 6, 4) : <span className="text-gray-400 dark:text-gray-600">Ulanmagan</span>}
                    </td>

                    <td className="py-3 px-4 font-mono">
                      <span className="text-gray-900 dark:text-white font-bold">{formatNumber(u.balance_gram)}</span>{' '}
                      <span className="text-primary-500 dark:text-primary-400 text-[10px]">TON</span>
                      <span className="text-gray-500 text-[10px] block">
                        (${formatNumber(u.balance_usdt)} USDT)
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {u.is_active ? 'Faol' : 'Bloklangan'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 transition"
                        >
                          Batafsil
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setTariffModalUser(u);
                            setNewTariff(u.tariff_plan || 'Lite');
                          }}
                          className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition"
                          title="Tarifni o'zgartirish"
                        >
                          <CreditCardIcon className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setBlockModalUser(u)}
                          className={`p-1.5 rounded-lg transition ${
                            u.is_active
                              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                          title={u.is_active ? 'Bloklash' : 'Blokdan chiqarish'}
                        >
                          <NoSymbolIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Jami: {usersData?.total || 0} ta foydalanuvchi</span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-40"
            >
              Orqaga
            </button>
            <span className="font-mono text-gray-900 dark:text-white">
              {page} / {usersData?.total_pages || 1}
            </span>
            <button
              type="button"
              disabled={page >= (usersData?.total_pages || 1)}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-40"
            >
              Oldinga
            </button>
          </div>
        </div>
      </div>

      {selectedUserId && userDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 text-white font-extrabold flex items-center justify-center text-sm">
                  {userDetail.username[0]?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">@{userDetail.username}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{userDetail.email}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-lg bg-gray-100 dark:bg-gray-800"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-gray-100 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-gray-500 block">Rol</span>
                <span className="font-bold text-gray-900 dark:text-white uppercase">{userDetail.role}</span>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-gray-500 block">Tarif Plan</span>
                <span className="font-bold text-primary-500 dark:text-primary-400">{userDetail.tariff_plan}</span>
              </div>
              <div className="p-3 bg-gray-100 dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-gray-500 block">TON Balans</span>
                <span className="font-bold text-emerald-400 font-mono">{formatNumber(userDetail.balance_gram)} TON</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Tranzaksiyalar Tarixi</h4>
              <div className="divide-y divide-gray-200 dark:divide-gray-800 max-h-48 overflow-y-auto bg-gray-100 dark:bg-gray-950 rounded-xl p-2 border border-gray-200 dark:border-gray-800">
                {(userDetail.transactions || []).length === 0 ? (
                  <p className="text-xs text-gray-500 p-2">Tranzaksiyalar mavjud emas</p>
                ) : (
                  (userDetail.transactions || []).map((t) => (
                    <div key={t.id} className="py-2 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-white">#{t.id} {t.type}</span>
                        <span className="text-gray-500 text-[10px] block">Qabul qiluvchi: {t.target}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-emerald-400">{t.amount} {t.currency}</span>
                        <span className="text-[10px] text-gray-500 block">{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {tariffModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Tarifni O'zgartirish: @{tariffModalUser.username}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Yangi Tarif Plan:</label>
                <select
                  value={newTariff}
                  onChange={(e) => setNewTariff(e.target.value)}
                  className="w-full p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white font-bold"
                >
                  <option value="Free">Free</option>
                  <option value="Lite">Lite</option>
                  <option value="Pro">Pro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">O'zgartirish Sababi (Audit logga yoziladi):</label>
                <textarea
                  rows={3}
                  value={tariffReason}
                  onChange={(e) => setTariffReason(e.target.value)}
                  placeholder="Masalan: Support sorovi bo'yicha promo bonus berildi..."
                  className="w-full p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleApplyTariff}
                disabled={updateTariffMutation.isPending}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                {updateTariffMutation.isPending ? 'Saqlanmoqda...' : 'Tarifni Saqlash'}
              </button>
              <button
                type="button"
                onClick={() => setTariffModalUser(null)}
                className="px-4 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition min-h-[44px]"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

      {blockModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {blockModalUser.is_active ? "Foydalanuvchini Bloklash" : "Blokdan Chiqarish"}: @{blockModalUser.username}
            </h3>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sababini kiriting (Audit log uchun):</label>
              <textarea
                rows={3}
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Masalan: Shubhali faoliyat yoki admin taqiqi..."
                className="w-full p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleApplyBlock}
                disabled={toggleBlockMutation.isPending}
                className={`flex-1 py-3 text-white rounded-xl text-xs font-bold transition min-h-[44px] ${
                  blockModalUser.is_active ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {toggleBlockMutation.isPending
                  ? 'Bajarilmoqda...'
                  : blockModalUser.is_active
                  ? 'Ha, Bloklash'
                  : 'Blokdan Chiqarish'}
              </button>
              <button
                type="button"
                onClick={() => setBlockModalUser(null)}
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
