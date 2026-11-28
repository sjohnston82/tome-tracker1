import { z } from 'zod';

export function getPasswordResetEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!apiKey || !from || !z.email().safeParse(from).success || /@yourdomain\.com$/i.test(from)) return null;
  try {
    const url = new URL(appUrl ?? '');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
    const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    return { apiKey, from, appUrl: url.origin };
  } catch { return null; }
}
