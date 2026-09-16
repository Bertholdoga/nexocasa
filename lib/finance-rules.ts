export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';

export type CardCycle = {
  cycleStart: string;
  cycleEnd: string;
  dueDate: string;
};

type DateParts = { year: number; month: number; day: number };

function parseDateParts(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftedMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function dateAtDay(year: number, month: number, requestedDay: number) {
  return isoDate(year, month, Math.min(requestedDay, daysInMonth(year, month)));
}

export function isIsoDateStrict(value: string) {
  const parts = parseDateParts(value);
  if (!parts || parts.month < 1 || parts.month > 12 || parts.day < 1) {
    return false;
  }
  return parts.day <= daysInMonth(parts.year, parts.month);
}

export function monthKeyFromDate(value: string) {
  if (!isIsoDateStrict(value)) throw new Error('Data inválida.');
  return value.slice(0, 7);
}

export function shiftMonthKey(month: string, offset: number) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const monthNumber = Number(match?.[2]);
  if (!match || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Mês inválido.');
  }
  const shifted = shiftedMonth(Number(match[1]), Number(match[2]), offset);
  return `${String(shifted.year).padStart(4, '0')}-${String(shifted.month).padStart(2, '0')}`;
}

export function lastDateOfMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  const monthNumber = Number(match?.[2]);
  if (!match || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Mês inválido.');
  }
  const year = Number(match[1]);
  return dateAtDay(year, monthNumber, 31);
}

export function advanceRecurrenceDate(
  currentDate: string,
  frequency: RecurrenceFrequency,
  interval = 1,
  anchorDate = currentDate,
) {
  if (!isIsoDateStrict(currentDate) || !isIsoDateStrict(anchorDate)) {
    throw new Error('Data de recorrência inválida.');
  }
  if (!Number.isInteger(interval) || interval < 1 || interval > 12) {
    throw new Error('Intervalo de recorrência inválido.');
  }
  const current = parseDateParts(currentDate)!;
  const anchor = parseDateParts(anchorDate)!;

  if (frequency === 'weekly') {
    const date = new Date(
      Date.UTC(current.year, current.month - 1, current.day + interval * 7),
    );
    return date.toISOString().slice(0, 10);
  }

  if (frequency === 'monthly') {
    const next = shiftedMonth(current.year, current.month, interval);
    return dateAtDay(next.year, next.month, anchor.day);
  }

  return dateAtDay(current.year + interval, anchor.month, anchor.day);
}

export function cardCycleForPurchase(
  purchaseDate: string,
  closingDay: number,
  dueDay: number,
): CardCycle {
  if (!isIsoDateStrict(purchaseDate)) throw new Error('Data inválida.');
  if (
    !Number.isInteger(closingDay) ||
    !Number.isInteger(dueDay) ||
    closingDay < 1 ||
    closingDay > 31 ||
    dueDay < 1 ||
    dueDay > 31
  ) {
    throw new Error('Fechamento ou vencimento inválido.');
  }

  const purchase = parseDateParts(purchaseDate)!;
  const effectiveClosingDay = Math.min(
    closingDay,
    daysInMonth(purchase.year, purchase.month),
  );
  const cycleMonth = shiftedMonth(
    purchase.year,
    purchase.month,
    purchase.day <= effectiveClosingDay ? 0 : 1,
  );
  const cycleEnd = dateAtDay(cycleMonth.year, cycleMonth.month, closingDay);
  const previousCycleMonth = shiftedMonth(
    cycleMonth.year,
    cycleMonth.month,
    -1,
  );
  const previousEnd = dateAtDay(
    previousCycleMonth.year,
    previousCycleMonth.month,
    closingDay,
  );
  const previous = parseDateParts(previousEnd)!;
  const cycleStartDate = new Date(
    Date.UTC(previous.year, previous.month - 1, previous.day + 1),
  );
  const dueMonth = shiftedMonth(
    cycleMonth.year,
    cycleMonth.month,
    dueDay > closingDay ? 0 : 1,
  );

  return {
    cycleStart: cycleStartDate.toISOString().slice(0, 10),
    cycleEnd,
    dueDate: dateAtDay(dueMonth.year, dueMonth.month, dueDay),
  };
}
