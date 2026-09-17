import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { copyToClipboard, getErrorMessage } from '../utils/helpers';

// API base URL .env orqali sozlanadi (VITE_API_BASE_URL)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.fragmently.uz';
import {
  Search,
  Copy,
  Check,
  Send,
  Code,
  Terminal,
  Key,
  ChevronDown,
  ChevronUp,
  Play,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Menu,
} from 'lucide-react';

const rawEndpoints = [
  {
    id: 'buy-stars-v1',
    category: 'Stars API',
    method: 'POST',
    path: '/api/v1/stars/buy/',
    title: {
      uz: 'Telegram Stars sotib olish',
      en: 'Purchase Telegram Stars',
      ru: 'Покупка Telegram Stars',
      tg: 'Хариди Telegram Stars',
    },
    desc: {
      uz: 'API Key orqali istalgan Telegram username ga avtomatik Telegram Stars yuborish.',
      en: 'Send Telegram Stars automatically to any Telegram username via API Key.',
      ru: 'Автоматическая отправка Telegram Stars на любой Telegram username через API Key.',
      tg: 'Интиқоли худкори Telegram Stars ба дилхоҳ Telegram username тавассути API Key.',
    },
    params: [
      {
        name: 'username',
        type: 'string',
        required: true,
        desc: {
          uz: 'Qabul qiluvchi Telegram username (masalan: @durov)',
          en: 'Recipient Telegram username (e.g. @durov)',
          ru: 'Telegram username получателя (например: @durov)',
          tg: 'Telegram username-и қабулкунанда (масалан: @durov)',
        },
        example: '@durov',
      },
      {
        name: 'quantity',
        type: 'integer',
        required: true,
        desc: {
          uz: 'Sotib olinadigan Stars miqdori (min: 50, max: 10000)',
          en: 'Quantity of Stars to purchase (min: 50, max: 10000)',
          ru: 'Количество покупаемых Stars (мин: 50, макс: 10000)',
          tg: 'Миқдори Stars-и харидашаванда (мин: 50, макс: 10000)',
        },
        example: '100',
      },
      {
        name: 'payment_method',
        type: 'string',
        required: true,
        options: ['TON', 'USDT'],
        desc: {
          uz: "To'lov valyutasi ('TON' yoki 'USDT')",
          en: "Payment currency ('TON' or 'USDT')",
          ru: "Валюта оплаты ('TON' или 'USDT')",
          tg: "Асъори пардохт ('TON' ё 'USDT')",
        },
        example: 'TON',
      },
    ],
    successResponse: {
      success: true,
      message: '100 Stars @durov ga yuborish uchun qabul qilindi.',
      transaction_id: 987654,
      quantity: 100,
      target_username: 'durov',
      amount_paid: 2.525,
      currency: 'TON',
      remaining_balance: 12.3,
      status: 'completed',
    },
    errorCodes: [
      { code: '401', name: 'API_KEY_MISSING / INVALID_API_KEY', desc: { uz: 'API kalit kiritilmagan yoki noto\'g\'ri', en: 'API key missing or invalid', ru: 'API-ключ не указан или неверен', tg: 'Калиди API ворид нашуда ё нодуруст' } },
      { code: '400', name: 'INVALID_USERNAME', desc: { uz: 'Telegram username noto\'g\'ri', en: 'Invalid Telegram username', ru: 'Неверный Telegram username', tg: 'Telegram username нодуруст' } },
      { code: '400', name: 'INVALID_PAYMENT_METHOD', desc: { uz: 'Noto\'g\'ri payment_method (TON yoki USDT)', en: 'Invalid payment_method (TON or USDT)', ru: 'Неверный payment_method (TON или USDT)', tg: 'payment_method нодуруст (TON ё USDT)' } },
      { code: '402', name: 'INSUFFICIENT_BALANCE', desc: { uz: 'Balans yetarli emas', en: 'Insufficient balance', ru: 'Недостаточно средств', tg: 'Маблағ нокифоя' } },
      { code: '422', name: 'VALIDATION_ERROR', desc: { uz: 'Parametrlar noto\'g\'ri (quantity ≥ 50)', en: 'Invalid parameters (quantity ≥ 50)', ru: 'Неверные параметры (quantity ≥ 50)', tg: 'Параметрҳо нодуруст (quantity ≥ 50)' } },
      { code: '429', name: 'RATE_LIMIT_EXCEEDED', desc: { uz: 'So\'rovlar limiti oshdi', en: 'Rate limit exceeded', ru: 'Превышен лимит запросов', tg: 'Лимити дархостҳо зиёд шуд' } },
    ],
  },
  {
    id: 'stars-price',
    category: 'Stars API',
    method: 'GET',
    path: '/api/stars/price',
    title: {
      uz: 'Stars Joriy Narxini Olish',
      en: 'Get Current Stars Price',
      ru: 'Получить Текущую Цену Stars',
      tg: 'Гирифтани Нархи Ҷории Stars',
    },
    desc: {
      uz: 'Real-vaqtdagi Telegram Stars birlik narxlari (TON va USDT valyutalarida).',
      en: 'Real-time Telegram Stars unit pricing in TON and USDT.',
      ru: 'Актуальные цены Telegram Stars в валютах TON и USDT.',
      tg: 'Нархҳои реалӣ Telegram Stars бо асъорҳои TON ва USDT.',
    },
    params: [],
    successResponse: {
      price: 0.01116,
      currency: 'GRAM',
      source: 'fragment.com',
      ton_usd: 2.5,
      updated_at: '2026-08-12T17:00:00Z',
    },
  },
  {
    id: 'buy-premium',
    category: 'Premium API',
    method: 'POST',
    path: '/api/premium/buy',
    title: {
      uz: 'Telegram Premium Sotib Olish',
      en: 'Purchase Telegram Premium',
      ru: 'Покупка Telegram Premium',
      tg: 'Хариди Telegram Premium',
    },
    desc: {
      uz: 'Istalgan Telegram username ga 3, 6 yoki 12 oylik Premium obunasini yuborish.',
      en: 'Gift 3, 6, or 12 months Telegram Premium subscription to any Telegram username.',
      ru: 'Отправка подписки Telegram Premium на 3, 6 или 12 месяцев на любой Telegram username.',
      tg: 'Интиқоли обунаи 3, 6 ё 12-моҳаи Telegram Premium ба дилхоҳ Telegram username.',
    },
    params: [
      {
        name: 'username',
        type: 'string',
        required: true,
        desc: {
          uz: 'Telegram username (masalan: @durov)',
          en: 'Telegram username (e.g. @durov)',
          ru: 'Telegram username (например: @durov)',
          tg: 'Telegram username (масалан: @durov)',
        },
        example: '@durov',
      },
      {
        name: 'months',
        type: 'integer',
        required: true,
        options: ['3', '6', '12'],
        desc: {
          uz: 'Obuna muddati oylarda (3, 6, 12 oy)',
          en: 'Subscription duration in months (3, 6, 12 months)',
          ru: 'Срок подписки в месяцах (3, 6, 12 месяцев)',
          tg: 'Мӯҳлати обуна бо моҳҳо (3, 6, 12 моҳ)',
        },
        example: '3',
      },
      {
        name: 'payment_method',
        type: 'string',
        required: true,
        options: ['TON', 'USDT'],
        desc: {
          uz: "To'lov valyutasi ('TON' yoki 'USDT')",
          en: "Payment currency ('TON' or 'USDT')",
          ru: "Валюта оплаты ('TON' или 'USDT')",
          tg: "Асъори пардохт ('TON' ё 'USDT')",
        },
        example: 'TON',
      },
    ],
    successResponse: {
      success: true,
      message: 'Telegram Premium 3 oy @durov ga yuborish qabul qilindi.',
      transaction_id: 123456,
      months: 3,
      amount_paid: 5.04,
      currency: 'TON',
      status: 'completed',
    },
    errorCodes: [
      { code: '401', name: 'API_KEY_MISSING / INVALID_API_KEY', desc: { uz: 'API kalit kiritilmagan yoki noto\'g\'ri', en: 'API key missing or invalid', ru: 'API-ключ не указан или неверен', tg: 'Калиди API ворид нашуда ё нодуруст' } },
      { code: '403', name: 'WALLET_NOT_CONNECTED', desc: { uz: 'Hamyon ulanmagan', en: 'Wallet not connected', ru: 'Кошелёк не подключён', tg: 'Ҳамён пайваст нашудааст' } },
      { code: '400', name: 'INVALID_USERNAME / INVALID_MONTHS', desc: { uz: 'Username yoki oylar soni noto\'g\'ri (3, 6, 12)', en: 'Invalid username or months (3, 6, 12)', ru: 'Неверный username или кол-во месяцев (3, 6, 12)', tg: 'Username ё моҳҳо нодуруст (3, 6, 12)' } },
      { code: '402', name: 'INSUFFICIENT_BALANCE', desc: { uz: 'Balans yetarli emas', en: 'Insufficient balance', ru: 'Недостаточно средств', tg: 'Маблағ нокифоя' } },
      { code: '429', name: 'RATE_LIMIT_EXCEEDED', desc: { uz: 'So\'rovlar limiti oshdi', en: 'Rate limit exceeded', ru: 'Превышен лимит запросов', tg: 'Лимити дархостҳо зиёд шуд' } },
    ],
  },
  {
    id: 'premium-price',
    category: 'Premium API',
    method: 'GET',
    path: '/api/premium/price',
    title: {
      uz: 'Premium Tarif Narxlari',
      en: 'Premium Tariff Pricing',
      ru: 'Тарифы на Premium',
      tg: 'Нархномаи Premium',
    },
    desc: {
      uz: 'Telegram Premium obunalari uchun joriy tarif va narxlar jadvali.',
      en: 'Current pricing schedule for Telegram Premium subscriptions.',
      ru: 'Таблица текущих цен и тарифов на подписки Telegram Premium.',
      tg: 'Ҷадвали нархҳои ҷорӣ барои обунаҳои Telegram Premium.',
    },
    params: [],
    successResponse: {
      currency: 'GRAM',
      ton_usd: 2.5,
      months: 3,
      price: 5.04,
      usd: 12.6,
      duration_days: 91,
    },
  },
  {
    id: 'order-status',
    category: 'Orders API',
    method: 'GET',
    path: '/api/v1/orders/status/{order_id}/',
    title: {
      uz: 'Buyurtma Holatini Tekshirish',
      en: 'Check Order Status',
      ru: 'Проверка Статуса Заказа',
      tg: 'Санҷиши Ҳолати Супориш',
    },
    desc: {
      uz: "Noyob transaction_id bo'yicha buyurtmaning joriy holati va tafsilotlarini olish.",
      en: 'Get order details and real-time status by unique transaction_id.',
      ru: 'Получение статуса и деталей заказа по уникальному transaction_id.',
      tg: 'Гирифтани ҳолат ва ҷузъиёти супориш тавассути transaction_id.',
    },
    params: [
      {
        name: 'order_id',
        type: 'string',
        required: true,
        desc: {
          uz: 'Buyurtma identifikatori (masalan: tx_9823412)',
          en: 'Order identifier (e.g. tx_9823412)',
          ru: 'Идентификатор заказа (например: tx_9823412)',
          tg: 'Идентификатори супориш (масалан: tx_9823412)',
        },
        example: 'tx_9823412',
      },
    ],
    successResponse: {
      success: true,
      order_id: 'tx_9823412',
      transaction_id: 9823412,
      type: 'stars',
      status: 'completed',
      amount: 2.525,
      currency: 'TON',
      target_username: 'durov',
      quantity: 100,
      created_at: '2026-08-12T15:30:00Z',
    },
    errorCodes: [
      { code: '404', name: 'ORDER_NOT_FOUND', desc: { uz: 'Buyurtma topilmadi', en: 'Order not found', ru: 'Заказ не найден', tg: 'Супориш ёфт нашуд' } },
      { code: '400', name: 'INVALID_ORDER_ID', desc: { uz: 'order_id noto\'g\'ri formatda', en: 'Invalid order_id format', ru: 'Неверный формат order_id', tg: 'Формати order_id нодуруст' } },
      { code: '401', name: 'API_KEY_MISSING / INVALID_API_KEY', desc: { uz: 'API kalit kiritilmagan yoki noto\'g\'ri', en: 'API key missing or invalid', ru: 'API-ключ не указан или неверен', tg: 'Калиди API ворид нашуда ё нодуруст' } },
    ],
  },
  {
    id: 'wallet-balance',
    category: 'Wallet API',
    method: 'GET',
    path: '/api/wallet/balance',
    title: {
      uz: 'Hamyon Balansini Olish',
      en: 'Get Wallet Balance',
      ru: 'Баланс Кошелька',
      tg: 'Баланси Ҳамён',
    },
    desc: {
      uz: 'Ulangan Web3 hamyondagi real-vaqt TON va USDT balanslarini olish.',
      en: 'Retrieve real-time TON and USDT balances of the connected Web3 wallet.',
      ru: 'Получение текущего баланса TON и USDT подключенного кошелька.',
      tg: 'Гирифтани баланси ҷории TON ва USDT-и ҳамёни пайвастшуда.',
    },
    params: [],
    successResponse: {
      balance_gram: 0.2312,
      balance_usdt: 40.2,
      updated_at: '2026-08-12T17:00:00Z',
    },
    errorCodes: [
      { code: '401', name: 'API_KEY_MISSING / INVALID_API_KEY', desc: { uz: 'API kalit kiritilmagan yoki noto\'g\'ri', en: 'API key missing or invalid', ru: 'API-ключ не указан или неверен', tg: 'Калиди API ворид нашуда ё нодуруст' } },
      { code: '404', name: 'WALLET_NOT_CONNECTED', desc: { uz: 'Hamyon ulanmagan', en: 'Wallet not connected', ru: 'Кошелёк не подключён', tg: 'Ҳамён пайваст нашудааст' } },
      { code: '500', name: 'INTERNAL_ERROR', desc: { uz: 'Server ichki xatoligi', en: 'Internal server error', ru: 'Внутренняя ошибка сервера', tg: 'Хатогии дохилии сервер' } },
    ],
  },
];

const methodStyles = {
  GET: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-bold',
  POST: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-bold',
  PUT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-bold',
  DELETE: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold',
};

const tabBarStyles = {
  GET: 'border-emerald-500/40 bg-emerald-500/5',
  POST: 'border-blue-500/40 bg-blue-500/5',
  PUT: 'border-amber-500/40 bg-amber-500/5',
  DELETE: 'border-rose-500/40 bg-rose-500/5',
};

// Full Multi-language UI Dictionaries
const dict = {
  uz: {
    pageTitle: 'API Reference & Hujjatlar',
    pageSubtitle: 'REST API orqali Telegram Stars va Premium xizmatlarini avtomatlashtirish',
    baseUrlLabel: 'Asosiy URL (Base URL)',
    baseUrlValue: 'https://api.fragmently.uz',
    baseUrlProd: 'PROD',
    baseUrlDesc: "Barcha so'rovlar shu manzil asosida quriladi. Endpointlar /api/v1/ prefiksi bilan boshlanadi.",
    manageApiKey: "API Key'larni boshqarish (Profil)",
    filterPlaceholder: 'Endpointlarni qidirish...',
    noEndpoints: 'Endpoint topilmadi',
    paramsAndHeaders: 'Parametrlar va Headerlar',
    headerName: 'Header Nomi',
    type: 'Tipi',
    requiredStatus: 'Majburiyligi',
    description: 'Tavsifi',
    requiredYes: 'Ha (Majburiy)',
    requiredNo: 'Yo\'q (Ixtiyoriy)',
    codeSnippetAndResponse: 'Kod Namunasi va Javob Misoli',
    exampleResponse: 'Javob Namuna (200 OK):',
    errorCodesTitle: 'Xato Kodlari (Error Codes)',
    errorCode: 'Kod',
    errorName: 'Xato',
    errorDesc: 'Tavsif',
    tryItOutTitle: "Sinab Ko'rish (Interactive Sandbox)",
    tryItOutHide: 'Yashirish',
    tryItOutShow: "Sinab ko'rish",
    sendRequest: "Sinab Ko'rish (Send Test Request)",
    sending: "So'rov yuborilmoqda...",
    requestSuccess: "So'rov muvaffaqiyatli bajarildi!",
    requestError: "API so'rovida xatolik yuz berdi",
    copy: 'Nusxalash',
    copied: 'Nusxalandi!',
    apiKeyHeader: 'API Kalit (X-API-Key Header):',
    apiKeyPlaceholder: 'X-API-Key kiritishingiz mumkin...',
    selectEndpointMobile: 'Endpoint tanlash...',
  },
  en: {
    pageTitle: 'API Reference & Documentation',
    pageSubtitle: 'Automate Telegram Stars and Premium via REST API',
    baseUrlLabel: 'Base URL',
    baseUrlValue: 'https://api.fragmently.uz',
    baseUrlProd: 'PROD',
    baseUrlDesc: 'All requests are built on top of this address. Endpoints start with the /api/v1/ prefix.',
    manageApiKey: 'Manage API Keys (Profile)',
    filterPlaceholder: 'Filter endpoints...',
    noEndpoints: 'No endpoints found',
    paramsAndHeaders: 'Parameters & Headers',
    headerName: 'Header Name',
    type: 'Type',
    requiredStatus: 'Required',
    description: 'Description',
    requiredYes: 'Yes (Required)',
    requiredNo: 'No (Optional)',
    codeSnippetAndResponse: 'Code Snippet & Response Example',
    exampleResponse: 'Example Response (200 OK):',
    errorCodesTitle: 'Error Codes',
    errorCode: 'Code',
    errorName: 'Error',
    errorDesc: 'Description',
    tryItOutTitle: 'Try It Out (Interactive Sandbox)',
    tryItOutHide: 'Hide',
    tryItOutShow: 'Try it out',
    sendRequest: 'Send Test Request',
    sending: 'Sending request...',
    requestSuccess: 'Request executed successfully!',
    requestError: 'API request failed',
    copy: 'Copy',
    copied: 'Copied!',
    apiKeyHeader: 'API Key (X-API-Key Header):',
    apiKeyPlaceholder: 'Enter X-API-Key...',
    selectEndpointMobile: 'Select endpoint...',
  },
  ru: {
    pageTitle: 'Справочник API и Документация',
    pageSubtitle: 'Автоматизация Telegram Stars и Premium через REST API',
    baseUrlLabel: 'Базовый URL',
    baseUrlValue: 'https://api.fragmently.uz',
    baseUrlProd: 'ПРОД',
    baseUrlDesc: 'Все запросы строятся на основе этого адреса. Эндпоинты начинаются с префикса /api/v1/.',
    manageApiKey: 'Управление API Ключами (Профиль)',
    filterPlaceholder: 'Поиск эндпоинтов...',
    noEndpoints: 'Эндпоинты не найдены',
    paramsAndHeaders: 'Параметры и Заголовки',
    headerName: 'Имя Заголовка',
    type: 'Тип',
    requiredStatus: 'Обязательность',
    description: 'Описание',
    requiredYes: 'Да (Обязательно)',
    requiredNo: 'Нет (Опционально)',
    codeSnippetAndResponse: 'Пример Кода и Образец Ответа',
    exampleResponse: 'Образец Ответа (200 OK):',
    errorCodesTitle: 'Коды Ошибок (Error Codes)',
    errorCode: 'Код',
    errorName: 'Ошибка',
    errorDesc: 'Описание',
    tryItOutTitle: 'Попробовать (Интерактивный Песочница)',
    tryItOutHide: 'Скрыть',
    tryItOutShow: 'Попробовать',
    sendRequest: 'Отправить Тестовый Запрос',
    sending: 'Отправка запроса...',
    requestSuccess: 'Запрос успешно выполнен!',
    requestError: 'Ошибка выполнения API запроса',
    copy: 'Копировать',
    copied: 'Скопировано!',
    apiKeyHeader: 'API Ключ (X-API-Key Header):',
    apiKeyPlaceholder: 'Введите X-API-Key...',
    selectEndpointMobile: 'Выбрать эндпоинт...',
  },
  tg: {
    pageTitle: 'Маълумотномаи API ва Ҳуҷҷатҳо',
    pageSubtitle: 'Автоматизатсияи Telegram Stars ва Premium тавассути REST API',
    baseUrlLabel: 'URL-и асосӣ',
    baseUrlValue: 'https://api.fragmently.uz',
    baseUrlProd: 'ПРОД',
    baseUrlDesc: 'Ҳамаи дархостҳо дар асоси ин суроға сохта мешаванд. Эндпоинтҳо бо пешванди /api/v1/ оғоз меёбанд.',
    manageApiKey: 'РРґРѕСЂР°кунии РљР°Р»идҳои API (РџСЂРѕС„РёР»)',
    filterPlaceholder: 'Ҷустуҷӯи эндпоинтҳо...',
    noEndpoints: 'Эндпоинт ёфт нашуд',
    paramsAndHeaders: 'Параметрҳо ва Сарлавҳаҳо',
    headerName: 'Номи Сарлавҳа',
    type: 'Намуд',
    requiredStatus: 'Ҳатмӣ',
    description: 'Тавсиф',
    requiredYes: 'Ҳа (Ҳатмӣ)',
    requiredNo: 'Не (Ихтиёрӣ)',
    codeSnippetAndResponse: 'Намунаи Код ва Ҷавоб',
    exampleResponse: 'Намунаи Ҷавоб (200 OK):',
    errorCodesTitle: 'Рамзҳои Хатогӣ (Error Codes)',
    errorCode: 'Рамз',
    errorName: 'Хатогӣ',
    errorDesc: 'Тавсиф',
    tryItOutTitle: 'Санҷидан (Интерактив Sandbox)',
    tryItOutHide: 'Пинҳон кардан',
    tryItOutShow: 'Санҷидан',
    sendRequest: 'Фиристодани Дархост',
    sending: 'Фиристода истодааст...',
    requestSuccess: 'Дархост бо муваффақият иҷро шуд!',
    requestError: 'Хатогӣ дар дархости API',
    copy: 'Нусхабардорӣ',
    copied: 'Нусхабардорӣ шуд!',
    apiKeyHeader: 'Калиди API (X-API-Key Header):',
    apiKeyPlaceholder: 'X-API-Key-ро дохил кунед...',
    selectEndpointMobile: 'Интихоби эндпоинт...',
  },
};

export default function ApiDocs() {
  const { lang } = useLanguage();
  const txt = dict[lang] || dict.uz;

  const [selectedEndpointId, setSelectedEndpointId] = useState(rawEndpoints[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [codeLang, setCodeLang] = useState('curl');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);

  // Mobile Menu Dropdown Toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sandbox Accordion Collapse Toggle
  const [sandboxOpen, setSandboxOpen] = useState(false);

  // Sandbox State
  const [testHeaders, setTestHeaders] = useState({ 'X-API-Key': '' });
  const [apiKeyError, setApiKeyError] = useState('');
  const [testParamInputs, setTestParamInputs] = useState({});
  const [testBody, setTestBody] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [testResponse, setTestResponse] = useState(null);
  const [testLatency, setTestLatency] = useState(null);

  // User Profile Query for API Key
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/api/users/me').then((res) => res.data),
  });

  const userApiKey = profile?.api_token || '';

  const selectedEndpoint = rawEndpoints.find((e) => e.id === selectedEndpointId) || rawEndpoints[0];

  // Sync test inputs when selected endpoint changes
  useEffect(() => {
    if (!selectedEndpoint) return;
    setTestHeaders({ 'X-API-Key': userApiKey, 'Content-Type': 'application/json' });
    setApiKeyError('');

    // Build initial individual parameter inputs
    const initialParamMap = {};
    (selectedEndpoint.params || []).forEach((p) => {
      initialParamMap[p.name] = p.example || '';
    });
    setTestParamInputs(initialParamMap);

    // Format body
    if (selectedEndpoint.method === 'POST') {
      setTestBody(JSON.stringify(initialParamMap, null, 2));
    } else {
      setTestBody('');
    }

    setTestResponse(null);
    setTestLatency(null);
  }, [selectedEndpointId, userApiKey]);

  // Handler for individual parameter input change
  const handleParamInputChange = (paramName, value) => {
    const updated = { ...testParamInputs, [paramName]: value };
    setTestParamInputs(updated);
    if (selectedEndpoint.method === 'POST') {
      setTestBody(JSON.stringify(updated, null, 2));
    }
  };

  // Group Endpoints by Category
  const groupedEndpoints = rawEndpoints.reduce((acc, ep) => {
    const titleText = (ep.title[lang] || ep.title.uz || '').toLowerCase();
    const pathText = ep.path.toLowerCase();
    const query = searchQuery.toLowerCase();

    if (query && !titleText.includes(query) && !pathText.includes(query)) {
      return acc;
    }

    if (!acc[ep.category]) {
      acc[ep.category] = [];
    }
    acc[ep.category].push(ep);
    return acc;
  }, {});

  // Generate Code Snippets (cURL, JS, Python, Node)
  const generateSnippet = (ep, l) => {
    const baseUrl = API_BASE_URL;
    const apiKey = testHeaders['X-API-Key'] || 'YOUR_API_KEY';
    const bodyString = selectedEndpoint.method === 'POST' ? JSON.stringify(testParamInputs, null, 2) : '';

    // Path parametrlarini (masalan {order_id}) URL ichiga joylashtiramiz.
    // POST: parametrlar faqat JSON body'da bo'ladi (query string YO'Q).
    // GET:  qolgan parametrlar query string sifatida qo'shiladi.
    const resolvePath = (path) => {
      let url = path;
      const query = [];
      const isPost = selectedEndpoint.method === 'POST';
      Object.keys(testParamInputs).forEach((name) => {
        const placeholder = `{${name}}`;
        if (url.includes(placeholder)) {
          url = url.replace(placeholder, encodeURIComponent(String(testParamInputs[name] ?? '')));
        } else if (!isPost && testParamInputs[name] !== undefined && testParamInputs[name] !== '') {
          query.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(testParamInputs[name]))}`);
        }
      });
      const qs = query.length ? `?${query.join('&')}` : '';
      return url + qs;
    };

    const snippetPath = resolvePath(ep.path);

    if (l === 'curl') {
      if (ep.method === 'GET') {
        return `curl -X GET "${baseUrl}${snippetPath}" \\
  -H "X-API-Key: ${apiKey}"`;
      }
      return `curl -X POST "${baseUrl}${snippetPath}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey}" \\
  -d '${bodyString}'`;
    }

    if (l === 'js') {
      if (ep.method === 'GET') {
        return `fetch("${baseUrl}${snippetPath}", {
  headers: { "X-API-Key": "${apiKey}" }
})
.then(res => res.json())
.then(data => console.log(data));`;
      }
      return `fetch("${baseUrl}${snippetPath}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKey}"
  },
  body: JSON.stringify(${bodyString})
})
.then(res => res.json())
.then(data => console.log(data));`;
    }

    if (l === 'python') {
      if (ep.method === 'GET') {
        return `import requests

res = requests.get("${baseUrl}${snippetPath}", headers={"X-API-Key": "${apiKey}"})
print(res.json())`;
      }
      return `import requests

headers = {"Content-Type": "application/json", "X-API-Key": "${apiKey}"}
payload = ${bodyString}

res = requests.post("${baseUrl}${snippetPath}", headers=headers, json=payload)
print(res.json())`;
    }

    if (l === 'node') {
      if (ep.method === 'GET') {
        return `const axios = require('axios');

axios.get("${baseUrl}${snippetPath}", { headers: { 'X-API-Key': '${apiKey}' } })
  .then(res => console.log(res.data));`;
      }
      return `const axios = require('axios');

axios.post("${baseUrl}${snippetPath}", ${bodyString}, {
  headers: { 'X-API-Key': '${apiKey}' }
})
.then(res => console.log(res.data));`;
    }

    return '';
  };

  // Run Test Request with strict validation
  const handleExecuteRequest = async () => {
    const keyVal = (testHeaders['X-API-Key'] || '').trim();
    if (!keyVal) {
      setApiKeyError('Iltimos, API kalitingizni kiriting!');
      toast.error('API kalitingizni kiriting!');
      return;
    }
    setApiKeyError('');

    // Path parametrlarini (masalan {order_id}) URL ichiga joylashtiramiz.
    // Qolgan parametrlar query string / body sifatida yuboriladi.
    const resolvePath = (path) => {
      let url = path;
      const query = {};
      Object.keys(testParamInputs).forEach((name) => {
        const placeholder = `{${name}}`;
        if (url.includes(placeholder)) {
          url = url.replace(placeholder, encodeURIComponent(String(testParamInputs[name] ?? '')));
        } else {
          query[name] = testParamInputs[name];
        }
      });
      return { url, query };
    };

    setIsExecuting(true);
    setTestResponse(null);
    const startTime = performance.now();

    try {
      let resData;
      let resStatus = 200;

      const { url, query } = resolvePath(selectedEndpoint.path);

      if (selectedEndpoint.method === 'GET') {
        const res = await api.get(url, {
          headers: { 'X-API-Key': keyVal },
          params: query,
        });
        resData = res.data;
        resStatus = res.status || 200;
      } else {
        const res = await api.post(url, testParamInputs, {
          headers: { 'X-API-Key': keyVal },
        });
        resData = res.data;
        resStatus = res.status || 200;
      }

      const endTime = performance.now();
      setTestLatency(Math.round(endTime - startTime));
      setTestResponse({ status: resStatus, statusText: 'OK', data: resData });
      toast.success(txt.requestSuccess);
    } catch (err) {
      const endTime = performance.now();
      setTestLatency(Math.round(endTime - startTime));
      const errResponse = err.response || {};
      const status = errResponse.status || 401;

      const errorPayload = errResponse.data || {
        success: false,
        error: status === 401 ? 'INVALID_API_KEY' : 'BAD_REQUEST',
        status_code: status,
        message: getErrorMessage(err, txt.requestError),
      };

      setTestResponse({
        status: status,
        statusText: status === 401 ? 'Unauthorized' : 'Bad Request',
        data: errorPayload,
      });

      toast.error(errorPayload.message || 'API So\'rovida Xatolik');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyCode = () => {
    copyToClipboard(generateSnippet(selectedEndpoint, codeLang));
    setCopiedCode(true);
    toast.success(txt.copied);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyPath = () => {
    copyToClipboard(selectedEndpoint.path);
    setCopiedPath(true);
    toast.success(txt.copied);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const handleCopyResponse = () => {
    copyToClipboard(JSON.stringify(selectedEndpoint.successResponse, null, 2));
    setCopiedResponse(true);
    toast.success(txt.copied);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleCopyBaseUrl = () => {
    copyToClipboard(API_BASE_URL);
    setCopiedBaseUrl(true);
    toast.success(txt.copied);
    setTimeout(() => setCopiedBaseUrl(false), 2000);
  };

  // ---- Reusable small bits ----
  const ParamRequiredBadge = ({ required }) =>
    required ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20 shrink-0">
        <span className="w-1 h-1 rounded-full bg-rose-500" />
        {txt.requiredYes}
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 shrink-0">
        {txt.requiredNo}
      </span>
    );

  const TypeChip = ({ type }) => (
    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shrink-0">
      {type}
    </span>
  );

  const CopyButton = ({ copied, onClick, label }) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer shrink-0 border border-slate-700 active:scale-95"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{copied ? txt.copied : label || txt.copy}</span>
    </button>
  );

  // Code body wrapper — horizontal scroll on overflow (never clips on mobile)
  const CodeBody = ({ children, tone = 'text-slate-200' }) => (
    <div className={`p-3 sm:p-4 bg-slate-950 font-mono text-[11px] sm:text-[13px] leading-relaxed select-all overflow-x-auto no-scrollbar ${tone}`}>
      <pre className="whitespace-pre min-w-max font-mono">{children}</pre>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8 pb-6 sm:pb-10">
      {/* MINIMAL TOP BAR */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 sm:pb-5">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-sans tracking-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0D9488] to-[#2DD4BF]">API</span>{' '}
            Reference
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 break-words">
            {txt.pageSubtitle}
          </p>
        </div>

        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#0D9488] to-[#2DD4BF] hover:opacity-95 text-white transition-all border border-transparent shadow-lg shadow-[#0D9488]/20 shrink-0"
        >
          <Key className="w-4 h-4" />
          <span className="truncate max-w-[180px] sm:max-w-none">{txt.manageApiKey}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* BASE URL HERO BLOCK */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0D9488] via-[#2DD4BF] to-[#0D9488] p-[1.5px] shadow-lg shadow-[#0D9488]/15">
        <div className="rounded-2xl bg-white dark:bg-slate-900 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {txt.baseUrlLabel}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 tracking-wide uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {txt.baseUrlProd}
                </span>
              </div>
              <p className="mt-1 font-mono text-sm sm:text-lg font-bold text-slate-900 dark:text-white break-all select-all tracking-tight">
                {API_BASE_URL}
              </p>
              <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 break-words">
                {txt.baseUrlDesc}
              </p>
            </div>
            <CopyButton copied={copiedBaseUrl} onClick={handleCopyBaseUrl} label={txt.copy} />
          </div>
        </div>
      </div>

      {/* MOBILE ENDPOINT SELECTOR DROPDOWN (VISIBLE ONLY ON MOBILE < lg) */}
      <div className="block lg:hidden space-y-2">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className={`w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border flex items-center justify-between shadow-sm cursor-pointer text-left ${
            tabBarStyles[selectedEndpoint.method] || 'border-slate-200 dark:border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded text-[10px] uppercase border shrink-0 ${methodStyles[selectedEndpoint.method]}`}>
              {selectedEndpoint.method}
            </span>
            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {selectedEndpoint.title[lang] || selectedEndpoint.title.uz}
            </span>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${mobileMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {mobileMenuOpen && (
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-3 animate-fade-in">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={txt.filterPlaceholder}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
              />
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {Object.entries(groupedEndpoints).map(([cat, list]) => (
                <div key={cat} className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 block">{cat}</span>
                  {list.map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        setSelectedEndpointId(ep.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center gap-2 ${
                        ep.id === selectedEndpointId
                          ? 'bg-[#0D9488]/10 text-[#0D9488] dark:text-[#2DD4BF] font-bold'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase border shrink-0 ${methodStyles[ep.method]}`}>
                        {ep.method}
                      </span>
                      <span className="truncate">{ep.title[lang] || ep.title.uz}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CLEAN 2-COLUMN STRIPE & POSTMAN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* COLUMN 1: DESKTOP STICKY SIDEBAR (lg:col-span-3 - HIDDEN ON MOBILE) */}
        <aside className="hidden lg:block lg:col-span-3 space-y-4 lg:sticky lg:top-4 self-start shrink-0">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={txt.filterPlaceholder}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0D9488]/40"
            />
          </div>

          {/* Grouped Endpoints Navigation */}
          <nav className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto pr-1">
            {Object.keys(groupedEndpoints).length === 0 ? (
              <p className="text-xs text-slate-400 p-2">{txt.noEndpoints}</p>
            ) : (
              Object.entries(groupedEndpoints).map(([cat, list]) => (
                <div key={cat} className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 block">
                    {cat}
                  </span>
                  <div className="space-y-0.5">
                    {list.map((ep) => {
                      const active = ep.id === selectedEndpointId;
                      return (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() => setSelectedEndpointId(ep.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                            active
                              ? 'bg-[#0D9488]/10 dark:bg-[#0D9488]/20 text-[#0D9488] dark:text-[#2DD4BF] font-bold border border-[#0D9488]/30'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                          }`}
                        >
                          <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase border shrink-0 ${methodStyles[ep.method]}`}>
                            {ep.method}
                          </span>
                          <span className="truncate">{ep.title[lang] || ep.title.uz}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </nav>
        </aside>

        {/* COLUMN 2: MAIN CONTENT AREA (lg:col-span-9) */}
        <div className="lg:col-span-9 space-y-6 sm:space-y-8 min-w-0">

          {/* SECTION 1: ENDPOINT HEADER & URL BAR */}
          <div className="space-y-3 pb-4 sm:pb-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-md text-xs uppercase border ${methodStyles[selectedEndpoint.method]}`}>
                {selectedEndpoint.method}
              </span>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                {selectedEndpoint.category}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-sans tracking-tight break-words">
              {selectedEndpoint.title[lang] || selectedEndpoint.title.uz}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              {selectedEndpoint.desc[lang] || selectedEndpoint.desc.uz}
            </p>

            {/* Monospaced URL Bar */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950 font-mono text-xs sm:text-sm text-emerald-400 border border-slate-800 flex items-center justify-between gap-3 shadow-inner">
              <span className="break-all font-semibold select-all">{selectedEndpoint.path}</span>
              <button
                type="button"
                onClick={handleCopyPath}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer shrink-0 active:scale-95"
                title={txt.copy}
              >
                {copiedPath ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* SECTION 2: PARAMETERS & HEADERS (MOBILE CARD LAYOUT vs DESKTOP TABLE) */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <span className="w-1 h-3.5 rounded-full bg-[#0D9488]" />
              {txt.paramsAndHeaders}
            </h3>

            {/* DESKTOP TABLE (HIDDEN ON MOBILE < md) */}
            <div className="hidden md:block rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs min-w-0">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="p-3.5">{txt.headerName}</th>
                    <th className="p-3.5">{txt.type}</th>
                    <th className="p-3.5">{txt.requiredStatus}</th>
                    <th className="p-3.5">{txt.description}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {/* Header Row */}
                  <tr>
                    <td className="p-3.5 font-mono font-bold text-[#0D9488] dark:text-[#2DD4BF] whitespace-nowrap">X-API-Key</td>
                    <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">header (string)</td>
                    <td className="p-3.5"><ParamRequiredBadge required /></td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">Profil Sozlamalaridan olingan API Key</td>
                  </tr>

                  {/* Body / Query Params */}
                  {selectedEndpoint.params && selectedEndpoint.params.map((param) => (
                    <tr key={param.name}>
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{param.name}</td>
                      <td className="p-3.5 font-mono text-slate-400 whitespace-nowrap">{param.type}</td>
                      <td className="p-3.5"><ParamRequiredBadge required={param.required} /></td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 break-words">
                        {param.desc[lang] || param.desc.uz}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS (VISIBLE ONLY ON MOBILE < md) */}
            <div className="block md:hidden space-y-3">
              {/* Header Parameter Card */}
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <span className="font-mono font-bold text-[#0D9488] dark:text-[#2DD4BF] text-xs sm:text-sm">X-API-Key</span>
                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60">header (string)</span>
                  </div>
                  <ParamRequiredBadge required />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                  Profil Sozlamalaridan olingan API Key
                </p>
              </div>

              {/* Endpoint Parameter Cards */}
              {selectedEndpoint.params && selectedEndpoint.params.map((param) => (
                <div key={param.name} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{param.name}</span>
                      <TypeChip type={param.type} />
                    </div>
                    <ParamRequiredBadge required={param.required} />
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                    {param.desc[lang] || param.desc.uz}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 3: CODE SNIPPET & RESPONSE PREVIEW WITH REFACTORED TOOLBAR */}
          <div className="space-y-5 sm:space-y-6">

            {/* CODE SNIPPET BLOCK — heading row, then tabs row, then pre */}
            <div className="space-y-2">
              <div className="rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                {/* Code Toolbar - Title row */}
                <div className="bg-slate-900 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Terminal className="w-4 h-4 text-[#0D9488] shrink-0" />
                    <h3 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-300 truncate">
                      {txt.codeSnippetAndResponse}
                    </h3>
                  </div>

                  {/* Dedicated Copy Button in Toolbar */}
                  <CopyButton copied={copiedCode} onClick={handleCopyCode} />
                </div>

                {/* Language tabs — separate row, horizontally scrollable chips */}
                <div className="bg-slate-900/80 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-800 overflow-x-auto flex-nowrap no-scrollbar">
                  <div className="flex items-center gap-1.5 w-max">
                    {['curl', 'js', 'python', 'node'].map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setCodeLang(l)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                          codeLang === l
                            ? 'bg-gradient-to-r from-[#0D9488] to-[#2DD4BF] text-white shadow-sm'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Code Body — wraps, never clips */}
                <CodeBody tone="text-emerald-400">{generateSnippet(selectedEndpoint, codeLang)}</CodeBody>
              </div>
            </div>

            {/* RESPONSE PREVIEW BLOCK WITH TOP TOOLBAR */}
            <div className="space-y-2">
              <div className="rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                {/* Response Toolbar */}
                <div className="bg-slate-900 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-xs font-bold text-slate-300 truncate">{txt.exampleResponse}</span>
                  </div>

                  <CopyButton copied={copiedResponse} onClick={handleCopyResponse} />
                </div>

                {/* Response JSON Body — wraps, never clips */}
                <CodeBody>{JSON.stringify(selectedEndpoint.successResponse, null, 2)}</CodeBody>
              </div>
            </div>

            {/* ERROR CODES BLOCK */}
            {selectedEndpoint.errorCodes && selectedEndpoint.errorCodes.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{txt.errorCodesTitle}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[11px]">
                        <th className="text-left font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2.5 px-4 w-[70px]">
                          {txt.errorCode}
                        </th>
                        <th className="text-left font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2.5 px-4">
                          {txt.errorName}
                        </th>
                        <th className="text-left font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider py-2.5 px-4">
                          {txt.errorDesc}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
                      {selectedEndpoint.errorCodes.map((ec, i) => (
                        <tr key={i} className="text-xs hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg font-mono font-bold ${
                              String(ec.code).startsWith('4') || String(ec.code).startsWith('5')
                                ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {ec.code}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {ec.name}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400">
                            {ec.desc[lang] || ec.desc.uz || ec.desc.en}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

          {/* SECTION 4: INTERACTIVE SANDBOX WITH INDIVIDUAL FORM INPUTS */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setSandboxOpen(!sandboxOpen)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/50 flex items-center justify-between cursor-pointer transition-colors text-left"
            >
              <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-900 dark:text-white font-sans">
                <Play className="w-4 h-4 text-[#0D9488] fill-[#0D9488]" />
                <span>{txt.tryItOutTitle}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-slate-400 font-semibold">
                  {sandboxOpen ? txt.tryItOutHide : txt.tryItOutShow}
                </span>
                {sandboxOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </button>

            {sandboxOpen && (
              <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 space-y-4 border-t border-slate-200 dark:border-slate-800 animate-fade-in">
                {/* 1. Header input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                    {txt.apiKeyHeader} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={testHeaders['X-API-Key']}
                    onChange={(e) => {
                      setTestHeaders({ ...testHeaders, 'X-API-Key': e.target.value });
                      if (e.target.value.trim()) setApiKeyError('');
                    }}
                    placeholder={txt.apiKeyPlaceholder}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                      apiKeyError
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-800 focus:ring-[#0D9488]/40'
                    }`}
                  />
                  {apiKeyError && (
                    <p className="text-xs text-rose-500 font-bold mt-1 animate-fade-in flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{apiKeyError}</span>
                    </p>
                  )}
                </div>

                {/* 2. Individual Parameter Form Inputs */}
                {selectedEndpoint.params && selectedEndpoint.params.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                      Endpoint Parametrlari (Form Inputs):
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {selectedEndpoint.params.map((p) => (
                        <div key={p.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] gap-2">
                            <label className="font-mono font-bold text-slate-700 dark:text-slate-300 truncate">
                              {p.name} {p.required && <span className="text-rose-500">*</span>}
                            </label>
                            <span className="text-slate-400 font-mono text-[10px] shrink-0">{p.type}</span>
                          </div>

                          {p.options ? (
                            <select
                              value={testParamInputs[p.name] || ''}
                              onChange={(e) => handleParamInputChange(p.name, e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/40 cursor-pointer"
                            >
                              {p.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={p.type === 'integer' ? 'number' : 'text'}
                              value={testParamInputs[p.name] || ''}
                              onChange={(e) => handleParamInputChange(p.name, e.target.value)}
                              placeholder={p.example || ''}
                              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/40"
                            />
                          )}
                          <p className="text-[10px] text-slate-400 leading-snug break-words">
                            {p.desc[lang] || p.desc.uz}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Action button */}
                <button
                  type="button"
                  onClick={handleExecuteRequest}
                  disabled={isExecuting}
                  className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#0D9488] to-[#2DD4BF] hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-[#0D9488]/25 active:scale-[0.99]"
                >
                  {isExecuting ? (
                    <span>{txt.sending}</span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>{txt.sendRequest}</span>
                    </>
                  )}
                </button>

                {/* 4. Real Execution Output & Status Formatting */}
                {testResponse && (
                  <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-black tracking-wide uppercase border ${
                        testResponse.status === 200
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : testResponse.status === 401
                          ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400 border-rose-500/40 font-black'
                          : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      }`}>
                        {testResponse.status} {testResponse.statusText} {testLatency ? `(${testLatency}ms)` : ''}
                      </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          {testResponse.status === 200 ? 'Success' : 'Error'}
                        </span>
                    </div>

                    <pre className={`p-3 sm:p-4 rounded-xl bg-slate-950 font-mono text-[11px] sm:text-[13px] max-h-60 overflow-x-auto overflow-y-auto whitespace-pre no-scrollbar border border-slate-800 leading-relaxed select-all ${
                      testResponse.status === 200 ? 'text-emerald-400' : 'text-rose-400 font-semibold'
                    }`}>
                      {JSON.stringify(testResponse.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}