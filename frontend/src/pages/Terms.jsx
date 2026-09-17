import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { ArrowLeft, ShieldCheck, FileText } from 'lucide-react';

const termsContent = {
  uz: {
    back: 'Orqaga',
    pageTitle: 'FRAGMENTLY-API — Rasmiy Foydalanish Shartlari',
    lastUpdated: 'So\'nggi yangilanish: 2026-yil 1-avgust',
    intro:
      "FRAGMENTLY-API platformasidan (keyingi o'rinlarda \"Xizmat\" yoki \"Platforma\") foydalanishdan oldin ushbu Foydalanish Shartlarini (keyingi o'rinlarda \"Shartnoma\") diqqat bilan o'qib chiqing. Platformada ro'yxatdan o'tish, API kalitlaridan foydalanish yoki to'lovlarni amalga oshirish orqali siz ushbu Shartnomaning barcha bandlariga to'liq va shartlarsiz rozilik bildirasiz.",
    sections: [
      {
        title: '1. Umumiy qoidalar va Muomala huquqi',
        body: `1.1. Ushbu Hujjat FRAGMENTLY-API platformasi tomonidan taqdim etiladigan avtomatlashtirilgan Telegram Stars va Telegram Premium API xizmatlaridan foydalanish tartibini belgilaydi.
1.2. Mustaqillik haqida ogohlantirish: FRAGMENTLY-API mustaqil servis hisoblanadi hamda Telegram FZ-LLC, Fragment.com yoki ularning sho'ba korxonalari bilan bevosita rasmiy sheriklik aloqalariga ega emas. Barcha savdo markalari tegishli egalariga tegishli.
1.3. Xizmatdan foydalanish uchun foydalanuvchi kamida 18 yoshga to'lgan yoki o'z yurisdiksiyasiga muvofiq muomala layoqatiga ega bo'lishi shart.`,
      },
      {
        title: '2. Hisob qaydnomasi va API Kalitlari xavfsizligi',
        body: `2.1. Xizmat funksionalidan foydalanish uchun foydalanuvchi autentifikatsiyadan o'tishi va shaxsiy hisob qaydnomasiga ega bo'lishi kerak.
2.2. API Kalitlari (X-API-Key): Foydalanuvchiga taqdim etilgan shaxsiy API kalitlari uning raqamli imzosi hisoblanadi. API kalitini ochiq kod manbalarida (GitHub va boshqalar) e'lon qilish, uchinchi shaxslarga berish qat'iyan taqiqlanadi.
2.3. API kaliti uchinchi shaxslar qo'liga tushishi natijasida yuzaga kelgan barcha moliyaviy yo'qotishlar va so'rovlar uchun to'liq javobgarlik foydalanuvchining o'ziga yuklatiladi.`,
      },
      {
        title: '3. Xizmatlardan foydalanish va Cheklovlar (Acceptable Use Policy)',
        body: `3.1. Xizmatdan faqat qonuniy va xalqaro huquq normativlariga mos keladigan maqsadlarda foydalanishga ruxsat beriladi.
3.2. Qat'iyan taqiqlanadi:
- Platformaga DDoS hujumlar uyushtirish, API so'rovlar limitini (Rate limit) sun'iy ravishda chetlab o'tishga urinish;
- Phishing, spam yuborish, firibgarlik yoki Telegram jamiyati qoidalariga zid bo'lgan kanallar/botlar uchun Stars/Premium xarid qilish;
- Noqonuniy daromadlarni legallashtirish (AML) yoki sanksiya ostidagi manzillar bilan operatsiyalarni bajarish.
3.3. Qoidalarga rioya etilmagan taqdirda, Platforma ma'muriyati hisobni ogohlantirishsiz va balansni qaytarishsiz bloklash huquqiga ega.`,
      },
      {
        title: '4. To\'lovlar, Tariflar va Blokcheyn Tranzaksiyalari',
        body: `4.1. Hisob-kitoblar TON (GRAM) hamda USDT (TRC-20/TON) raqamli aktivlari orqali amalga oshiriladi.
4.2. Xizmat ko'rsatish uchun komissiya miqdori va daqiqalik so'rovlar limiti foydalanuvchi tanlagan tarif rejasiga (Free, Lite, Pro) muvofiq avtomatik ravishda yechib olinadi.
4.3. Tarmoq komissiyalari: Kriptovalyuta tarmog'idagi tranzaksiya komissiyalari (Gas Fee) va tarmoq yuklamasi sababli yuzaga keladigan kechikishlar uchun Platforma mas'uliyat olmaydi.`,
      },
      {
        title: '5. Bekor qilish va Pulni qaytarish siyosati (Refund Policy)',
        body: `5.1. Blokcheyn tranzaksiyalarining qaytarilmaslik (irreversible) xususiyatidan kelib chiqib, bajarilgan va tasdiqlangan tranzaksiyalar bekor qilinmaydi va qaytarilmaydi.
5.2. Foydalanuvchi tomonidan API so'rovida noto'g'ri Telegram username yoki xato ID kiritilishi natijasida noto'g'ri manzilga yuborilgan Stars va Premium obunalari QAYTARILMAYDI.
5.3. Platformaning ichki texnik xatoligi yoki tizim uzilishi sababli amalga oshmay qolgan so'rovlar bo'yicha yechilgan mablag' va komissiya foydalanuvchining balansiga avtomatik ravishda to'liq to'ldirib beriladi.`,
      },
      {
        title: '6. Xavfsizlik va Mnemonic Iboralar shifrlanishi',
        body: `6.1. Platforma foydalanuvchilarining maxfiyligini ta'minlash uchun hamyon Mnemonic iboralarini Fernet AES-256 standarti bo'yicha shifrlangan (encrypted) holda saqlaydi.
6.2. Platforma ma'muriyati yoki uchinchi shaxslar shifrlangan iboralarni ochoq ko'rinishda ko'ra olmaydi va ulardan foydalana olmaydi.
6.3. Foydalanuvchi o'zining shaxsiy maxfiy kalitlari va parollarini saqlashga mas'uldir.`,
      },
      {
        title: '7. Texnik Xizmat Ko\'rsatish va Kafolatlarning Cheklanishi (Disclaimer)',
        body: `7.1. Xizmat "qanday bo'lsa, shunday" (As Is) va "mavjud bo'lishiga qarab" (As Available) tamoyillari asosida taqdim etiladi.
7.2. Platforma Telegram, TON Network yoki provayderlar tarafida yuzaga kelgan uzilishlar, profilaktika ishlari va API o'zgarishlari tufayli xizmat ko'rsatishdagi vaqtinchalik to'xtalishlar uchun kafolat bermaydi va javobgarlikni o'ziga olmaydi.`,
      },
      {
        title: '8. Javobgarlikni Cheklash',
        body: `8.1. Platforma xizmatdan foydalanish yoki foydalana olmaslik natijasida yuzaga kelgan bilvosita, tasodifiy, maxsus yoki oqibatli zararlar (jumladan, boy berilgan foyda, ma'lumotlar yo'qolishi) uchun javobgar hisoblanmaydi.`,
      },
      {
        title: '9. Shartnomaga o\'zgartirishlar kiritish',
        body: `9.1. Platforma ma'muriyati ushbu Shartnomaga bir tomonlama tartibda o'zgartirish va qo'shimchalar kiritish huquqiga ega.
9.2. Yangilangan Shartnoma ushbu sahifada e'lon qilingan vaqtdan e'tiboran kuchga kiradi. Xizmatdan foydalanishni davom ettirish orqali foydalanuvchi yangi shartlarga rozilik bildirgan hisoblanadi.`,
      },
    ],
  },
  en: {
    back: 'Back',
    pageTitle: 'FRAGMENTLY-API — Official Terms of Service',
    lastUpdated: 'Last updated: August 1, 2026',
    intro:
      'Please read these Terms of Service carefully before using the FRAGMENTLY-API platform ("Service" or "Platform"). By registering, utilizing API keys, or processing payments, you unequivocally agree to all provisions of this Agreement.',
    sections: [
      {
        title: '1. General Provisions & Legal Capacity',
        body: `1.1. This Document defines the operational procedures for automated Telegram Stars and Telegram Premium API services rendered by FRAGMENTLY-API.
1.2. Disclaimer of Independence: FRAGMENTLY-API operates as an independent service and maintains no direct partnership or affiliation with Telegram FZ-LLC, Fragment.com, or their subsidiaries. All trademarks belong to their respective owners.
1.3. Users must be at least 18 years of age or possess legal capacity under the jurisdiction of their residence.`,
      },
      {
        title: '2. Account Credentials & API Key Security',
        body: `2.1. Registration and user authentication are mandatory to access Platform functionalities.
2.2. API Keys (X-API-Key): Personal API keys act as your binding digital signature. Publishing API keys in open repositories (e.g., GitHub) or disclosing them to third parties is strictly prohibited.
2.3. Full liability for any financial losses or unauthorized requests arising from compromised API keys rests solely with the user.`,
      },
      {
        title: '3. Acceptable Use Policy (AUP) & System Restrictions',
        body: `3.1. Services may only be utilized for lawful purposes in compliance with international legal frameworks.
3.2. Strictly Prohibited Activities:
- Conducting DDoS attacks, exploiting infrastructure, or artificially bypassing API rate limits;
- Phishing, spamming, fraudulent operations, or purchasing Stars/Premium for bots/channels violating Telegram Community Guidelines;
- Anti-Money Laundering (AML) violations or initiating transactions with sanctioned blockchain addresses.
3.3. In the event of non-compliance, Platform Administration reserves the right to terminate accounts immediately without prior notice or balance reimbursement.`,
      },
      {
        title: '4. Fees, Tariffs & Blockchain Transactions',
        body: `4.1. Financial settlements are processed in TON (GRAM) and USDT (TRC-20/TON) digital assets.
4.2. Service commissions and per-minute request limits are automatically debited according to the user's selected plan (Free, Lite, Pro).
4.3. Network Fees: The Platform bears no responsibility for cryptocurrency network gas fees or transaction delays resulting from blockchain congestion.`,
      },
      {
        title: '5. Cancellation & Refund Policy',
        body: `5.1. Due to the irreversible nature of blockchain transactions, successfully executed and confirmed purchases cannot be reversed or refunded.
5.2. Purchases sent to erroneous Telegram usernames or invalid recipient IDs due to user input error are STRICTLY NON-REFUNDABLE.
5.3. In cases of unfulfilled requests caused by internal Platform technical errors or system outages, debited funds and fees will be automatically refunded to the user balance in full.`,
      },
      {
        title: '6. Security & Mnemonic Phrase Encryption',
        body: `6.1. To ensure user privacy, wallet Mnemonic phrases are stored in encrypted format utilizing Fernet AES-256 encryption standards.
6.2. Platform Administration and third parties cannot access or view plain-text mnemonic phrases.
6.3. Users retain full responsibility for safeguarding their personal credentials and private keys.`,
      },
      {
        title: '7. Service Maintenance & Disclaimer of Warranties',
        body: `7.1. Services are provided on an "As Is" and "As Available" basis.
7.2. The Platform guarantees no uninterrupted service and disclaims liability for temporary disruptions caused by third-party outages, maintenance, or API changes implemented by Telegram or the TON Network.`,
      },
      {
        title: '8. Limitation of Liability',
        body: `8.1. The Platform shall not be held liable for any indirect, incidental, special, or consequential damages (including lost profits or data loss) arising from the use or inability to use the Service.`,
      },
      {
        title: '9. Amendments to Terms',
        body: `9.1. Platform Administration reserves the right to modify or supplement these Terms unilaterally at any time.
9.2. Updated Terms take effect immediately upon publication on this page. Continued usage of the Platform constitutes full acceptance of updated Terms.`,
      },
    ],
  },
  ru: {
    back: 'Назад',
    pageTitle: 'FRAGMENTLY-API — Официальные Условия Использования',
    lastUpdated: 'Последнее обновление: 1 августа 2026 г.',
    intro:
      'Внимательно ознакомьтесь с настоящими Условиями использования перед началом работы с платформой FRAGMENTLY-API («Сервис» или «Платформа»). Регистрируясь, используя API-ключи или совершая платежи, вы выражаете полное и безоговорочное согласие со всеми пунктами данного Соглашения.',
    sections: [
      {
        title: '1. Общие положения и Дееспособность',
        body: `1.1. Настоящий документ определяет порядок предоставления автоматизированных услуг API Telegram Stars и Telegram Premium платформой FRAGMENTLY-API.
1.2. Предупреждение о независимости: FRAGMENTLY-API является независимым сервисом и не имеет прямого партнерского соглашения с Telegram FZ-LLC, Fragment.com или их аффилированными структурами. Все товарные знаки принадлежат их правообладателям.
1.3. Для использования Сервиса пользователь должен достигнуть возраста 18 лет или обладать полной гражданской дееспособностью.`,
      },
      {
        title: '2. Учётная запись и Безопасность API-Ключей',
        body: `2.1. Для доступа к функционалу Сервиса необходима аутентификация и создание личного аккаунта.
2.2. API-Ключи (X-API-Key): Персональные ключи API выполняют функцию вашей цифровой подписи. Категорически запрещается публиковать ключи в открытом доступе (например, на GitHub) или передавать их третьим лицам.
2.3. Вся ответственность за финансовые потери или несанкционированные запросы, вызванные компрометацией API-ключа, полностью возлагается на пользователя.`,
      },
      {
        title: '3. Правила Допустимого Использования (AUP) и Ограничения',
        body: `3.1. Использование Сервиса разрешено исключительно в законных целях, соответствующих международным правовым нормам.
3.2. Категорически запрещено:
- Совершать DDoS-атаки на платформу или обходить ограничения частоты запросов (Rate Limit);
- Фишинг, спам-рассылки, мошенничество или покупка Stars/Premium для каналов/ботов, нарушающих Правила Telegram;
- Легализация доходов, полученных преступным путем (AML), и операции с санкционированными адресами.
3.3. При нарушении правил Администрация оставляет за собой право заблокировать аккаунт без предварительного уведомления и без возврата остатка средств.`,
      },
      {
        title: '4. Платежи, Тарифы и Блокчейн-Транзакции',
        body: `4.1. Расчеты производятся в цифровых активах TON (GRAM) и USDT (TRC-20/TON).
4.2. Комиссия за обслуживание и лимит минутного объема запросов списываются автоматически в соответствии с выбранным тарифным планом (Free, Lite, Pro).
4.3. Сетевые комиссии: Платформа не несет ответственности за комиссии сети криптовалют (Gas Fee) и задержки, вызванные перегрузкой блокчейна.`,
      },
      {
        title: '5. Отмена операций и Политика Возврата (Refund Policy)',
        body: `5.1. Ввиду безотзывного (irreversible) характера блокчейн-транзакций, успешно выполненные и подтвержденные операции отмене и возврату не подлежат.
5.2. Звёзды и подписки Premium, отправленные на ошибочный Telegram username или неверный ID по вине пользователя, ВОЗВРАТУ НЕ ПОДЛЕЖАТ.
5.3. В случае сбоев по вине внутренних технических ошибок Платформы, списанные средства и комиссии автоматически возвращаются на баланс пользователя в полном объеме.`,
      },
      {
        title: '6. Безопасность и Шифрование Мнемонических Фраз',
        body: `6.1. Для защиты данных мнемонические фразы кошельков хранятся исключительно в зашифрованном виде по стандарту Fernet AES-256.
6.2. Администрация Платформы и третьи лица не имеют технической возможности просмотреть мнемонические фразы в открытом виде.
6.3. Пользователь несет личную ответственность за сохранность своих паролей и секретных ключей.`,
      },
      {
        title: '7. Техническое Обслуживание и Отказ от Гарантий (Disclaimer)',
        body: `7.1. Услуги предоставляются по принципу «Как есть» (As Is) и «По мере доступности» (As Available).
7.2. Платформа не гарантирует непрерывную работу и не несет ответственности за временные сбои, вызванные техническими работами или изменениями API на стороне Telegram и TON Network.`,
      },
      {
        title: '8. Ограничение Ответственности',
        body: `8.1. Платформа не несет ответственности за косвенный, случайный или упущенный ущерб (включая упущенную выгоду или потерю данных), возникший в результате использования или невозможности использования Сервиса.`,
      },
      {
        title: '9. Внесение Изменений в Соглашение',
        body: `9.1. Администрация оставляет за собой право вносить изменения в одностороннем порядке в любое время.
9.2. Обновленные Условия вступают в силу с момента их публикации на данной странице. Продолжение использования Сервиса означает полное согласие с новыми условиями.`,
      },
    ],
  },
  tg: {
    back: 'Бозгашт',
    pageTitle: 'FRAGMENTLY-API — Шартҳои Расмии Истифодабарӣ',
    lastUpdated: 'Охирин навсозӣ: 1 августи соли 2026',
    intro:
      'Лутфан, пеш аз истифодаи платформаи FRAGMENTLY-API («Хизматрасонӣ» ё «Платформа») ин Шартҳои истифодабариро бодиққат хонед. Бо сабти ном, истифодаи калидҳои API ё пардохтҳо шумо ба ҳамаи бандҳои ин Шартнома розӣ мешавед.',
    sections: [
      {
        title: '1. Муқаррароти умумӣ ва Лаёқати ҳуқуқӣ',
        body: `1.1. Ин Ҳуҷҷат тартиби пешниҳоди хизматрасониҳои автоматии API-и Telegram Stars ва Telegram Premium-ро аз ҷониби FRAGMENTLY-API муайян мекунад.
1.2. Огоҳӣ дар бораи мустақилият: FRAGMENTLY-API сервиси мустақил буда, бо Telegram FZ-LLC ё Fragment.com шарикии мустақим надорад. Ҳамаи тамғаҳои тиҷоратӣ ба соҳибони худ тааллуқ доранд.
1.3. Корбар бояд ба синни 18-солагӣ расида бошад ва лаёқати пурраи ҳуқуқӣ дошта бошад.`,
      },
      {
        title: '2. Ҳисоб ва Бехатарии Калидҳои API',
        body: `2.1. Барои истифодаи функсияҳои Платформа аутентификатсия ва сохтани ҳисоби шахсӣ шарт аст.
2.2. Калидҳои API (X-API-Key): Калидҳои шахсии API имзои рақамии шумо мебошанд. Нашр кардани онҳо дар манбаъҳои кушод (ба монанди GitHub) ё додан ба шахсони сеюм қатъиян манъ аст.
2.3. Масъулияти пурраи зарари молиявӣ дар сурати ошкор шудани калиди API ба дӯши корбар мебошад.`,
      },
      {
        title: '3. Qоидаҳои Истифодабарии Матлуб (AUP) ва Маҳдудиятҳо',
        body: `3.1. Истифодаи Хизматрасонӣ танҳо барои мақсадҳои қонунӣ иҷозат дода мешавад.
3.2. Qатъиян манъ аст:
- Ҳамлаҳои DDoS ба платформа ё давр задани маҳдудиятҳои Rate Limit;
- Фишинг, спам ё хариди Stars/Premium барои каналҳо/ботҳои вайронкунандаи қоидаҳои Telegram;
- Расмиёти шустани пул (AML) ва амалиёт бо суроғаҳои санксияшуда.
3.3. Дар сурати вайрон кардани қоидаҳо, маъмурият ҳуқуқ дорад ҳисобро бе огоҳии пешакӣ ва бе баргардонидани маблағ блок кунад.`,
      },
      {
        title: '4. Пардохтҳо, Тарифҳо ва Транзаксияҳои Блокчейн',
        body: `4.1. Ҳисоб-китобҳо тавассути активҳои рақамии TON (GRAM) ва USDT иҷро мешаванд.
4.2. Комиссия ва маҳдудияти дархостҳо мувофиқи тарифи интихобшуда (Free, Lite, Pro) ба таври худкор тарҳ карда мешаванд.
4.3. Комиссияи шабака: Платформа барои комиссияҳои шабакавии криптоасъор (Gas Fee) ва таъхирҳои блокчейн масъулият надорад.`,
      },
      {
        title: '5. Бекоркунӣ ва Сиёсати Бозгардонидани Маблағ (Refund Policy)',
        body: `5.1. Аз сабаби бекорнашаванда (irreversible) будани транзаксияҳои блокчейн, амалиётҳои иҷрошуда бозгардонида намешаванд.
5.2. Маблағе, ки аз сабаби хатогии корбар ба Telegram username ё ID-и хато фиристода шудааст, БОЗГАРДОНИДА НАМЕШАВАД.
5.3. Дар сурати хатогии техникии дохилии Платформа, маблағи тарҳшуда ба пӯррагӣ ба баланси корбар баргардонида мешавад.`,
      },
      {
        title: '6. Шифргузории Фразаҳои Мнемоникӣ',
        body: `6.1. Фразаҳои мнемоникии ҳамёнҳо мувофиқи стандарти Fernet AES-256 рамзгузорӣ карда нигоҳ дошта мешаванд.
6.2. Маъмурияти Платформа ва шахсони сеюм ба фразаҳои кушод дастрасӣ надоранд.
6.3. Корбар барои нигоҳдории паролҳо ва калидҳои худ масъул аст.`,
      },
      {
        title: '7. Хизматрасонии Техникӣ ва Маҳдудияти Кафолатҳо (Disclaimer)',
        body: `7.1. Хизматрасонӣ дар асоси принсипҳои "As Is" ва "As Available" пешниҳод мегардад.
7.2. Платформа барои таъхирҳои вақтинчагии аз сабаби Telegram ё TON Network баамаломада кафолат ва масъулият намегирад.`,
      },
      {
        title: '8. Маҳдудияти Масъулият',
        body: `8.1. Платформа барои зарарҳои ғайримустақим, тасодуфӣ ё фоидаи бойдодашуда масъул намебошад.`,
      },
      {
        title: '9. Тағйирот ба Шартнома',
        body: `9.1. Маъмурият ҳуқуқ дорад дилхоҳ вақт ба Шартнома тағйирот ворид кунад.
9.2. Шартҳои нав аз лаҳзаи нашр дар ин саҳифа кӯвва пайдо мекунанд. Идомаи истифодаи Платформа маънои розӣ буданро дорад..`,
      },
    ],
  },
};

export default function Terms() {
  const { lang } = useLanguage();
  const content = termsContent[lang] || termsContent.uz;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 animate-fade-in select-none">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{content.back}</span>
      </Link>

      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 sm:p-10 shadow-sm space-y-6">
        <div className="flex items-center gap-3.5 pb-4 border-b border-gray-100 dark:border-slate-800">
          <div className="p-3 rounded-2xl bg-[#0D9488]/10 text-[#0D9488] dark:bg-[#0D9488]/20 shrink-0">
            <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              {content.pageTitle}
            </h1>
            <p className="text-xs text-gray-400 dark:text-slate-400 font-mono mt-0.5">
              {content.lastUpdated}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-gray-100 dark:border-slate-800 text-xs sm:text-sm text-gray-700 dark:text-slate-300 leading-relaxed font-medium">
          {content.intro}
        </div>

        <div className="space-y-6">
          {content.sections.map((section) => (
            <div
              key={section.title}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 shadow-xs space-y-2 hover:border-[#0D9488]/30 transition-colors"
            >
              <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#0D9488] shrink-0" />
                <span>{section.title}</span>
              </h2>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium pl-6">
                {section.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
