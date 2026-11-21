const separator = /\s+(?:and|&)\s+|\s*;\s*|\s*\/\s*/i

export function authorPeople(name: string): string[] {
  const parts = name.split(separator).map(value => value.trim())
  // Also accept the compact surname-first form this formatter emits.
  if (parts.length > 1 && name.split(',').length === 2) {
    const [surname, names] = name.split(',')
    const given = names.split(separator).map(value => value.trim())
    if (given.length > 1 && given.every(value => /^\S+$/.test(value))) return given.map(value => `${surname.trim()}, ${value}`)
  }
  const last = parts.at(-1) ?? ''
  // "Arkady & Boris Strugatsky" supplies one shared surname at the end.
  if (parts.length > 1 && parts.slice(0, -1).every(value => /^\S+$/.test(value)) && !last.includes(',') && last.split(/\s+/).length > 1) {
    const surname = last.split(/\s+/).at(-1)!
    return parts.map((value, index) => index < parts.length - 1 ? `${value} ${surname}` : value)
  }
  return parts
}

// File a collaboration under the alphabetically earliest surname.
export function authorSortKey(name: string): string {
  return authorPeople(name).map(person => {
    const cleaned = person.trim().replace(/,?\s+(?:jr\.?|sr\.?|ii|iii|iv)$/i, '')
    const surname = cleaned.includes(',') ? cleaned.split(',')[0] : cleaned.split(/\s+/).at(-1) ?? ''
    return surname.toLocaleLowerCase('en')
  }).sort((a, b) => a.localeCompare(b, 'en'))[0] ?? ''
}

export function compareAuthors(a: { name: string }, b: { name: string }) {
  return authorSortKey(a.name).localeCompare(authorSortKey(b.name), 'en') || a.name.localeCompare(b.name, 'en')
}

export function formatAuthorName(name: string): string {
  const formatted = authorPeople(name).map(person => {
    const value = person.trim()
    if (value.includes(',')) return value
    const suffix = value.match(/\s+(?:jr\.?|sr\.?|ii|iii|iv)$/i)?.[0] ?? ''
    const words = value.slice(0, suffix ? -suffix.length : undefined).split(/\s+/)
    if (words.length < 2) return value
    return `${words.pop()}, ${words.join(' ')}${suffix}`
  })
  const surname = formatted[0]?.split(',')[0]
  if (formatted.length > 1 && formatted.every(value => value.includes(',') && value.split(',')[0] === surname)) return `${surname}, ${formatted.map(value => value.slice(value.indexOf(',') + 1).trim()).join(' & ')}`
  return formatted.join(' & ')
}
