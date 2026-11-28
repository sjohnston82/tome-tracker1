// PostgreSQL may abort a serializable transaction even when callers use different
// accounts (predicate locks can cover an index page or an initially empty table).
// Retry the entire transaction so every decision is made from a fresh snapshot.
export async function retryTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      if (attempt >= 3 || !error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2034') throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt + Math.random() * 25));
    }
  }
}
