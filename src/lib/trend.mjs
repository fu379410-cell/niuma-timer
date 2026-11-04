import { defaultSettings, getDaySummary } from './salary.mjs';

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function niceMoneyTick(windowGain) {
  if (!(windowGain > 0) || !Number.isFinite(windowGain)) return 0.01;
  const target = Math.max(windowGain / 2, 1e-8);
  const power = 10 ** Math.floor(Math.log10(target));
  const ratio = target / power;
  const step = [1, 2, 2.5, 5, 10].find((value) => value >= ratio) ?? 10;
  return step * power;
}

// The axis stays put while money rises. Recenter by whole money ticks only at an edge.
function stableLiveRange(low, high, windowGain, key, previous) {
  const tick = niceMoneyTick(windowGain);
  const rounded = (value) => Number(value.toPrecision(14));
  const validPrevious =
    previous?.key === key &&
    previous.tick === tick &&
    Number.isFinite(previous.yMin) &&
    Number.isFinite(previous.yMax) &&
    previous.yMax > previous.yMin;
  if (validPrevious) {
    const lowerEdge = previous.yMin === 0 ? 0 : previous.yMin + tick * 0.12;
    const upperEdge = previous.yMax - tick * 0.12;
    if (low >= lowerEdge && high <= upperEdge) return previous;
  }
  const yMin = rounded(Math.max(0, (Math.floor(low / tick) - 1) * tick));
  const proposedMax = rounded(yMin + tick * 4);
  const yMax = Number.isFinite(proposedMax) ? proposedMax : Number.MAX_VALUE;
  return { key, tick, yMin, yMax };
}

/** Income points for the active shift. Every value uses the salary engine, with no jitter. */
export function getIncomeTrend(settings = defaultSettings, date = new Date(), options = {}) {
  const summary = getDaySummary(settings, date);
  const now = new Date(date).getTime();
  const mode = options.mode === 'day' ? 'day' : 'live';
  const count = Number.isInteger(options.sampleCount) ? clamp(options.sampleCount, 2, 361) : 61;
  const shiftStart = +summary.startAt;
  const shiftEnd = +summary.endAt;
  const startAt = mode === 'day' ? shiftStart : now - 60_000;
  const endAt = mode === 'day' ? shiftEnd : now;
  const latestAt = mode === 'day' ? clamp(now, shiftStart, shiftEnd) : now;
  const sampleEnd = mode === 'day' ? latestAt : endAt;
  const times = Array.from(
    { length: count },
    (_, index) => startAt + ((sampleEnd - startAt) * index) / (count - 1)
  );

  // Include the exact break corners so a short break never becomes a sloped segment.
  const config = { ...defaultSettings, ...settings };
  if (config.breakEnabled) {
    const pause = new Date(shiftStart);
    const [hours, minutes] = config.breakStart.split(':').map(Number);
    pause.setHours(hours, minutes, 0, 0);
    if (+pause < shiftStart) pause.setDate(pause.getDate() + 1);
    for (const time of [+pause, +pause + summary.breakSeconds * 1000]) {
      if (time >= startAt && time <= sampleEnd) times.push(time);
    }
  }

  function incomeAt(time) {
    if (!summary.isWorkDay || time <= shiftStart) return 0;
    if (time >= shiftEnd) return summary.dailyPay;
    // Keeping one shift as the reference avoids mixing yesterday's pay at midnight.
    const value = getDaySummary(config, new Date(time));
    return value.workDate === summary.workDate ? value.earned : 0;
  }

  const points = [...new Set(times)]
    .sort((a, b) => a - b)
    .map((time) => ({ time, earned: incomeAt(time) }));
  const values = points.map((point) => point.earned);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const expectedGain = summary.perSecond * 60;
  const rangeKey = [
    summary.workDate,
    shiftStart,
    shiftEnd,
    summary.dailyPay,
    config.breakEnabled,
    config.breakStart,
    config.breakEnd,
  ].join('|');
  const liveRange =
    mode === 'live' ? stableLiveRange(low, high, expectedGain, rangeKey, options.liveRange) : null;
  const yMin = liveRange?.yMin ?? 0;
  const rawMax = summary.dailyPay * 1.06;
  const yMax =
    liveRange?.yMax ?? (Number.isFinite(rawMax) ? Math.max(0.01, rawMax) : Math.max(0.01, high));

  return {
    mode,
    points,
    status: summary.status,
    workDate: summary.workDate,
    startAt,
    endAt,
    latestAt,
    yMin,
    yMax,
    yTick: liveRange?.tick ?? null,
    liveRange,
    latestEarned: points.at(-1).earned,
    delta: Math.max(0, points.at(-1).earned - points[0].earned),
    dailyPay: summary.dailyPay,
  };
}
