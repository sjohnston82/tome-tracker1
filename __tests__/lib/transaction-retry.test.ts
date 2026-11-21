// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { retryTransaction } from '@/lib/transaction-retry';
describe('serializable transaction retry', () => {
  it('retries the entire operation after an aborted serialization conflict', async () => {
    const operation = vi.fn().mockRejectedValueOnce({ code: 'P2034' }).mockResolvedValueOnce('committed');
    expect(await retryTransaction(operation)).toBe('committed'); expect(operation).toHaveBeenCalledTimes(2);
  });
  it('does not retry validation or unique constraint errors', async () => {
    const error = { code: 'P2002' }, operation = vi.fn().mockRejectedValue(error);
    await expect(retryTransaction(operation)).rejects.toBe(error); expect(operation).toHaveBeenCalledOnce();
  });
  it('stops after three retries and surfaces persistent conflicts', async () => {
    const error = { code: 'P2034' }, operation = vi.fn().mockRejectedValue(error);
    await expect(retryTransaction(operation)).rejects.toBe(error); expect(operation).toHaveBeenCalledTimes(4);
  });
});
