// File a collaboration under the alphabetically earliest surname.
export function authorSortKey(name: string): string {
  return name.split(/\s+(?:and|&)\s+|\s*;\s*|\s*\/\s*/i).map(person => {
    const cleaned = person.trim().replace(/,?\s+(?:jr\.?|sr\.?|ii|iii|iv)$/i, '')
    const surname = cleaned.includes(',') ? cleaned.split(',')[0] : cleaned.split(/\s+/).at(-1) ?? ''
    return surname.toLocaleLowerCase('en')
  }).sort((a, b) => a.localeCompare(b, 'en'))[0] ?? ''
}

export function compareAuthors(a: { name: string }, b: { name: string }) {
  return authorSortKey(a.name).localeCompare(authorSortKey(b.name), 'en') || a.name.localeCompare(b.name, 'en')
}
