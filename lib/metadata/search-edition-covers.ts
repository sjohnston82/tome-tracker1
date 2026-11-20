import { z } from 'zod';
import { coverLanguage, coverLanguageRank } from './cover-language';
export const searchEditionSchema = z.object({ title: z.string().optional(), cover_i: z.number().int().positive().optional(), language: z.array(z.string()).optional().default([]), isbn: z.array(z.string()).optional().default([]) });
export const searchEditionsSchema = z.object({ docs: z.array(searchEditionSchema) }).optional();
type SearchCover = { cover_i?: number; editions?: z.infer<typeof searchEditionsSchema> };
export function preferredSearchCover(doc: SearchCover) {
  const editions = doc.editions?.docs ?? [];
  const candidates = editions.filter(edition => edition.cover_i && coverLanguageRank(coverLanguage(edition.language)) < 2).sort((a, b) => coverLanguageRank(coverLanguage(a.language)) - coverLanguageRank(coverLanguage(b.language)));
  if (candidates[0]) return { coverId: candidates[0].cover_i!, language: coverLanguage(candidates[0].language), isbn: candidates[0].isbn, title: candidates[0].title };
  // Work-level language lists describe every translation, not the language of
  // cover_i. Use generic artwork only when edition information is absent.
  return !doc.editions && doc.cover_i && Number.isInteger(doc.cover_i) && doc.cover_i > 0 ? { coverId: doc.cover_i, language: undefined, isbn: [] as string[], title: undefined } : null;
}
export const englishEditionFields = 'editions,editions.title,editions.cover_i,editions.language,editions.isbn';
