export async function logError(message: string, metadata?: Record<string, any>) {
  try {
    console.error(`[ERROR] ${message}`, metadata);
  } catch {
    // Ignore logging errors
  }
}

export async function getRecentLogs(limit = 50) {
  void limit;
  return [];
}
