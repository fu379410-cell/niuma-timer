import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSettings } from './salary.mjs';
import { getIncomeTrend } from './trend.mjs';

const at = (day, time) => new Date(`${day}T${time}`);
const near = (actual, expected) =>
  assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const dailyPay = 8000 / 21.75;
const perSecond = dailyPay / (7.5 * 3600);

test('working live window advances one second with genuine pay and timestamp', () => {
  const first = getIncomeTrend(defaultSettings, at('2026-11-03', '10:30:00'));
  const next = getIncomeTrend(defaultSettings, at('2026-11-03', '10:30:01'));
  assert.equal(first.status, 'working');
  assert.equal(next.latestAt - first.latestAt, 1000);
  near(next.latestEarned - first.latestEarned, perSecond);
  near(next.delta, perSecond * 60);
  assert.ok(next.points.at(-1).earned > first.points.at(-1).earned);
  assert.equal(next.startAt, +at('2026-11-03', '10:29:01'));
});

test('midday live window is a flat pause, not a fabricated rising line', () => {
  const value = getIncomeTrend(defaultSettings, at('2026-11-03', '12:30:00'));
  assert.equal(value.status, 'break');
  assert.equal(value.delta, 0);
  for (const point of value.points) near(point.earned, (dailyPay * 3) / 7.5);
});

test('full-day points include exact break corners and no future accrual', () => {
  const value = getIncomeTrend(defaultSettings, at('2026-11-03', '14:00:00'), { mode: 'day' });
  const start = value.points.find((p) => p.time === +at('2026-11-03', '12:00:00'));
  const end = value.points.find((p) => p.time === +at('2026-11-03', '13:30:00'));
  assert.ok(start && end);
  near(start.earned, end.earned);
  near(value.latestEarned, (dailyPay * 3.5) / 7.5);
  assert.equal(value.endAt, +at('2026-11-03', '18:00:00'));
  assert.ok(value.points.every((p) => p.time <= +at('2026-11-03', '14:00:00')));
});

test('after work live points stop growing exactly at daily pay', () => {
  const value = getIncomeTrend(defaultSettings, at('2026-11-03', '20:00:00'));
  assert.equal(value.status, 'after');
  assert.equal(value.delta, 0);
  for (const point of value.points) near(point.earned, dailyPay);
});

test('overnight points retain the start date and continue across midnight', () => {
  const settings = {
    ...defaultSettings,
    startTime: '22:00',
    endTime: '06:00',
    breakStart: '02:00',
    breakEnd: '02:30',
  };
  const value = getIncomeTrend(settings, at('2026-11-04', '01:00:00'), { mode: 'day' });
  assert.equal(value.workDate, '2026-11-03');
  assert.equal(value.startAt, +at('2026-11-03', '22:00:00'));
  assert.equal(value.endAt, +at('2026-11-04', '06:00:00'));
  near(value.latestEarned, (dailyPay * 3) / 7.5);
  assert.ok(
    value.points.every((point, index) => !index || point.earned >= value.points[index - 1].earned)
  );
});

test('zero salary and rest days have finite plot ranges and zero earnings', () => {
  for (const date of [at('2026-11-03', '10:00:00'), at('2026-11-07', '14:00:00')]) {
    for (const mode of ['live', 'day']) {
      const value = getIncomeTrend({ ...defaultSettings, monthlySalary: 0 }, date, { mode });
      assert.ok(
        Number.isFinite(value.yMin) && Number.isFinite(value.yMax) && value.yMax > value.yMin
      );
      assert.ok(value.points.every((p) => p.earned === 0 && Number.isFinite(p.time)));
    }
  }
});

test('new calendar day does not mix last shift salary into new-day income', () => {
  const value = getIncomeTrend(defaultSettings, at('2026-11-04', '00:00:05'));
  assert.equal(value.status, 'before');
  assert.equal(value.delta, 0);
  assert.ok(value.points.every((p) => p.earned === 0));
});

test('live money ticks stay anchored so a one-second gain moves the plotted endpoint', () => {
  const first = getIncomeTrend(defaultSettings, at('2026-11-03', '10:30:00'));
  const next = getIncomeTrend(defaultSettings, at('2026-11-03', '10:30:01'), {
    liveRange: first.liveRange,
  });
  assert.equal(first.yMin, next.yMin);
  assert.equal(first.yMax, next.yMax);
  const plottedY = (model) =>
    110 - ((model.latestEarned - model.yMin) / (model.yMax - model.yMin)) * 96;
  assert.ok(plottedY(next) < plottedY(first), 'real pay must move the endpoint upwards');
  assert.ok(
    plottedY(first) - plottedY(next) > 0.1,
    'the visible endpoint must not be normalized back to the same position'
  );
  near(first.delta, next.delta);
});

test('stable live range retains its money ticks until data reaches the edge', () => {
  const start = at('2026-11-03', '10:30:00');
  let previous = getIncomeTrend(defaultSettings, start);
  const initialRange = previous.liveRange;
  for (let seconds = 1; seconds <= 20; seconds++) {
    const next = getIncomeTrend(defaultSettings, new Date(+start + seconds * 1000), {
      liveRange: previous.liveRange,
    });
    assert.deepEqual(next.liveRange, initialRange);
    assert.ok(next.latestEarned > previous.latestEarned);
    previous = next;
  }
  const later = getIncomeTrend(defaultSettings, new Date(+start + 90_000), {
    liveRange: previous.liveRange,
  });
  assert.ok(later.yMin > initialRange.yMin);
  near(later.yMax - later.yMin, initialRange.yMax - initialRange.yMin);
  assert.ok(later.points.every((p) => p.earned >= later.yMin && p.earned <= later.yMax));
  near(
    (later.yMin - initialRange.yMin) / initialRange.tick,
    Math.round((later.yMin - initialRange.yMin) / initialRange.tick)
  );
});

test('live range resets for new wage settings and paused samples stay fixed', () => {
  const first = getIncomeTrend(defaultSettings, at('2026-11-03', '12:30:00'));
  const paused = getIncomeTrend(defaultSettings, at('2026-11-03', '12:30:01'), {
    liveRange: first.liveRange,
  });
  assert.deepEqual(paused.liveRange, first.liveRange);
  assert.equal(paused.latestEarned, first.latestEarned);
  const changed = getIncomeTrend(
    { ...defaultSettings, monthlySalary: 16000 },
    at('2026-11-03', '12:30:01'),
    {
      liveRange: first.liveRange,
    }
  );
  assert.notEqual(changed.liveRange.key, first.liveRange.key);
  assert.ok(changed.latestEarned >= changed.yMin && changed.latestEarned <= changed.yMax);
});
