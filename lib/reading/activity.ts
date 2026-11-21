export type ActivitySession = {
  id: string;
  baselinePage: number;
  finishedAt: string | null;
  book: { id: string; title: string; author: { name: string } };
  logs: { id: string; page: number; occurredAt: string; createdAt: string }[];
};
export type FinishedRead = { sessionId: string; bookId: string; title: string; author: string; finishedAt: string; day: string };
export type ActivityTotals = { pages: number; books: number; completedReads: number; activeDays: number; entries: number };
export type ActivityMonth = ActivityTotals & { month: number; label: string };
export type ActivityQuarter = ActivityTotals & { quarter: number; state: 'complete' | 'in-progress' | 'upcoming'; finished: FinishedRead[]; busiestMonth: ActivityMonth | null; averagePagesPerActiveDay: number | null };
export type ReadingActivity = {
  year: number; timeZone: string; currentYear: number; currentQuarter: number; availableYears: number[];
  totals: ActivityTotals; months: ActivityMonth[]; quarters: ActivityQuarter[]; undatedReadBooks: number; generatedAt: string;
};
export function validTimeZone(value: string) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }).format(); return true; } catch { return false; }
}
export function calendarDate(timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return (value: string | Date) => {
    const parts = formatter.formatToParts(new Date(value));
    const part = (name: string) => parts.find(p => p.type === name)!.value;
    return { year: Number(part('year')), month: Number(part('month')), day: `${part('year')}-${part('month')}-${part('day')}` };
  };
}
const monthLabels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Assign only newly reached pages to each stopping-point timestamp. The high-water
// mark includes all earlier years; filtering first would count those pages twice.
export function buildReadingActivity(sessions: ActivitySession[], year: number, timeZone: string, undatedReadBooks = 0, now = new Date()): ReadingActivity {
  const date = calendarDate(timeZone), today = date(now), currentQuarter = Math.ceil(today.month / 3);
  const years = new Set([today.year, year]);
  const monthly = monthLabels.map((label, index) => ({ month: index + 1, label, pages: 0, entries: 0, days: new Set<string>(), finished: [] as FinishedRead[] }));
  for (const session of sessions) {
    let highWater = session.baselinePage;
    const logs = [...session.logs].filter(log => new Date(log.occurredAt).getTime() <= now.getTime()).sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id));
    for (const log of logs) {
      const delta = Math.max(0, log.page - highWater);
      highWater = Math.max(highWater, log.page);
      const day = date(log.occurredAt); years.add(day.year);
      if (day.year !== year) continue;
      const month = monthly[day.month - 1]; month.pages += delta; month.entries++;
      if (delta > 0) month.days.add(day.day);
    }
    if (session.finishedAt && new Date(session.finishedAt).getTime() <= now.getTime()) {
      const day = date(session.finishedAt); years.add(day.year);
      if (day.year === year) monthly[day.month - 1].finished.push({ sessionId: session.id, bookId: session.book.id, title: session.book.title, author: session.book.author.name, finishedAt: session.finishedAt, day: day.day });
    }
  }
  const summarize = (items: typeof monthly): ActivityTotals => ({ pages: items.reduce((n, item) => n + item.pages, 0), entries: items.reduce((n, item) => n + item.entries, 0), books: new Set(items.flatMap(item => item.finished.map(read => read.bookId))).size, completedReads: items.reduce((n, item) => n + item.finished.length, 0), activeDays: new Set(items.flatMap(item => [...item.days])).size });
  const months = monthly.map(item => ({ month: item.month, label: item.label, ...summarize([item]) }));
  const quarters = [1, 2, 3, 4].map(quarter => {
    const items = monthly.slice((quarter - 1) * 3, quarter * 3), totals = summarize(items);
    const busiest = months.slice((quarter - 1) * 3, quarter * 3).filter(month => month.pages > 0).sort((a, b) => b.pages - a.pages || a.month - b.month)[0] ?? null;
    const state: ActivityQuarter['state'] = year > today.year || (year === today.year && quarter > currentQuarter) ? 'upcoming' : year === today.year && quarter === currentQuarter ? 'in-progress' : 'complete';
    return { quarter, state, ...totals, finished: items.flatMap(item => item.finished).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt) || a.sessionId.localeCompare(b.sessionId)), busiestMonth: busiest, averagePagesPerActiveDay: totals.activeDays ? Math.round(totals.pages / totals.activeDays * 10) / 10 : null };
  });
  return { year, timeZone, currentYear: today.year, currentQuarter, availableYears: [...years].sort((a, b) => b - a), totals: summarize(monthly), months, quarters, undatedReadBooks, generatedAt: now.toISOString() };
}
