// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { send, constructor } = vi.hoisted(() => ({ send: vi.fn(), constructor: vi.fn() }));
vi.mock('resend', () => ({ Resend: class { constructor(key: string) { constructor(key); } emails = { send }; } }));
import { getPasswordResetEmailConfig } from '@/lib/email/config';
import { sendPasswordResetEmail } from '@/lib/email/resend';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RESEND_API_KEY', 'test-key');
  vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@books.example');
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://books.example/');
  vi.stubEnv('NODE_ENV', 'production');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('password reset email configuration and delivery', () => {
  it('requires a key, a real sender, and a safe public URL', () => {
    expect(getPasswordResetEmailConfig()?.appUrl).toBe('https://books.example');
    for (const from of ['', 'not-an-email', 'noreply@yourdomain.com']) {
      vi.stubEnv('RESEND_FROM_EMAIL', from);
      expect(getPasswordResetEmailConfig()).toBeNull();
    }
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@books.example');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(getPasswordResetEmailConfig()).toBeNull();
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    for (const url of ['http://books.example', 'https://user:pass@books.example', 'https://books.example?x=1', 'https://books.example/path', 'http://localhost:3000']) {
      vi.stubEnv('NEXT_PUBLIC_APP_URL', url);
      expect(getPasswordResetEmailConfig()).toBeNull();
    }
    vi.stubEnv('NODE_ENV', 'test');
    expect(getPasswordResetEmailConfig()?.appUrl).toBe('http://localhost:3000');
  });
  it('sends HTML and plain text using the configured sender', async () => {
    send.mockResolvedValue({ data: { id: 'message-id' }, error: null });
    expect(await sendPasswordResetEmail('reader@example.test', 'https://books.example/reset-password?token=abc')).toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'Tome Tracker <noreply@books.example>', to: 'reader@example.test', text: expect.stringContaining('token=abc'), html: expect.stringContaining('token=abc') }));
  });
  it.each([{ data: null, error: { message: 'private-token private-key reader@example.test' } }, { data: null, error: null }])('treats provider rejection or missing message ID as failure without logging secrets', async response => {
    send.mockResolvedValue(response);
    expect(await sendPasswordResetEmail('reader@example.test', 'https://books.example/reset-password?token=private-token')).toBe(false);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private-token|private-key|reader@example/);
  });
  it('handles thrown errors without logging provider payloads', async () => {
    send.mockRejectedValue(new Error('private-token private-key'));
    expect(await sendPasswordResetEmail('reader@example.test', 'https://books.example/reset-password?token=private-token')).toBe(false);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/private-token|private-key/);
  });
  it('does not call the provider when configuration is absent', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    expect(await sendPasswordResetEmail('reader@example.test', 'https://books.example/reset-password?token=abc')).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
