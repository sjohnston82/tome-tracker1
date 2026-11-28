export type ReviewAction = 'keep' | 'reopen' | 'source' | 'year' | 'confirm' | 'pin';
export type ReviewItem = {
  id: string; version: string; fingerprint: string; category: 'conflict' | 'edition' | 'series' | 'missing'; code: string;
  title: string; author: string; message: string; current: string; proposed: string | null; source: string | null;
  ownership: string; href: string; linkLabel: string; resolved: boolean; blocking: boolean; actions: ReviewAction[];
  candidates: { id: string; title: string; author: string }[];
};
export type ReviewQueue = { items: ReviewItem[]; summary: { open: number; reviewed: number; categories: Record<ReviewItem['category'], number> }; pendingImport: boolean };
export type ReviewDecision = { fingerprint: string; resolvedAt: string; state: 'reviewed' | 'open' };
export type ReviewDecisions = Record<string, ReviewDecision>;
