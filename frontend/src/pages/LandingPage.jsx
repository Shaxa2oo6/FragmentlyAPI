import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { toast } from 'react-hot-toast';
import {
  Star,
  Zap,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  Code2,
  ChevronDown,
  Sun,
  Moon,
  Menu,
  X,
  User,
  Send,
  Sparkles,
  Layers,
  Clock,
  HelpCircle,
  Globe,
} from 'lucide-react';

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function TwitterIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
    </svg>
  );
}

const API_SEND_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.fragmently.uz') + '/v2/send';
const TELEGRAM_SUPPORT_URL = import.meta.env.VITE_TELEGRAM_SUPPORT_URL || 'https://t.me/fragmently_official';

const CODE_SNIPPETS = {
  curl: `curl -X POST "${API_SEND_URL}" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"username":"@durov","quantity":100}'`,
  python: `import requests

resp = requests.post(
    "${API_SEND_URL}",
    headers={
        "X-API-Key": "YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "username": "@durov",
        "quantity": 100,
    },
)
print(resp.json())`,
  node: `const res = await fetch("${API_SEND_URL}", {
  method: "POST",
  headers: {
    "X-API-Key": "YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    username: "@durov",
    quantity: 100,
  }),
});

const data = await res.json();
console.log(data);`,
};

const CODE_LANGS = ['curl', 'python', 'node'];

const CODE_RESPONSE = `{
  "success": true,
  "message": "100 Stars @durov ga yuborildi",
  "transaction_id": 987654,
  "status": "completed",
  "amount_paid": 2.525,
  "currency": "TON"
}`;

const FAQS = [
  {
    q: "API kalitni qanday olish mumkin?",
    a: "Ro'yxatdan o'ting, hamyoningizni ulang va Dashboard в†’ API Hujjatlar bo'limida avtomatik API kalit yaratiladi. Kalitni istalgan payt qayta generatsiya qilish mumkin."
  },
  {
    q: "To'lovlar qay tarzda amalga oshiriladi?",
    a: "To'lovlar TON va USDT (TRC-20/TON) kripto-valyutalari hamda hamyon balansi orqali avtomatik ravishda amalga oshiriladi."
  },
  {
    q: "Limit va komissiyalar qanday hisoblanadi?",
    a: "Bozordagi komissiyalarga qaraganda pastroq (0.5% gacha). Minimal xarid miqdori 50 Stars yoki 1 oylik Telegram Premium obunasi."
  },
  {
    q: "Buyurtma bajarilmasa nima bo'ladi?",
    a: "Agarda Telegram API tomonidan biror texnik uzilish yuz bersa, to'langan mablag' balansingizga 100% avtomatik qaytariladi."
  },
  {
    q: "Telegram Premium ham yuborish mumkinmi?",
    a: "Ha, API orqali istalgan foydalanuvchi username'iga 3, 6 va 12 oylik Telegram Premium obunalarini yuborishingiz mumkin."
  }
];

const INTEGRATION_STEPS = [
  {
    num: '01',
    icon: Sparkles,
    title: "API kalit yarating",
    desc: "Dashboard'da hisobingizni oching va bir zumda avtomatik API kalit hosil qiling."
  },
  {
    num: '02',
    icon: Send,
    title: "So'rov yuboring",
    desc: "REST API orqali mos parametrlarni (username, miqdor) so'rovingizda jo'nating."
  },
  {
    num: '03',
    icon: CheckCircle2,
    title: "Stars yetkaziladi",
    desc: "2-3 soniya ichida ko'rsatilgan Telegram akkountga Stars yetib boradi."
  }
];

function CodeWindow({ withResponse = true }) {
  const [activeLang, setActiveLang] = useState('curl');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_SNIPPETS[activeLang]);
    setCopied(true);
    toast.success('Kod nushalandi!', { id: 'code-copied-toast' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl overflow-hidden bg-[#080D18] border border-slate-800 shadow-2xl">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="ml-2 text-xs font-mono text-slate-400 font-medium truncate max-w-[180px] sm:max-w-none">
            POST {API_SEND_URL}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        </div>
      </div>

      {/* Code Language Switcher & Copy Button */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/60">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          {CODE_LANGS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setActiveLang(lang)}
              className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold uppercase transition-all ${
                activeLang === lang
                  ? 'bg-[#0D9488] text-white shadow-md shadow-[#0D9488]/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nusxalandi</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Nusxalash</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-4 sm:p-5 overflow-x-auto">
        <pre className="text-xs sm:text-sm font-mono text-teal-300 leading-relaxed">
          {CODE_SNIPPETS[activeLang]}
        </pre>
      </div>

      {/* Response Area */}
      {withResponse && (
        <div className="border-t border-slate-800 bg-slate-950/60 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 text-[11px] font-mono">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
              200 OK В· 128 ms
            </span>
            <span className="text-slate-500 uppercase font-bold tracking-wider">JAVOB</span>
          </div>
          <pre className="text-xs font-mono text-emerald-400/90 leading-relaxed overflow-x-auto">
            {CODE_RESPONSE}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  const handleStart = () => {
    navigate(user ? '/dashboard' : '/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-teal-50/20 to-white dark:from-[#080D18] dark:via-[#080D18] dark:to-[#080D18] text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200 overflow-x-hidden selection:bg-[#0D9488] selection:text-white">
      
      {/* 2.1 Header (Sticky) */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-[#080D18]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#0D9488] via-[#0F766E] to-[#14B8A6] text-white flex items-center justify-center shadow-lg shadow-[#0D9488]/30 group-hover:scale-105 transition-transform duration-200 shrink-0">
              <Star className="w-5 h-5 fill-white/20 stroke-white stroke-[2.2]" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white font-sans uppercase">
              FRAGMENTLY-API
            </span>
          </Link>

          {/* Nav links desktop */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-[#0D9488] dark:hover:text-teal-400 transition-colors">Imkoniyatlar</a>
            <a href="#steps" className="hover:text-[#0D9488] dark:hover:text-teal-400 transition-colors">Integratsiya</a>
            <a href="#faq" className="hover:text-[#0D9488] dark:hover:text-teal-400 transition-colors">FAQ</a>
          </nav>

          {/* Controls Right */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Tungi rejimni almashtirish"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-700" />}
            </button>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* User Auth CTA */}
            {user ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-xs shadow-lg shadow-[#0D9488]/25 transition-all"
              >
                <User className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#0F766E] hover:from-[#0F766E] hover:to-[#115E59] text-white font-bold text-xs shadow-lg shadow-[#0D9488]/25 transition-all"
              >
                <span>Kirish</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              aria-label="Menyuni ochish"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080D18] px-4 pt-3 pb-6 space-y-3">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Imkoniyatlar
            </a>
            <a
              href="#steps"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Integratsiya
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              FAQ
            </a>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleStart();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#0F766E] text-white font-bold text-sm shadow-md"
              >
                Hozir Boshlash в†’
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 2.2 Hero Bo'limi */}
      <section className="relative pt-12 pb-16 lg:pt-20 lg:pb-28 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#0D9488]/15 dark:bg-[#0D9488]/25 rounded-full blur-[140px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0D9488]/10 dark:bg-[#0D9488]/20 border border-[#0D9488]/20 text-[#0D9488] dark:text-teal-300 text-xs font-bold shadow-sm">
                <Sparkles className="w-4 h-4 text-[#0D9488]" />
                <span>вњЁ Telegram Stars & Premium Avtomatlashtirilgan API v2.0</span>
              </div>

              {/* Headline H1 */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15]">
                Telegram Stars va Premium xizmatlarini{' '}
                <span className="bg-gradient-to-r from-[#0D9488] via-[#0F766E] to-[#14B8A6] bg-clip-text text-transparent">
                  avtomatlashtirilgan boshqarish
                </span>{' '}
                va xarid qilish platformasi
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0 font-medium">
                Tezkor Fragment API integratsiyasi, real-vaqtdagi buyurtmalarni bajarish hamda Web3 TON va USDT to'lov tizimi
              </p>

              {/* Feature Pills */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1 text-xs font-bold">
                <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>2-3 soniyada avtomatik yetkazish</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/10 text-[#0D9488] dark:text-teal-300 border border-teal-500/20">
                  <ShieldCheck className="w-4 h-4 text-[#0D9488] shrink-0" />
                  <span>0% gacha komissiya</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20">
                  <Zap className="w-4 h-4 text-teal-500 shrink-0" />
                  <span>99.98% uptime kafolati</span>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleStart}
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#0F766E] hover:from-[#0F766E] hover:to-[#115E59] text-white font-extrabold text-sm sm:text-base shadow-xl shadow-[#0D9488]/30 transition-all flex items-center justify-center gap-2 group cursor-pointer"
                >
                  <span>Hozir Boshlash</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <Link
                  to="/api-docs"
                  className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#0D9488] dark:hover:border-[#0D9488] text-slate-800 dark:text-slate-200 font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <Code2 className="w-4 h-4 text-[#0D9488]" />
                  <span>API Hujjatlar</span>
                </Link>
              </div>
            </div>

            {/* Right Interactive Code Terminal Preview */}
            <div className="lg:col-span-6">
              <CodeWindow withResponse={true} />
            </div>
          </div>
        </div>
      </section>

      {/* 2.4 Ishga tushirish / Integratsiya bosqichlari bo'limi */}
      <section id="steps" className="py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0D9488]/10 text-[#0D9488] dark:text-teal-300 text-xs font-bold border border-[#0D9488]/20">
              <Layers className="w-4 h-4" />
              <span>API Integratsiyasi</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Ishga tushirish bir necha daqiqa
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">
              Ro'yxatdan o'ting, API kalit oling va Telegram Stars'ni bir necha qator kod bilan yuboring
            </p>
          </div>

          {/* 3 Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {INTEGRATION_STEPS.map((step) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={step.num}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-[#0D9488]/10 text-[#0D9488] flex items-center justify-center">
                      <StepIcon className="w-6 h-6" />
                    </div>
                    <span className="text-3xl font-black text-slate-200 dark:text-slate-800 select-none font-mono">
                      {step.num}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Additional concise code snippet sample */}
          <div className="max-w-3xl mx-auto">
            <CodeWindow withResponse={false} />
          </div>
        </div>
      </section>

      {/* 2.6 FAQ (ko'p so'raladigan savollar) Bo'limi */}
      <section id="faq" className="py-16 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center space-y-3 mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 text-[#0D9488] dark:text-teal-300 text-xs font-bold border border-teal-500/20">
              <HelpCircle className="w-4 h-4" />
              <span>Ko'p So'raladigan Savollar</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Barcha Savollaringizga Aniq Javoblar
            </h2>
          </div>

          {/* Accordion List */}
          <div className="space-y-4">
            {FAQS.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className={`rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 ${
                    isOpen
                      ? 'border-[#0D9488] shadow-md'
                      : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left gap-4 font-bold text-sm sm:text-base text-slate-900 dark:text-white"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-[#0D9488] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-0 text-xs sm:text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800/60 pt-3 leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2.7 Yakuniy CTA Bloki (Dark card) */}
      <section className="pb-16 sm:pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-[#121629] via-[#1E194B] to-[#0D101D] border border-slate-800 p-8 sm:p-14 text-center relative overflow-hidden shadow-2xl">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#0D9488]/20 rounded-full blur-[100px] pointer-events-none" />

          <div className="relative z-10 space-y-6 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold border border-white/20">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>вњЁ FRAGMENTLY-API v2.0</span>
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Bugun boshlang — API'ingiz bir daqiqada tayyor
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-medium">
              Ro'yxatdan o'ting, API kalit oling va Telegram Stars / Premium savdosini to'liq avtomatlashtiring
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleStart}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#0F766E] hover:from-[#0F766E] hover:to-[#115E59] text-white font-extrabold text-sm sm:text-base shadow-xl shadow-[#0D9488]/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Hozir Boshlash</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <Link
                to="/api-docs"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm sm:text-base border border-white/20 transition-all flex items-center justify-center gap-2"
              >
                <Code2 className="w-4 h-4 text-emerald-400" />
                <span>API Hujjatlar</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2.8 Footer */}
      <footer className="bg-white dark:bg-[#070A10] border-t border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
            
            {/* Brand column */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#0D9488] via-[#0F766E] to-[#14B8A6] text-white flex items-center justify-center shadow-md">
                  <Star className="w-4 h-4 fill-white/20 stroke-white" />
                </div>
                <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                  FRAGMENTLY-API
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                Telegram Stars va Premium xizmatlarini avtomatlashtirilgan tarzda sotib olish va boshqarish uchun eng ishonchli Web3 API platformasi.
              </p>
              <div className="flex items-center gap-3 text-slate-400">
                <a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="p-2 hover:text-[#0D9488] transition-colors" aria-label="Telegram">
                  <Send className="w-4 h-4" />
                </a>
                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="p-2 hover:text-[#0D9488] transition-colors" aria-label="GitHub">
                  <GithubIcon className="w-4 h-4" />
                </a>
                <a href="https://x.com" target="_blank" rel="noopener noreferrer" className="p-2 hover:text-[#0D9488] transition-colors" aria-label="Twitter/X">
                  <TwitterIcon className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Links Columns */}
            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                Mahsulot
              </h4>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <li><a href="#features" className="hover:text-[#0D9488] transition-colors">Imkoniyatlar</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                Hujjatlar
              </h4>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <li><Link to="/api-docs" className="hover:text-[#0D9488] transition-colors">API Hujjatlar</Link></li>
                <li><Link to="/terms" className="hover:text-[#0D9488] transition-colors">Foydalanish shartlari</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
                Kompaniya
              </h4>
              <ul className="space-y-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <li><a href="#faq" className="hover:text-[#0D9488] transition-colors">FAQ</a></li>
                <li><a href={TELEGRAM_SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#0D9488] transition-colors">Yordam boti</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200/80 dark:border-slate-800/80 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-slate-400">
            <p>В© {new Date().getFullYear()} FRAGMENTLY-API. Barcha huquqlar himoyalangan.</p>
            <p className="font-mono text-[11px]">Powered by Fragment Telegram API & TON Web3</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
