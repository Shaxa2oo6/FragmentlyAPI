import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import DashboardHeader from '../components/Dashboard/DashboardHeader';
import InfoBanner from '../components/Dashboard/InfoBanner';
import TotalTurnoverCard from '../components/Dashboard/TotalTurnoverCard';
import StatsGrid from '../components/Dashboard/StatsGrid';
import TransactionChartsSection from '../components/Dashboard/TransactionChartsSection';
import RecentTransactionsSection from '../components/Dashboard/RecentTransactionsSection';

export default function Dashboard() {
  const [isRefreshingManual, setIsRefreshingManual] = useState(false);

  // 1. Query for summary analytics stats: GET /api/v1/analytics/summary/ (fallback /api/v1/analytics/dashboard)
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/v1/analytics/summary/');
        return res.data;
      } catch (err1) {
        try {
          const res = await api.get('/api/v1/analytics/dashboard');
          return res.data;
        } catch (err2) {
          return null;
        }
      }
    },
    staleTime: 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Global Refresh Action for all dashboard components
  const handleGlobalRefresh = async () => {
    setIsRefreshingManual(true);
    await Promise.all([
      refetchSummary(),
    ]);
    setTimeout(() => setIsRefreshingManual(false), 600);
  };

  // Safe normalized values from DB
  const safeStats = {
    gram_turnover: summaryData?.total_gram_volume ?? summaryData?.gram_turnover ?? 0,
    usdt_turnover: summaryData?.total_usdt_volume ?? summaryData?.usdt_turnover ?? 0,
    success_rate: summaryData?.success_rate_percent ?? summaryData?.success_rate ?? 0,
    total_stars: summaryData?.total_stars_sold ?? summaryData?.total_stars ?? 0,
    total_premium: summaryData?.total_premium_activated ?? summaryData?.total_premium ?? 0,
    completed: summaryData?.completed_count ?? summaryData?.completed ?? 0,
    pending: summaryData?.pending_count ?? summaryData?.pending ?? 0,
    failed: summaryData?.failed_count ?? summaryData?.failed ?? 0,
    recent_transactions: summaryData?.recent_transactions || summaryData?.results || [],
    wallet_address: summaryData?.wallet_address || 'UQDsuZ39vP4xK8yL9c9hL',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Sarlavha qatori (Header Row) */}
      <DashboardHeader
        onRefresh={handleGlobalRefresh}
        isRefreshing={isSummaryLoading || isRefreshingManual}
        walletAddress={safeStats.wallet_address}
      />

      {/* 2. Bildirishnoma banneri (Info Banner) */}
      <InfoBanner />

      {/* 3. Jami hisob-kitoblar aylanmasi kartasi (Total Turnover Card) */}
      <TotalTurnoverCard
        gramTurnover={safeStats.gram_turnover}
        usdtTurnover={safeStats.usdt_turnover}
      />

      {/* 4. Statistika kartalar tarmog'i (5 Stats Cards Grid) */}
      <StatsGrid stats={safeStats} />

      {/* 5. Tranzaksiya grafikalari bo'limi (Line & Pie Charts with API Period/Metric queries) */}
      <TransactionChartsSection stats={safeStats} />

      {/* 6. So'nggi tranzaksiyalar bo'limi (Auto-fetching Recent Orders with Key Normalization) */}
      <RecentTransactionsSection
        transactions={safeStats.recent_transactions}
        onRefreshParent={handleGlobalRefresh}
      />
    </div>
  );
}
