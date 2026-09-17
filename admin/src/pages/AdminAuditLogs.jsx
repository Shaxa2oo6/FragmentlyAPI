import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export default function AdminAuditLogs() {
  const [page, setPage] = useState(1);

  const { data: logsData, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', page],
    queryFn: () => api.get(`/api/v1/admin/audit-logs?page=${page}&limit=20`).then((res) => res.data),
  });

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            O'zgartirib Bo'lmaydigan Audit Loglar (Immutable Audit Log)
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Adminlar tomonidan bajarilgan barcha o'zgartirishlarning to'liq va himoyalangan jurnali (Faqat Superadmin).
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
          Superadmin Exclusive
        </span>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider border-b border-gray-200 dark:border-gray-800">
              <tr>
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4">Harakat (Action)</th>
                <th className="py-3 px-4">Obyekt / ID</th>
                <th className="py-3 px-4">Yangi Qiymat / Sabab</th>
                <th className="py-3 px-4">IP Manzil</th>
                <th className="py-3 px-4">Vaqt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-mono">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 font-sans">
                    Yuklanmoqda...
                  </td>
                </tr>
              ) : (logsData?.items || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500 font-sans">
                    Audit loglar topilmadi
                  </td>
                </tr>
              ) : (
                (logsData?.items || []).map((l) => (
                  <tr key={l.id} className="hover:bg-gray-100/60 dark:hover:bg-gray-800/40 transition">
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">#{l.id}</td>
                    <td className="py-3 px-4 text-indigo-600 dark:text-indigo-300 font-bold">@{l.admin_username}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-gray-200 dark:bg-gray-800 text-amber-600 dark:text-amber-300 border border-gray-300 dark:border-gray-700">
                        {l.action_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-700 dark:text-gray-300">
                      {l.target_object} #{l.target_id}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-gray-500 dark:text-gray-400 max-w-xs truncate">
                      {JSON.stringify(l.new_value || {})}
                    </td>
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400">{l.ip_address || '—'}</td>
                    <td className="py-3 px-4 text-gray-500 text-[11px]">
                      {l.created_at ? new Date(l.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-gray-50 dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Jami loglar: {logsData?.total || 0} ta</span>

          <div className="flex items-center gap-2 font-sans">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-40"
            >
              Orqaga
            </button>
            <span className="font-mono text-gray-900 dark:text-white">
              {page} / {logsData?.total_pages || 1}
            </span>
            <button
              type="button"
              disabled={page >= (logsData?.total_pages || 1)}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 disabled:opacity-40"
            >
              Oldinga
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
