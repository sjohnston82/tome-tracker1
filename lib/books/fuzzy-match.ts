export interface FuzzyMatchOptions {
  threshold?: number;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function bigrams(value: string) {
  const normalized = normalizeText(value);
  const grams: string[] = [];
  for (let i = 0; i < normalized.length - 1; i += 1) {
    grams.push(normalized.slice(i, i + 2));
  }
  return grams;
}

export function similarity(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aBigrams = bigrams(a);
  const bBigrams = bigrams(b);
  if (aBigrams.length === 0 || bBigrams.length === 0) return 0;

  const bCounts = new Map<string, number>();
  for (const gram of bBigrams) {
    bCounts.set(gram, (bCounts.get(gram) || 0) + 1);
  }

  let matches = 0;
  for (const gram of aBigrams) {
    const count = bCounts.get(gram) || 0;
    if (count > 0) {
      bCounts.set(gram, count - 1);
      matches += 1;
    }
  }

  return (2 * matches) / (aBigrams.length + bBigrams.length);
}

export function isPossibleDuplicate(
  titleA: string,
  authorA: string,
  titleB: string,
  authorB: string,
  options: FuzzyMatchOptions = {}
) {
  const threshold = options.threshold ?? 0.82;
  const titleScore = similarity(titleA, titleB);
  const authorScore = similarity(authorA, authorB);
  return (titleScore + authorScore) / 2 >= threshold;
}
