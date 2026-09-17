import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from './Sidebar';
import Header from './Header';
import Footer from './Footer';
import BottomNav from './BottomNav';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleOpenSidebar = () => setSidebarOpen(true);
  const handleCloseSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-[#F6F8FA] dark:bg-[#080D18] text-gray-900 dark:text-slate-100 overflow-x-hidden app-ambient">
      <Sidebar open={sidebarOpen} onClose={handleCloseSidebar} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header onOpenSidebar={handleOpenSidebar} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-10"> 
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    </div>
  );
}
