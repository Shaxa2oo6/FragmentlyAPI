import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { Settings, Wallet, CreditCard, Globe, Server, ShieldCheck } from 'lucide-react';

export default function AdminSettings() {
  const { data: platformWallet } = useQuery({
    queryKey: ['admin-platform-wallet'],
    queryFn: () => api.get('/api/admin/settings/wallet').then((res) => res.data),
  });

  const { data: tariffs } = useQuery({
    queryKey: ['admin-tariffs'],
    queryFn: () => api.get('/api/admin/settings/commission').then((res) => res.data),
  });

  const { data: allowedIps } = useQuery({
    queryKey: ['admin-allowed-ips'],
    queryFn: () => api.get('/api/admin/settings/ip-whitelist').then((res) => res.data),
  });

  const InfoRow = ({ label, value }) => (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-white font-mono text-right break-all">{value || '—'}</span>
    </div>
  );

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-1 h-8 rounded-full bg-indigo-500 inline-block"></span>
          Sozlamalar
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Platforma sozlamalari: hamyon, tariflar va kirish xavfsizligi
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Platform Wallet */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Platforma Hamyoni</h3>
              <p className="text-xs text-gray-400">Komissiyalar yig'iladigan asosiy hamyon</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <InfoRow label="Hamyon manzili" value={platformWallet?.wallet_address} />
            <InfoRow label="Balans (TON)" value={platformWallet?.balance_gram} />
            <InfoRow label="Balans (USDT)" value={platformWallet?.balance_usdt} />
            <InfoRow label="Jami komissiya (TON)" value={platformWallet?.total_commission_gram} />
            <InfoRow label="Jami komissiya (USDT)" value={platformWallet?.total_commission_usdt} />
          </div>
        </div>

        {/* Tariffs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tariflar</h3>
              <p className="text-xs text-gray-400">Amaldagi tarif rejalari va komissiyalar</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {(tariffs || []).map((t) => (
              <InfoRow
                key={t.id}
                label={`${t.name} — ${t.commission_percent}% komissiya`}
                value={`${t.price_gram} TON / $${t.price_usdt} · ${t.rate_limit_per_min} req/min`}
              />
            ))}
          </div>
        </div>

        {/* Allowed IPs */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">IP Whitelist</h3>
              <p className="text-xs text-gray-400">Ruxsat etilgan admin IP manzillar</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(allowedIps || []).length > 0 ? (
              allowedIps.map((ip) => (
                <span key={ip.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {ip.ip_address}
                </span>
              ))
            ) : (
              <p className="text-sm text-gray-400">Ruxsat etilgan IP mavjud emas (localhost standart ruxsatda)</p>
            )}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600">
              <Server className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Tizim Ma'lumotlari</h3>
              <p className="text-xs text-gray-400">Admin backend va platforma haqida</p>
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            <InfoRow label="Xizmat" value="Fragmently Admin Backend API" />
            <InfoRow label="Versiya" value="2.0.0" />
            <InfoRow label="Xavfsizlik" value="JWT + IP Whitelist" />
            <InfoRow label="API manzili" value={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001'} />
          </div>
        </div>
      </div>
    </div>
  );
}
