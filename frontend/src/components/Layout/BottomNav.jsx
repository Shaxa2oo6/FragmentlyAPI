import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  DocumentTextIcon,
  CreditCardIcon,
  UserIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { useLanguage } from '../../context/LanguageContext';

const items = [
  { to: '/dashboard', icon: HomeIcon, key: 'navDashboard', label: 'Bosh sahifa' },
  { to: '/transactions', icon: DocumentTextIcon, key: 'navTransactions', label: 'Tranzaksiyalar' },
  { to: '/mnemonic', icon: KeyIcon, key: 'navMnemonic', label: 'Hamyon' },
  { to: '/subscriptions', icon: CreditCardIcon, key: 'navSubscriptions', label: 'Obunalar' },
  { to: '/profile', icon: UserIcon, key: 'navProfile', label: 'Profil' },
];

export default function BottomNav() {
  const { t } = useLanguage();
  const { pathname } = useLocation();

  // Pastki navigatsiya umuman yashirilgan — istalmagan (user talabi).
  return null;

  if (pathname.startsWith('/admin')) return null;

  return (
    <nav className="bottom-nav lg:hidden">
      <div className="flex">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon />
            <span className="truncate px-1">{t(item.key) || item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
