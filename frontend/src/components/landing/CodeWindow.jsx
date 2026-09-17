import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  CheckCircleIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

/*
  Interaktiv "LIVE" API terminal oynasi.
  Hero'da va "Ishga tushirish" bo'limida ishlatiladi.
*/

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.fragmently.uz') + '/api/v1/stars/buy/';

const CODE_SNIPPETS = {
  curl: `curl -X POST "${API_BASE_URL}" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"username":"@durov","quantity":100,"payment_method":"TON"}'`,
  python: `import requests

resp = requests.post(
    "${API_BASE_URL}",
    headers={
        "X-API-Key": "YOUR_API_KEY",
        "Content-Type": "application/json",
    },
    json={
        "username": "@durov",
        "quantity": 100,
        "payment_method": "TON",
    },
)
print(resp.json())`,
  node: `const res = await fetch("${API_BASE_URL}", {
  method: "POST",
  headers: {
    "X-API-Key": "YOUR_API_KEY",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    username: "@durov",
    quantity: 100,
    payment_method: "TON",
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

export default function CodeWindow({ withResponse = true }) {
  const { t } = useLanguage();
  const [lang, setLang] = useState('curl');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CODE_SNIPPETS[lang]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="code-window rounded-2xl overflow-hidden bg-[#0b0e14] border border-white/10">
      {/* Terminal title bar */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/5 border-b border-white/10">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex-1 text-center min-w-0">
          <span className="text-[10px] sm:text-[11px] font-mono text-gray-400 truncate block px-2">
            POST {API_BASE_URL}
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/30 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 dot-pulse" />
          LIVE
        </span>
      </div>

      {/* Language tabs + copy */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
          {CODE_LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wide transition min-h-[30px] ${
                lang === l ? 'bg-[#7c6cf6] text-white shadow' : 'text-gray-400 hover:text-white'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/10 transition min-h-[32px]"
          title={t('lnCopy')}
        >
          {copied ? (
            <>
              <ClipboardDocumentCheckIcon className="w-3.5 h-3.5 text-emerald-400" />
              {t('lnCopied')}
            </>
          ) : (
            <>
              <ClipboardDocumentIcon className="w-3.5 h-3.5" />
              {t('lnCopy')}
            </>
          )}
        </button>
      </div>

      {/* Code body */}
      <div className="px-4 pb-4">
        <pre className="text-[11px] sm:text-xs font-mono text-emerald-300 leading-relaxed overflow-x-auto whitespace-pre min-h-[150px]">
          {CODE_SNIPPETS[lang]}
        </pre>
      </div>

      {withResponse && (
        <div className="border-t border-white/10">
          <div className="px-4 py-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[9px] font-bold border border-emerald-500/30">
              <CheckCircleIcon className="w-3 h-3" />
              200 OK
            </span>
            <span className="text-[10px] text-gray-500 font-mono">128 ms</span>
            <span className="ml-auto text-[10px] font-bold text-gray-500 uppercase tracking-wide">
              {t('lnResponse')}
            </span>
          </div>
          <pre className="px-4 pb-4 text-[11px] sm:text-xs font-mono text-teal-300 leading-relaxed overflow-x-auto whitespace-pre">
            {CODE_RESPONSE}
          </pre>
        </div>
      )}
    </div>
  );
}