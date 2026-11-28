export type OwnershipAction = 'link' | 'unlink' | 'reject' | 'allow'
export type OwnershipCopy = {
  id: string; title: string; author: string; isbn13: string | null; readingStatus: string;
  state: 'linked' | 'matched' | 'candidate' | 'excluded'; reason: string;
  links: { workId: string; title: string; source: 'edition' | 'content' }[];
  otherWorks: string[];
}
export type OwnershipReview = { work: { id: string; title: string; author: string }; version: string; copies: OwnershipCopy[] }
