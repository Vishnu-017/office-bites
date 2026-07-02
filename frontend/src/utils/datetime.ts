// IST formatting helpers — Asia/Kolkata, 12-hour clock
const IST_OPTS: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Kolkata',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

export function fmtIST(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const dateStr = d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    });
    const timeStr = d.toLocaleTimeString('en-IN', IST_OPTS);
    return `${dateStr}, ${timeStr}`;
  } catch { return iso; }
}

export function fmtISTTime(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-IN', IST_OPTS);
  } catch { return iso; }
}

export function fmtISTDate(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return iso; }
}

// Return "12 Feb 2026 at 3:45 PM"
export function fmtISTFriendly(iso: string | undefined | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-IN', IST_OPTS);
    return `${date} at ${time} IST`;
  } catch { return iso; }
}
