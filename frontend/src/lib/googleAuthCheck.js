// Google OAuth origin tekshiruvi (dev-time safeguard)
//
// "Error 400: origin_mismatch" xatosi Google Cloud Console tomonidagi konfiguratsiya
// masalasidir: ilova ishlab turgan origin (domen/port) OAuth 2.0 Client ID ning
// "Authorized JavaScript origins" ro'yxatiga qo'shilmagan. Bu modul developer'ga
// joriy origin to'g'ri sozlanganligini eslatib turadi va xato yuz berganda aniq
// texnik sababni konsolga chiqaradi.

const GOOGLE_CONSOLE_URL = 'https://console.cloud.google.com/apis/credentials';

const EXPECTED_ORIGINS = [
  import.meta.env.VITE_APP_URL,
  import.meta.env.VITE_ADMIN_URL,
].filter(Boolean);

export function checkGoogleOAuthOrigin() {
  if (!import.meta.env.DEV) return;

  const currentOrigin = window.location.origin;
  const expected = EXPECTED_ORIGINS.length
    ? EXPECTED_ORIGINS.join(', ')
    : '(aniqlanmadi — .env faylida VITE_APP_URL / VITE_ADMIN_URL sozlang)';

  console.info(
    `[Google OAuth] Joriy origin: ${currentOrigin}\n` +
      `Kutilayotgan originlar: ${expected}\n` +
      `Bu manzil Google Cloud Console -> Credentials -> "Authorized JavaScript origins" ` +
      `ro'yxatida borligiga ishonch hosil qiling: ${GOOGLE_CONSOLE_URL}\n` +
      `Agar yo'q bo'lsa, "Error 400: origin_mismatch" xatosi chiqadi.`
  );
}

export function logGoogleOAuthError(error) {
  const type = error?.type || error?.error || 'unknown';
  const message = error?.message || error?.details || '';

  console.error(
    `[Google OAuth] Xatolik yuz berdi (type: ${type})${message ? `: ${message}` : ''}\n` +
      `Joriy origin: ${window.location.origin}\n` +
      `Agar xato "origin_mismatch" / "idpiframe_initialization_failed" bo'lsa, ` +
      `Google Cloud Console sozlamalarini tekshiring: ${GOOGLE_CONSOLE_URL}`
  );
}

export function getGoogleOAuthErrorMessage(error) {
  const type = error?.type || error?.error || '';
  const message = error?.message || error?.details || '';

  if (type === 'origin_mismatch' || message.includes('origin') || message.includes('Client ID') || message.includes('allowed')) {
    return `Google OAuth: Joriy origin (${window.location.origin}) Google Cloud Console Authorized JavaScript origins ro'yxatida mavjud emas.`;
  }

  switch (type) {
    case 'popup_closed_by_user':
      return "Google oynasi yopildi. Qayta urinib ko'ring.";
    case 'popup_failed_to_open':
      return "Google oynasi ochilmadi. Brauzeringiz pop-up bloklagan bo'lishi mumkin — ruxsat bering va qayta urinib ko'ring.";
    case 'idpiframe_initialization_failed':
    case 'id_token_request_failed':
    case 'credential_error':
      return "Google orqali kirishda texnik xatolik yuz berdi. Google Cloud Console sozlamalarini va joriy originni tekshiring.";
    default:
      return "Google orqali kirishda texnik xatolik yuz berdi. Keyinroq qayta urinib ko'ring yoki qo'llab-quvvatlash xizmatiga murojaat qiling.";
  }
}
