import { format } from 'date-fns';

export function toIST(dateString: string): Date {
  const utcDate = new Date(dateString);
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(utcDate.getTime() + istOffset);
}

export function formatISTDateTime(dateString: string): string {
  const istDate = toIST(dateString);
  return format(istDate, 'MMM dd, yyyy hh:mm a');
}

export function formatISTTime(dateString: string): string {
  const istDate = toIST(dateString);
  return format(istDate, 'hh:mm a');
}

export function formatISTDate(dateString: string): string {
  const istDate = toIST(dateString);
  return format(istDate, 'MMM dd, yyyy');
}
