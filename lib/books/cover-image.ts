export function coverImageUrl(value: string, thumbnail: boolean, attempt = 0): string {
  try {
    const url = new URL(value)
    if (url.hostname === 'covers.openlibrary.org') {
      if (thumbnail) url.pathname = url.pathname.replace(/-[SML]\.jpg$/, '-M.jpg')
      url.searchParams.set('default', 'false')
    }
    if (attempt) url.searchParams.set('tome_retry', String(attempt))
    return url.toString()
  } catch { return value }
}

export const isBlankCover = (width: number, height: number) => width <= 2 || height <= 2
