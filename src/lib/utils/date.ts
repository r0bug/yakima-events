import { format, parseISO, isValid, formatDistance, isSameDay, isToday, isTomorrow, isThisWeek } from 'date-fns';

/**
 * Format a date string for display
 */
export function formatDate(dateString: string, formatStr: string = 'PPP'): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return dateString;
    return format(date, formatStr);
  } catch {
    return dateString;
  }
}

/**
 * Format a time string for display
 */
export function formatTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return '';
    return format(date, 'h:mm a');
  } catch {
    return '';
  }
}

/**
 * Format a date range
 */
export function formatDateRange(start: string, end?: string): string {
  const startDate = parseISO(start);
  if (!isValid(startDate)) return start;

  let result = format(startDate, 'EEEE, MMMM d, yyyy');
  result += ' at ' + format(startDate, 'h:mm a');

  if (end) {
    const endDate = parseISO(end);
    if (isValid(endDate)) {
      if (isSameDay(startDate, endDate)) {
        result += ' - ' + format(endDate, 'h:mm a');
      } else {
        result += ' - ' + format(endDate, 'MMMM d, yyyy h:mm a');
      }
    }
  }

  return result;
}

/**
 * Get relative time description
 */
export function getRelativeTime(dateString: string): string {
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return '';

    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE');

    return formatDistance(date, new Date(), { addSuffix: true });
  } catch {
    return '';
  }
}

/**
 * Check if a date is in the past
 */
export function isPastDate(dateString: string): boolean {
  try {
    const date = parseISO(dateString);
    return isValid(date) && date < new Date();
  } catch {
    return false;
  }
}

/**
 * Format for Google Calendar export
 */
export function formatForCalendar(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}
