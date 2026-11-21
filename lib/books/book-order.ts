export type BookOrder = 'title' | 'series' | 'year';
export type ShelfBook = { id: string; title: string; coverUrl?: string | null; publicationYear?: number | null; seriesName?: string | null; seriesNumber?: number | null };
export function sortAuthorBooks<T extends ShelfBook>(books: T[], order: BookOrder): T[] {
  return [...books].sort((a, b) => {
    if (order === 'year') return (a.publicationYear ?? Infinity) - (b.publicationYear ?? Infinity) || a.title.localeCompare(b.title);
    if (order === 'series') return (a.seriesName ?? '\uffff').localeCompare(b.seriesName ?? '\uffff') || (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) || a.title.localeCompare(b.title);
    return a.title.localeCompare(b.title);
  });
}
