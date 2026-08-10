export interface CalendarDay {
  key: string;
  date: Date;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  label: string;
  weekdays: string[];
  days: CalendarDay[];
}

function sameLocalDate(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function addCalendarMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12, 0, 0, 0);
}

export function startOfCalendarMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

export function buildCalendarMonth(anchor: Date, today: Date = new Date()): CalendarMonth {
  const first = startOfCalendarMonth(anchor);
  const startOffset = first.getDay();
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset, 12, 0, 0, 0);
  const formatter = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
  const weekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: "short" });
  const sunday = new Date(2024, 0, 7, 12, 0, 0, 0);
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    return weekdayFormatter.format(date);
  });

  const days = Array.from({ length: 42 }, (_, index): CalendarDay => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === first.getMonth() && date.getFullYear() === first.getFullYear(),
      isToday: sameLocalDate(date, today),
    };
  });

  return { year: first.getFullYear(), month: first.getMonth(), label: formatter.format(first), weekdays, days };
}
