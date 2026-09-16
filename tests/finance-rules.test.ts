import assert from 'node:assert/strict';
import test from 'node:test';

import {
  advanceRecurrenceDate,
  cardCycleForPurchase,
  isIsoDateStrict,
  lastDateOfMonth,
  shiftMonthKey,
} from '../lib/finance-rules.ts';

test('rejects calendar dates that JavaScript would normalize', () => {
  assert.equal(isIsoDateStrict('2026-02-28'), true);
  assert.equal(isIsoDateStrict('2026-02-31'), false);
  assert.equal(isIsoDateStrict('2026-13-01'), false);
});

test('monthly recurrence preserves the anchor day across short months', () => {
  assert.equal(
    advanceRecurrenceDate('2028-01-31', 'monthly', 1, '2028-01-31'),
    '2028-02-29',
  );
  assert.equal(
    advanceRecurrenceDate('2028-02-29', 'monthly', 1, '2028-01-31'),
    '2028-03-31',
  );
});

test('yearly recurrence clamps leap day safely', () => {
  assert.equal(
    advanceRecurrenceDate('2028-02-29', 'yearly', 1, '2028-02-29'),
    '2029-02-28',
  );
});

test('month helpers reject normalized invalid month keys', () => {
  assert.throws(() => shiftMonthKey('2026-00', 1), /Mês inválido/);
  assert.throws(() => lastDateOfMonth('2026-13'), /Mês inválido/);
});

test('card purchase after closing goes to the next cycle', () => {
  assert.deepEqual(cardCycleForPurchase('2026-09-11', 10, 17), {
    cycleStart: '2026-09-11',
    cycleEnd: '2026-10-10',
    dueDate: '2026-10-17',
  });
});

test('card due date crosses year when due day precedes closing day', () => {
  assert.deepEqual(cardCycleForPurchase('2026-12-20', 25, 5), {
    cycleStart: '2026-11-26',
    cycleEnd: '2026-12-25',
    dueDate: '2027-01-05',
  });
});
