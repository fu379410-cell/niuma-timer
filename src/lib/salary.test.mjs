import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSettings,
  validateSettings,
  getDaySummary,
  getMonthSummary,
  getMonthDetails,
  getWeekSummary,
  formatDuration,
} from './salary.mjs';

const date = (text) => new Date(text);
const close = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);
const day = (text, settings = defaultSettings) => getDaySummary(settings, date(text));
const dailyPay = 8000 / 21.75;

test('valid defaults: 7.5 paid hours with daily salary and hourly rate', () => {
  assert.deepEqual(validateSettings(defaultSettings), {});
  const result = day('2026-11-03T10:00:00');
  assert.equal(result.totalSeconds, 7.5 * 3600);
  close(result.dailyPay, dailyPay);
  close(result.hourlyRate, dailyPay / 7.5);
  close(result.perSecond * result.totalSeconds, dailyPay);
});

test('before work accrues no salary', () => {
  const result = day('2026-11-03T08:30:00');
  assert.equal(result.status, 'before');
  assert.equal(result.earned, 0);
  assert.equal(result.elapsedSeconds, 0);
  assert.equal(result.remainingSeconds, 9.5 * 3600);
});

test('exact start, fractional seconds, and running clock', () => {
  assert.equal(day('2026-11-03T09:00:00').status, 'working');
  const result = day('2026-11-03T09:00:00.500');
  assert.equal(result.elapsedSeconds, 0.5);
  close(result.earned, (dailyPay / (7.5 * 3600)) * 0.5);
});

test('midday break freezes salary; break boundary resumes accrual', () => {
  const begin = day('2026-11-03T12:00:00');
  const middle = day('2026-11-03T12:45:00');
  const end = day('2026-11-03T13:30:00');
  assert.equal(begin.status, 'break');
  assert.equal(middle.status, 'break');
  assert.equal(end.status, 'working');
  assert.equal(begin.earned, middle.earned);
  assert.equal(end.earned, middle.earned);
  assert.equal(end.elapsedSeconds, 3 * 3600);
});

test('end of shift earns exactly one daily salary and never keeps earning', () => {
  for (const hour of ['18:00:00', '23:59:59']) {
    const result = day(`2026-11-03T${hour}`);
    assert.equal(result.status, 'after');
    assert.equal(result.progress, 1);
    assert.equal(result.remainingSeconds, 0);
    close(result.earned, dailyPay);
  }
});

test('weekend does not accrue salary unless configured as a workday', () => {
  assert.equal(day('2026-11-07T15:00:00').status, 'off');
  assert.equal(day('2026-11-07T15:00:00').earned, 0);
  assert.equal(day('2026-11-07T15:00:00', { ...defaultSettings, workDays: [6] }).status, 'working');
});

test('disabled break is fully paid', () => {
  const result = day('2026-11-03T13:00:00', { ...defaultSettings, breakEnabled: false });
  assert.equal(result.status, 'working');
  assert.equal(result.elapsedSeconds, 4 * 3600);
  assert.equal(result.totalSeconds, 9 * 3600);
});

test('monthly estimate excludes future days and handles first calendar day off', () => {
  const first = getMonthSummary(defaultSettings, date('2026-11-01T23:59:00'));
  assert.equal(first.earned, 0);
  assert.equal(first.completedDays, 0);
  assert.equal(first.workDays, 21);
  close(first.projectedTotal, 21 * dailyPay);
  const partial = getMonthSummary(defaultSettings, date('2026-11-03T12:30:00'));
  assert.equal(partial.completedDays, 1);
  close(partial.earned, dailyPay * (1 + 3 / 7.5));
});

test('month end, short February, and leap year enumerate real dates', () => {
  const end = getMonthSummary(defaultSettings, date('2026-11-30T23:59:59'));
  assert.equal(end.completedDays, 21);
  close(end.earned, end.projectedTotal);
  assert.equal(
    getMonthSummary(
      { ...defaultSettings, workDays: [0, 1, 2, 3, 4, 5, 6] },
      date('2028-02-29T23:59:59')
    ).completedDays,
    29
  );
});

test('weekly estimate is Monday to Sunday, future earnings are zero', () => {
  const week = getWeekSummary(defaultSettings, date('2026-11-03T10:00:00'));
  assert.equal(week.length, 7);
  assert.equal(week[0].date, '2026-11-02');
  assert.equal(week[6].date, '2026-11-08');
  assert.equal(week[1].isToday, true);
  assert.equal(week[0].isFuture, false);
  assert.equal(week[2].isFuture, true);
  assert.equal(week[2].earned, 0);
  close(week[0].earned, dailyPay);
});

const overnight = {
  ...defaultSettings,
  startTime: '22:00',
  endTime: '06:00',
  breakStart: '02:00',
  breakEnd: '02:30',
};
test('overnight shift belongs to starting day and supports a next-day break', () => {
  assert.deepEqual(validateSettings(overnight), {});
  const result = day('2026-11-04T01:00:00', overnight);
  assert.equal(result.workDate, '2026-11-03');
  assert.equal(result.status, 'working');
  assert.equal(result.elapsedSeconds, 3 * 3600);
  assert.equal(result.remainingSeconds, 5 * 3600);
  assert.equal(day('2026-11-04T02:15:00', overnight).status, 'break');
  assert.equal(day('2026-11-04T06:00:00', overnight).status, 'after');
});

test('Friday overnight continues earning on an unscheduled Saturday morning', () => {
  const result = day('2026-11-07T05:00:00', overnight);
  assert.equal(result.status, 'working');
  assert.equal(result.workDate, '2026-11-06');
  assert.equal(result.elapsedSeconds, 6.5 * 3600);
  assert.equal(day('2026-11-07T07:00:00', overnight).status, 'off');
});

test('overnight month boundary uses starting month and no future full-day estimate', () => {
  const settings = { ...overnight, workDays: [0, 1, 2, 3, 4, 5, 6] };
  const now = date('2026-11-01T01:00:00');
  assert.equal(getDaySummary(settings, now).workDate, '2026-10-31');
  assert.equal(getMonthSummary(settings, now).earned, 0);
  const end = getMonthSummary(settings, date('2026-11-30T23:00:00'));
  assert.equal(end.completedDays, 29);
  close(end.earned, dailyPay * (29 + 1 / 7.5));
});

test('a break crossing midnight is accepted; break outside a shift is rejected', () => {
  assert.deepEqual(validateSettings({ ...overnight, breakStart: '23:30', breakEnd: '00:30' }), {});
  assert.ok(validateSettings({ ...overnight, breakStart: '21:00', breakEnd: '21:30' }).breakEnd);
  assert.ok(
    validateSettings({ ...defaultSettings, breakStart: '09:00', breakEnd: '18:00' }).breakEnd
  );
  assert.ok(
    validateSettings({ ...defaultSettings, breakStart: '13:00', breakEnd: '13:00' }).breakEnd
  );
});

test('validation rejects nonfinite, zero duration, malformed time and work days', () => {
  for (const monthlySalary of [NaN, Infinity, -1, '8000'])
    assert.ok(validateSettings({ monthlySalary }).monthlySalary);
  for (const payableDays of [0, -1, 32, Infinity, Number.MIN_VALUE])
    assert.ok(validateSettings({ payableDays }).payableDays);
  for (const startTime of ['24:00', '9:00', '09:60', '', null])
    assert.ok(validateSettings({ startTime }).startTime);
  for (const workDays of [[], [1, 1], [7], [-1], [1.5], '12345'])
    assert.ok(validateSettings({ workDays }).workDays);
  assert.ok(validateSettings({ startTime: '09:00', endTime: '09:00' }).endTime);
  assert.ok(validateSettings({ breakEnabled: 'false' }).breakEnabled);
  assert.ok(
    validateSettings({
      monthlySalary: 1e308,
      payableDays: 1,
      startTime: '09:00',
      endTime: '09:01',
      breakEnabled: false,
    }).monthlySalary
  );
  assert.ok(validateSettings(null).settings);
  assert.deepEqual(validateSettings({ monthlySalary: 0 }), {});
  assert.equal(day('2026-11-03T10:00:00', { monthlySalary: 0 }).earned, 0);
});

test('invalid settings and dates fail explicitly without mutating caller objects', () => {
  assert.throws(() => getDaySummary({ payableDays: 0 }, new Date()), RangeError);
  assert.throws(() => getDaySummary(defaultSettings, new Date(NaN)), RangeError);
  assert.throws(() => getMonthSummary(defaultSettings, '2026-11-01'), RangeError);
  const input = { ...defaultSettings, workDays: [1, 2, 3, 4, 5] };
  const copy = JSON.stringify(input);
  const now = date('2026-11-03T11:00:00');
  const stamp = now.getTime();
  getDaySummary(input, now);
  getMonthSummary(input, now);
  getWeekSummary(input, now);
  assert.equal(JSON.stringify(input), copy);
  assert.equal(now.getTime(), stamp);
});

test('duration is bounded, nonfinite-safe and does not wrap after 24 hours', () => {
  assert.equal(formatDuration(90061.9), '25:01:01');
  assert.equal(formatDuration(60), '00:01:00');
  assert.equal(formatDuration(-1), '00:00:00');
  assert.equal(formatDuration(NaN), '00:00:00');
  assert.equal(formatDuration(Infinity), '00:00:00');
});

test('monthly details keep overnight earnings on the shift start date', () => {
  const now = date('2026-11-04T01:00:00');
  const entries = getMonthDetails(overnight, now);
  assert.equal(entries.length, 30);
  const yesterday = entries.find((entry) => entry.date === '2026-11-03');
  const today = entries.find((entry) => entry.isToday);
  assert.equal(yesterday.status, 'working');
  assert.equal(yesterday.isWorkDay, true);
  assert.equal(yesterday.isFuture, false);
  assert.equal(yesterday.isToday, false);
  close(yesterday.progress, 3 / 7.5);
  close(yesterday.earned, (dailyPay * 3) / 7.5);
  assert.equal(today.date, '2026-11-04');
  assert.equal(today.status, 'before');
  assert.equal(today.earned, 0);
  assert.equal(today.progress, 0);
  assert.equal(entries.find((entry) => entry.date === '2026-11-07').status, 'off');
  close(
    entries.reduce((sum, entry) => sum + entry.earned, 0),
    getMonthSummary(overnight, now).earned
  );
  close(getMonthSummary(overnight, now).earned, dailyPay * (1 + 3 / 7.5));
});

test('month details agree with summary through break, midnight, month end and year end', () => {
  const allDaysOvernight = { ...overnight, workDays: [0, 1, 2, 3, 4, 5, 6] };
  for (const when of [
    '2026-11-01T01:00:00',
    '2026-11-03T02:15:00',
    '2026-11-30T23:00:00',
    '2026-12-31T23:59:59',
  ]) {
    const now = date(when);
    const entries = getMonthDetails(allDaysOvernight, now);
    const summary = getMonthSummary(allDaysOvernight, now);
    assert.equal(
      entries.reduce((sum, entry) => sum + entry.earned, 0),
      summary.earned
    );
    assert.equal(entries.filter((entry) => entry.status === 'after').length, summary.completedDays);
    assert.equal(entries.filter((entry) => entry.isWorkDay).length, summary.workDays);
    assert.equal(entries.filter((entry) => entry.isToday).length, 1);
    assert.ok(entries.filter((entry) => entry.isFuture).every((entry) => entry.earned === 0));
  }
  const first = getMonthDetails(allDaysOvernight, date('2026-11-01T01:00:00'));
  assert.equal(first[0].status, 'before');
  assert.equal(first[0].earned, 0);
  assert.equal(getDaySummary(allDaysOvernight, date('2026-11-01T01:00:00')).workDate, '2026-10-31');
});

test('zero salary still identifies scheduled days in monthly and weekly entries', () => {
  const settings = { ...defaultSettings, monthlySalary: 0 };
  const now = date('2026-11-03T14:00:00');
  const week = getWeekSummary(settings, now);
  assert.equal(week[0].isWorkDay, true);
  assert.equal(week[1].isWorkDay, true);
  assert.equal(week[5].isWorkDay, false);
  assert.equal(week[1].earned, 0);
  const today = getMonthDetails(settings, now).find((entry) => entry.isToday);
  assert.equal(today.status, 'working');
  assert.ok(today.progress > 0);
  assert.equal(today.earned, 0);
});
