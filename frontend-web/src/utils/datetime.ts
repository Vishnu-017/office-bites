const IST_TIMEZONE = 'Asia/Kolkata';

function getISTParts(dateString: string) {
  const date = new Date(dateString);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    dayPeriod: get('dayPeriod').toUpperCase(),
  };
}

// Formats any timestamp as its IST wall-clock date + time, regardless of the viewer's
// own machine/browser timezone (avoids double-applying a timezone shift).
export function formatISTDateTime(dateString: string): string {
  const p = getISTParts(dateString);
  return `${p.month} ${p.day}, ${p.year} ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

export function formatISTTime(dateString: string): string {
  const p = getISTParts(dateString);
  return `${p.hour}:${p.minute} ${p.dayPeriod}`;
}

export function formatISTDate(dateString: string): string {
  const p = getISTParts(dateString);
  return `${p.month} ${p.day}, ${p.year}`;
}

// "YYYY-MM-DD" for the current date, as seen in IST (not UTC), for defaulting
// date pickers so the poll/report "today" always matches the IST calendar day.
export function todayISTDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: IST_TIMEZONE }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
