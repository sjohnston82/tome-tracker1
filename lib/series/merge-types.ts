export type MergeChoice = { entryId: string; workId: string; seriesId: string; seriesName: string; title: string; author: string; year: number | null; position: string | null; entryType: string; confirmed: boolean; owned: number }
export type MergeGroup = { id: string; needsResolution: boolean; canSeparate: boolean; choices: MergeChoice[] }
export type MergePreview = { version: string; targetId: string; sourceId: string; name: string; targetName: string; sourceName: string; targetDescription: string | null; sourceDescription: string | null; groups: MergeGroup[] }
export type MergeResolution = { groupId: string; mode: 'combined' | 'separate'; entryId: string; workId: string }
