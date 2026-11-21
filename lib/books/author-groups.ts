import { authorSortKey, compareAuthors } from './author-sort'

export const AUTHOR_ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

export function authorLetter(name: string): string {
  const initial = authorSortKey(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase()
  return /^[A-Z]$/.test(initial) ? initial : '#'
}

export function groupAuthors<T extends { name: string }>(authors: T[]) {
  const groups = new Map<string, T[]>()
  for (const author of [...authors].sort(compareAuthors)) {
    const letter = authorLetter(author.name)
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter)!.push(author)
  }
  return AUTHOR_ALPHABET.flatMap(letter => groups.has(letter) ? [{ letter, authors: groups.get(letter)! }] : [])
}
