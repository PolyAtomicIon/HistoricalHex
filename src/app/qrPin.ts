// Разбор QR-кода приглашения в игру.

/** PIN из ссылки приглашения (…?pin=123456) или из самого текста (6 цифр). */
export function pinFromQr(text: string): string | null {
  try {
    const u = new URL(text);
    const p = u.searchParams.get('pin')?.replace(/\D/g, '');
    if (p && p.length === 6) return p;
  } catch {
    /* не ссылка */
  }
  const m = text.match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

