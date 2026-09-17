import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import {
  ArrowLeftIcon,
  QuestionMarkCircleIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  LifebuoyIcon,
} from '@heroicons/react/24/outline';

const CONTACT_TELEGRAM = import.meta.env.VITE_CONTACT_TELEGRAM || '@fragmently_support';
const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || 'support@fragmently.uz';
const CONTACT_TELEGRAM_CHANNEL = import.meta.env.VITE_CONTACT_TELEGRAM_CHANNEL || '@fragmently_news';

const helpContent = {
  uz: {
    back: 'Orqaga',
    title: 'Yordam va Qo\'llab-quvvatlash',
    subtitle:
      'FRAGMENTLY-API platformasidan foydalanishda yuzaga keladigan eng ko\'p uchraydigan savollarga javoblar.',
    faqTitle: 'Tez-tez so\'raladigan savollar',
    faqs: [
      {
        q: 'Stars xaridini qanday amalga oshiraman?',
        a: 'Avval Mnemonic Token sahifasida TON hamyoningizni mnemonic seed-phrase orqali ulang. So\'ngra Stars buyurtmasini API orqali yuboring — balansingizdan to\'lov yechilib, Telegram Stars avtomatik yuboriladi.',
      },
      {
        q: 'Hamyonni qanday ulash mumkin?',
        a: 'Mnemonic Token sahifasiga o\'ting, 12 yoki 24 so\'zdan iborat seed-phrase iborani kiriting va "Hamyonni Ulash" tugmasini bosing. Ibora shifrlangan holda saqlanadi.',
      },
      {
        q: 'Xarid uchun qaysi valyutalar qabul qilinadi?',
        a: 'Platformada TON (GRAM) va USDT to\'lov usullari qo\'llab-quvvatlanadi. To\'lov usulini buyurtma berish vaqtida tanlashingiz mumkin.',
      },
      {
        q: 'Xarid bajarilmasa, pul qaytadimi?',
        a: 'Ha. Texnik xatolik natijasida bajarilmagan xaridlar uchun to\'liq summa va komissiya qaytariladi. Qaytarish sababi transaksiya tarixida qayd etiladi.',
      },
      {
        q: 'API kalitni qanday olish mumkin?',
        a: 'Ro\'yxatdan o\'tganingizdan so\'ng shaxsiy API kalit (X-API-Key) avtomatik yaratiladi. Uni API Hujjatlar sahifasidan ko\'rishingiz va qayta generatsiya qilishingiz mumkin. Lekin API kalit bilan ishlash uchun avval TON hamyonini ulash shart.',
      },
      {
        q: 'Tarif rejalari qanday farq qiladi?',
        a: 'Free rejasi bepul (5% komissiya, 10 so\'rov/daq.), Lite va Pro rejalari kamroq komissiya va yuqoriroq so\'rov limitlarini taqdim etadi. Batafsil ma\'lumot Obunalar sahifasida.',
      },
    ],
    resourcesTitle: 'Foydali resurslar',
    resources: [
      {
        icon: DocumentTextIcon,
        title: 'API Hujjatlar',
        desc: 'Barcha endpointlar va kod namunalari',
        to: '/api-docs',
        cta: 'Ochish',
      },
      {
        icon: CodeBracketIcon,
        title: 'Transaksiyalar',
        desc: 'Xaridlar va to\'lovlar tarixini ko\'ring',
        to: '/transactions',
        cta: 'Ochish',
      },
      {
        icon: QuestionMarkCircleIcon,
        title: 'Foydalanish Shartlari',
        desc: 'Xizmat shartlari bilan tanishib chiqing',
        to: '/terms',
        cta: 'Ochish',
      },
    ],
    contactTitle: 'Biz bilan bog\'lanish',
    contactDesc:
      'Savolingizga javob topa olmadingizmi? Bizning jamoamiz 24/7 yordam berishga tayyor.',
    contactItems: [
      {
        icon: ChatBubbleLeftRightIcon,
        label: 'Telegram qo\'llab-quvvatlash',
        value: CONTACT_TELEGRAM,
        href: `https://t.me/${CONTACT_TELEGRAM.replace('@', '')}`,
      },
      {
        icon: LifebuoyIcon,
        label: 'Email',
        value: CONTACT_EMAIL,
        href: `mailto:${CONTACT_EMAIL}`,
      },
      {
        icon: QuestionMarkCircleIcon,
        label: 'Telegram kanal',
        value: CONTACT_TELEGRAM_CHANNEL,
        href: `https://t.me/${CONTACT_TELEGRAM_CHANNEL.replace('@', '')}`,
      },
    ],
  },
  ru: {
    back: 'Назад',
    title: 'Помощь и Поддержка',
    subtitle:
      'Ответы на наиболее частые вопросы об использовании платформы FRAGMENTLY-API.',
    faqTitle: 'Часто задаваемые вопросы',
    faqs: [
      {
        q: 'Как купить Stars?',
        a: 'Сначала подключите TON кошелёк через mnemonic seed-phrase на странице Mnemonic Token. Затем отправьте заказ Stars через API — средства списываются с баланса, и Telegram Stars отправляются автоматически.',
      },
      {
        q: 'Как подключить кошелёк?',
        a: 'Перейдите на страницу Mnemonic Token, введите seed-phrase из 12 или 24 слов и нажмите «Подключить кошелёк». Фраза хранится в зашифрованном виде.',
      },
      {
        q: 'Какие валюты принимаются к оплате?',
        a: 'Платформа поддерживает TON (GRAM) и USDT. Способ оплаты выбирается при оформлении заказа.',
      },
      {
        q: 'Вернутся ли деньги, если покупка не выполнится?',
        a: 'Да. При технической ошибке возвращается полная сумма вместе с комиссией. Причина возврата фиксируется в истории транзакций.',
      },
      {
        q: 'Как получить API ключ?',
        a: 'После регистрации персональный API ключ (X-API-Key) создаётся автоматически. Вы можете просмотреть и перегенерировать его на странице API Документы. Для работы с API ключом необходимо сначала подключить TON кошелёк.',
      },
      {
        q: 'Чем отличаются тарифные планы?',
        a: 'Free — бесплатный (5% комиссия, 10 запросов/мин), Lite и Pro предлагают меньшую комиссию и более высокие лимиты. Подробнее на странице Подписки.',
      },
    ],
    resourcesTitle: 'Полезные ресурсы',
    resources: [
      {
        icon: DocumentTextIcon,
        title: 'API Документы',
        desc: 'Все endpoint’ы и примеры кода',
        to: '/api-docs',
        cta: 'Открыть',
      },
      {
        icon: CodeBracketIcon,
        title: 'Транзакции',
        desc: 'История покупок и платежей',
        to: '/transactions',
        cta: 'Открыть',
      },
      {
        icon: QuestionMarkCircleIcon,
        title: 'Условия использования',
        desc: 'Ознакомьтесь с условиями сервиса',
        to: '/terms',
        cta: 'Открыть',
      },
    ],
    contactTitle: 'Свяжитесь с нами',
    contactDesc: 'Не нашли ответ? Наша команда готова помочь 24/7.',
    contactItems: [
      {
        icon: ChatBubbleLeftRightIcon,
        label: 'Telegram поддержка',
        value: CONTACT_TELEGRAM,
        href: `https://t.me/${CONTACT_TELEGRAM.replace('@', '')}`,
      },
      {
        icon: LifebuoyIcon,
        label: 'Email',
        value: CONTACT_EMAIL,
        href: `mailto:${CONTACT_EMAIL}`,
      },
      {
        icon: QuestionMarkCircleIcon,
        label: 'Telegram канал',
        value: CONTACT_TELEGRAM_CHANNEL,
        href: `https://t.me/${CONTACT_TELEGRAM_CHANNEL.replace('@', '')}`,
      },
    ],
  },
  en: {
    back: 'Back',
    title: 'Help & Support',
    subtitle:
      'Answers to the most common questions about using the FRAGMENTLY-API platform.',
    faqTitle: 'Frequently Asked Questions',
    faqs: [
      {
        q: 'How do I buy Stars?',
        a: 'First, connect your TON wallet via mnemonic seed phrase on the Mnemonic Token page. Then send a Stars order via the API — the payment is deducted from your balance and Telegram Stars are sent automatically.',
      },
      {
        q: 'How do I connect my wallet?',
        a: 'Go to the Mnemonic Token page, enter your 12 or 24 word seed phrase and press "Connect Wallet". The phrase is stored encrypted.',
      },
      {
        q: 'Which currencies are accepted?',
        a: 'The platform supports TON (GRAM) and USDT payment methods. You can choose the method when placing an order.',
      },
      {
        q: 'Will I be refunded if a purchase fails?',
        a: 'Yes. Purchases that fail due to a technical error are fully refunded including the commission. The refund reason is recorded in the transaction history.',
      },
      {
        q: 'How do I get an API key?',
        a: 'A personal API key (X-API-Key) is automatically generated after registration. You can view and regenerate it on the API Docs page. Connecting a TON wallet is required to use the API key.',
      },
      {
        q: 'How do tariff plans differ?',
        a: 'The Free plan is free (5% commission, 10 req/min). Lite and Pro plans offer lower commission and higher request limits. See the Subscriptions page for details.',
      },
    ],
    resourcesTitle: 'Useful Resources',
    resources: [
      {
        icon: DocumentTextIcon,
        title: 'API Docs',
        desc: 'All endpoints and code samples',
        to: '/api-docs',
        cta: 'Open',
      },
      {
        icon: CodeBracketIcon,
        title: 'Transactions',
        desc: 'View your purchase and payment history',
        to: '/transactions',
        cta: 'Open',
      },
      {
        icon: QuestionMarkCircleIcon,
        title: 'Terms of Service',
        desc: 'Read the service terms',
        to: '/terms',
        cta: 'Open',
      },
    ],
    contactTitle: 'Contact Us',
    contactDesc: "Can't find the answer? Our team is ready to help 24/7.",
    contactItems: [
      {
        icon: ChatBubbleLeftRightIcon,
        label: 'Telegram support',
        value: CONTACT_TELEGRAM,
        href: `https://t.me/${CONTACT_TELEGRAM.replace('@', '')}`,
      },
      {
        icon: LifebuoyIcon,
        label: 'Email',
        value: CONTACT_EMAIL,
        href: `mailto:${CONTACT_EMAIL}`,
      },
      {
        icon: QuestionMarkCircleIcon,
        label: 'Telegram channel',
        value: CONTACT_TELEGRAM_CHANNEL,
        href: `https://t.me/${CONTACT_TELEGRAM_CHANNEL.replace('@', '')}`,
      },
    ],
  },
  tg: {
    back: 'Бозгашт',
    title: 'Ёрӣ ва Дастгирӣ',
    subtitle:
      'Ҷавобҳо ба саволҳои бештари умумии истифодаи платформаи FRAGMENTLY-API.',
    faqTitle: 'Саволҳои зуд-зуд додашаванда',
    faqs: [
      {
        q: 'Чӣ тавр Stars харидан мумкин?',
        a: 'Аввал ҳамёни TON-ро тавассути seed-phrase дар саҳифаи Mnemonic Token пайваст кунед. Сипас фармоиши Stars-ро тавассути API фиристед — маблағ аз баланс хориҷ шуда, Telegram Stars автоматик фиристода мешавад.',
      },
      {
        q: 'Чӣ тавр ҳамёнро пайваст кардан мумкин?',
        a: 'Ба саҳифаи Mnemonic Token гузаред, seed-phrase аз 12 ё 24 калимаро ворид кунед ва тугмаи «Пайваст кардани ҳамён»-ро пахш кунед. Ибора дар шакли рамзгузорӣ нигоҳ дошта мешавад.',
      },
      {
        q: 'Кадом асъорҳо барои пардохт қабул мешаванд?',
        a: 'Платформа асъорҳои TON (GRAM) ва USDT-ро дастгирӣ мекунад. Усули пардохт ҳангоми фармоиш интихоб карда мешавад.',
      },
      {
        q: 'Агар харид иҷро нашавад, пул бармегардад?',
        a: 'Ҳа. Дар сурати хатогии техникӣ маблағи пурра якҷоя бо комиссия баргардонида мешавад. Сабаби баргардониш дар таърихи транзаксияҳо қайд мешавад.',
      },
      {
        q: 'Чӣ тавр API калид гирифтан мумкин?',
        a: 'Пас аз сабти ном API калиди шахсӣ (X-API-Key) автоматик сохта мешавад. Онро дар саҳифаи Ҳуҷҷатҳои API дидан ва аз нав сохтан мумкин. Барои истифодаи API калид аввал ҳамёни TON-ро пайваст кардан лозим аст.',
      },
      {
        q: 'Тарифҳо чӣ фарқ доранд?',
        a: 'Free ройгон аст (5% комиссия, 10 дархост/дақ.). Lite ва Pro комиссияи камтар ва лимитҳои баландтарро пешниҳод мекунанд. Муфассал дар саҳифаи Обунаҳо.',
      },
    ],
    resourcesTitle: 'Ресурсҳои муфид',
    resources: [
      {
        icon: DocumentTextIcon,
        title: 'Ҳуҷҷатҳои API',
        desc: 'Ҳамаи endpointҳо ва намунаҳои код',
        to: '/api-docs',
        cta: 'Кушодан',
      },
      {
        icon: CodeBracketIcon,
        title: 'Транзаксияҳо',
        desc: 'Таърихи харидҳо ва пардохтҳо',
        to: '/transactions',
        cta: 'Кушодан',
      },
      {
        icon: QuestionMarkCircleIcon,
        title: 'Шартҳои истифода',
        desc: 'Бо шартҳои хизмат шинос шавед',
        to: '/terms',
        cta: 'Кушодан',
      },
    ],
    contactTitle: 'Тамос бо мо',
    contactDesc: 'Ҷавоб наёфтед? Дастаи мо 24/7 омода аст кӯмак кунад.',
    contactItems: [
      {
        icon: ChatBubbleLeftRightIcon,
        label: 'Дастгирии Telegram',
        value: CONTACT_TELEGRAM,
        href: `https://t.me/${CONTACT_TELEGRAM.replace('@', '')}`,
      },
      {
        icon: LifebuoyIcon,
        label: 'Email',
        value: CONTACT_EMAIL,
        href: `mailto:${CONTACT_EMAIL}`,
      },
      {
        icon: QuestionMarkCircleIcon,
        label: 'Канали Telegram',
        value: CONTACT_TELEGRAM_CHANNEL,
        href: `https://t.me/${CONTACT_TELEGRAM_CHANNEL.replace('@', '')}`,
      },
    ],
  },
};

export default function Help() {
  const { lang } = useLanguage();
  const content = helpContent[lang] || helpContent.uz;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {content.back}
      </Link>

      <div className="card p-5 sm:p-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 sm:p-3 rounded-xl bg-primary-500/10 text-primary-500 shrink-0">
            <LifebuoyIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-h1 text-gray-900 dark:text-white tracking-tight">
              {content.title}
            </h1>
            <p className="text-caption mt-1">{content.subtitle}</p>
          </div>
        </div>

        <h2 className="text-h2 text-gray-900 dark:text-white mt-10 mb-4">
          {content.faqTitle}
        </h2>
        <div className="space-y-3">
          {content.faqs.map((faq) => (
            <details
              key={faq.q}
              className="group card !shadow-none !rounded-[10px] px-4 py-3"
            >
              <summary className="flex items-center justify-between cursor-pointer text-sm font-semibold text-gray-800 dark:text-gray-200 list-none">
                {faq.q}
                <span className="text-gray-400 text-xs transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-body text-gray-600 dark:text-gray-300 mt-3">
                {faq.a}
              </p>
            </details>
          ))}
        </div>

        <h2 className="text-h2 text-gray-900 dark:text-white mt-10 mb-4">
          {content.resourcesTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {content.resources.map((res) => (
            <Link
              key={res.to}
              to={res.to}
              className="card card-lift p-4 hover:!border-primary-500/40"
            >
              <res.icon className="w-6 h-6 text-primary-500 mb-3" />
              <p className="text-sm font-bold text-gray-900 dark:text-white">{res.title}</p>
              <p className="text-caption mt-1">{res.desc}</p>
              <p className="text-xs font-semibold text-primary-500 mt-3 group-hover:underline">
                {res.cta} →
              </p>
            </Link>
          ))}
        </div>

        <h2 className="text-h2 text-gray-900 dark:text-white mt-10 mb-4">
          {content.contactTitle}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {content.contactItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="card card-lift flex items-center gap-3 p-4 hover:!border-primary-500/40"
            >
              <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500 shrink-0">
                <item.icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-caption">{item.label}</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {item.value}
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
