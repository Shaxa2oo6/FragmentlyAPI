# DEPLOYMENT — Google OAuth 2.0 sozlamalari (origin_mismatch xatosi bo'yicha qo'llanma)

> Maqsad: `Error 400: origin_mismatch` xatosini butunlay bartaraf etish va Google OAuth
> sozlamalarini barcha muhitlar (development, staging, production) uchun to'g'ri boshqarish.

## 1. Xatoning sababi

`origin_mismatch` xatosi **Google Cloud Console** tomonidagi konfiguratsiya masalasidir —
ilova ishlab turgan domen/port OAuth 2.0 Client ID ning **"Authorized JavaScript origins"**
ro'yxatiga qo'shilmagan. Bu **kod xatosi emas**.

## 2. Google Cloud Console — qo'lda bajariladigan qadamlar

1. https://console.cloud.google.com/apis/credentials saytiga kiring.
2. Loyihaga tegishli OAuth 2.0 Client ID ni toping
   (`<VITE_GOOGLE_CLIENT_ID>` — `.env` faylida ko'rsatilgan qiymat).
3. **"Authorized JavaScript origins"** bo'limiga quyidagi manzillarni alohida-alohida qo'shing:
   - `http://localhost:5173` — asosiy ilova (dev)
   - `http://localhost:5174` — admin panel (dev)
   - Production domenlar (masalan `https://fragmently.uz`, `https://admin.fragmently.uz`)
   - Staging/test muhiti bo'lsa, uni ham qo'shing (masalan `https://staging.fragmently.uz`)
4. Agar **redirect-based** oqim ishlatilsa, xuddi shu manzillarni tegishli yo'llar bilan
   **"Authorized redirect URIs"** ga ham qo'shing (masalan `https://fragmently.uz/auth/callback`).
   > Joriy kodda GSI (Google Identity Services) **pop-up** oqimi ishlatilgan — bu holatda
   > faqat "Authorized JavaScript origins" yetarli bo'ladi.
5. **SAVE** tugmasini bosing.
6. OAuth consent screen **"Testing"** rejimida bo'lsa, faqat "Test users" ro'yxatidagi
   emaillar kira oladi. Production'ga chiqishdan oldin ilovani **"In production"** holatiga
   o'tkazing yoki kerakli test foydalanuvchilarni qo'shing.

## 3. Kod tomonda muhitga qarab sozlash

Origin/redirect manzillari kodda **hardcode qilinmaydi** — `.env` fayllari orqali boshqariladi.

### 3.1. Muhit fayllari (asosiy ilova — `frontend/`)

- `frontend/.env` — umumiy sozlamalar (`VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, kontaktlar)
- `frontend/.env.development` — `npm run dev` (mode=development)
- `frontend/.env.production` — `npm run build` (mode=production)

| O'zgaruvchi | Tavsif |
|-------------|--------|
| `VITE_GOOGLE_CLIENT_ID` | Google Cloud Console'dagi OAuth Client ID |
| `VITE_APP_URL` | Asosiy ilova manzili |
| `VITE_ADMIN_URL` | Admin panel manzili |

### 3.2. Muhit fayllari (admin panel — `admin/`)

- `admin/.env.development` — `npm run dev` (dev server porti: **5174**)
- `admin/.env.production` — `npm run build`

### 3.3. Dev-time origin tekshiruvi

`src/lib/googleAuthCheck.js` (har ikkala ilovada) development rejimida joriy origin'ni
konsolga chiqaradi va uni kutilayotgan originlar bilan solishtiradi. Joriy origin Google
Cloud Console ro'yxatida yo'q bo'lsa, developer buni log'da darhol ko'radi.

### 3.4. Xato xabarlari

Google OAuth komponentlari (`Login.jsx`, `AdminLogin.jsx`) `error_callback` orqali
xatolarni ushlaydi:
- **Foydalanuvchiga** tushunarli xabar ko'rsatiladi (toast).
- **Developer konsoliga** aniq texnik sabab va Google Cloud Console havolasi yoziladi.

## 4. Yangi muhit qo'shilganda tekshiruv ro'yxati (checklist)

Yangi domen yoki port ustida ilova ishga tushirilganda quyidagilarni bajarish shart:

- [ ] Yangi manzil Google Cloud Console → **"Authorized JavaScript origins"** ga qo'shilgan
- [ ] Redirect oqimi ishlatilsa — **"Authorized redirect URIs"** ga ham qo'shilgan
- [ ] Tegishli `.env.development` / `.env.production` faylida `VITE_APP_URL` / `VITE_ADMIN_URL`
      to'g'ri yangilangan
- [ ] OAuth consent screen "Testing" rejimida bo'lsa, yangi test foydalanuvchi email qo'shilgan
- [ ] Google Sign-In tugmasi shu yangi manzilda qo'lda sinab ko'rilgan (xato chiqmasligi tasdiqlangan)

## 5. Qabul qilish mezonlari (Acceptance criteria)

- [ ] `http://localhost:5173`, `http://localhost:5174` va production domenlar Google Cloud
      Console'da ro'yxatga olingan
- [ ] Google Sign-In tugmasi barcha muhitlarda (dev, production) xatosiz ishlaydi
- [ ] Origin/URL manzillari kodda hardcode qilinmagan, `.env` orqali boshqariladi
- [ ] OAuth xatosi yuz berganda foydalanuvchiga tushunarli xabar, developer konsoliga aniq
      texnik sabab chiqadi
- [ ] Yangi muhit qo'shish uchun checklist shu hujjatda hujjatlashtirilgan
