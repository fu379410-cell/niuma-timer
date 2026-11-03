/** Local, deterministic salary estimates. A shift belongs to its start date. */
export const defaultSettings = Object.freeze({
  monthlySalary: 8000,
  payableDays: 21.75,
  startTime: '09:00',
  endTime: '18:00',
  breakEnabled: true,
  breakStart: '12:00',
  breakEnd: '13:30',
  workDays: Object.freeze([1, 2, 3, 4, 5]),
});

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const merged = (settings) => ({ ...defaultSettings, ...settings });
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));

function offsets(settings) {
  const start = minutes(settings.startTime);
  const end = minutes(settings.endTime) + (minutes(settings.endTime) < start ? 1440 : 0);
  let breakStart = start;
  let breakEnd = start;
  if (settings.breakEnabled) {
    breakStart = minutes(settings.breakStart);
    if (breakStart < start) breakStart += 1440;
    breakEnd = minutes(settings.breakEnd);
    if (breakEnd < breakStart % 1440) breakEnd += 1440;
    if (breakStart >= 1440 && breakEnd < 1440) breakEnd += 1440;
  }
  return { start, end, breakStart, breakEnd };
}

/** Empty object means valid. Missing fields use defaultSettings. */
export function validateSettings(input = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { settings: '请提供有效的打工配置' };
  }
  const settings = merged(input);
  const errors = {};
  if (
    typeof settings.monthlySalary !== 'number' ||
    !Number.isFinite(settings.monthlySalary) ||
    settings.monthlySalary < 0
  ) {
    errors.monthlySalary = '月薪需为不小于 0 的有限数字';
  }
  if (
    typeof settings.payableDays !== 'number' ||
    !Number.isFinite(settings.payableDays) ||
    settings.payableDays <= 0 ||
    settings.payableDays > 31
  ) {
    errors.payableDays = '月计薪天数需大于 0 且不超过 31';
  }
  if (typeof settings.breakEnabled !== 'boolean') errors.breakEnabled = '请选择是否扣除午休';
  for (const key of [
    'startTime',
    'endTime',
    ...(settings.breakEnabled ? ['breakStart', 'breakEnd'] : []),
  ]) {
    if (typeof settings[key] !== 'string' || !timePattern.test(settings[key]))
      errors[key] = '请填写有效时间（HH:MM）';
  }
  if (
    !Array.isArray(settings.workDays) ||
    settings.workDays.length === 0 ||
    settings.workDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
    new Set(settings.workDays).size !== settings.workDays.length
  ) {
    errors.workDays = '请至少选择一个工作日，且不能重复';
  }
  if (!errors.startTime && !errors.endTime && settings.startTime === settings.endTime) {
    errors.endTime = '下班时间不能与上班时间相同';
  }
  if (
    !errors.startTime &&
    !errors.endTime &&
    !errors.breakStart &&
    !errors.breakEnd &&
    settings.breakEnabled === true
  ) {
    const { start, end, breakStart, breakEnd } = offsets(settings);
    if (
      breakStart < start ||
      breakEnd > end ||
      breakStart >= breakEnd ||
      breakEnd - breakStart >= end - start
    ) {
      errors.breakEnd = '休息时段需在班次内，且保留有效工作时间';
    }
  }
  if (
    !errors.monthlySalary &&
    !errors.payableDays &&
    !Number.isFinite(settings.monthlySalary / settings.payableDays)
  ) {
    errors.payableDays = '月计薪天数过小，无法计算';
  }
  if (!Object.keys(errors).length) {
    const { start, end, breakStart, breakEnd } = offsets(settings);
    const paidMinutes = end - start - (settings.breakEnabled ? breakEnd - breakStart : 0);
    if (!Number.isFinite(settings.monthlySalary / settings.payableDays / (paidMinutes / 60))) {
      errors.monthlySalary = '月薪数值过大，无法计算时薪';
    }
  }
  return errors;
}

function config(settings) {
  const errors = validateSettings(settings);
  if (Object.keys(errors).length) throw new RangeError(Object.values(errors).join('；'));
  return merged(settings);
}

function validDate(date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()))
    throw new RangeError('请提供有效日期');
  return new Date(date);
}

function midnight(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function atMinutes(day, value) {
  const date = midnight(day);
  date.setDate(date.getDate() + Math.floor(value / 1440));
  date.setHours(Math.floor((value % 1440) / 60), value % 60, 0, 0);
  return date;
}

function shift(settings, day) {
  const value = offsets(settings);
  const startAt = atMinutes(day, value.start);
  const endAt = atMinutes(day, value.end);
  const breakStartAt = atMinutes(day, value.breakStart);
  const breakEndAt = atMinutes(day, value.breakEnd);
  const breakSeconds = settings.breakEnabled ? (breakEndAt - breakStartAt) / 1000 : 0;
  return {
    startAt,
    endAt,
    breakStartAt,
    breakEndAt,
    breakSeconds,
    totalSeconds: (endAt - startAt) / 1000 - breakSeconds,
  };
}

function elapsedForShift(value, now) {
  const wallSeconds = clamp((now - value.startAt) / 1000, 0, (value.endAt - value.startAt) / 1000);
  const breakTaken = clamp((now - value.breakStartAt) / 1000, 0, value.breakSeconds);
  return clamp(wallSeconds - breakTaken, 0, value.totalSeconds);
}

function shiftStatus(settings, value, now, isWorkDay) {
  if (!isWorkDay) return 'off';
  if (now < value.startAt) return 'before';
  if (now >= value.endAt) return 'after';
  if (settings.breakEnabled && now >= value.breakStartAt && now < value.breakEndAt) return 'break';
  return 'working';
}

function dateEntry(settings, day, now) {
  const value = shift(settings, day);
  const isWorkDay = settings.workDays.includes(day.getDay());
  const progress = isWorkDay ? elapsedForShift(value, now) / value.totalSeconds : 0;
  const today = midnight(now);
  return {
    date: dateKey(day),
    label: `${day.getDate()}日`,
    isWorkDay,
    isToday: day.getTime() === today.getTime(),
    isFuture: day > today,
    earned: (settings.monthlySalary / settings.payableDays) * progress,
    progress,
    status: shiftStatus(settings, value, now, isWorkDay),
  };
}

/** The previous shift stays active across midnight, including its end instant. */
export function getDaySummary(input = defaultSettings, date = new Date()) {
  const settings = config(input);
  const now = validDate(date);
  let day = midnight(now);
  if (minutes(settings.endTime) < minutes(settings.startTime)) {
    const previous = addDays(day, -1);
    if (settings.workDays.includes(previous.getDay()) && now <= shift(settings, previous).endAt)
      day = previous;
  }
  const value = shift(settings, day);
  const isWorkDay = settings.workDays.includes(day.getDay());
  const status = shiftStatus(settings, value, now, isWorkDay);
  const elapsedSeconds = isWorkDay ? elapsedForShift(value, now) : 0;
  const dailyPay = settings.monthlySalary / settings.payableDays;
  const perSecond = dailyPay / value.totalSeconds;
  const progress = elapsedSeconds / value.totalSeconds;
  return {
    status,
    statusLabel: {
      before: '还没上班',
      working: '正在搬砖',
      break: '午休回血',
      after: '已下班',
      off: '今天休息',
    }[status],
    workDate: dateKey(day),
    isWorkDay,
    startAt: value.startAt,
    endAt: value.endAt,
    breakSeconds: value.breakSeconds,
    elapsedSeconds,
    totalSeconds: value.totalSeconds,
    remainingSeconds: isWorkDay ? Math.max(0, (value.endAt - now) / 1000) : 0,
    earned: dailyPay * progress,
    dailyPay,
    hourlyRate: perSecond * 3600,
    perSecond,
    progress,
  };
}

/** Previous scheduled shifts are estimated as full attendance; no history is tracked. */
export function getMonthSummary(input = defaultSettings, date = new Date()) {
  const settings = config(input);
  const entries = getMonthDetails(settings, date);
  const dailyPay = settings.monthlySalary / settings.payableDays;
  const workDays = entries.filter((entry) => entry.isWorkDay).length;
  return {
    earned: entries.reduce((sum, entry) => sum + entry.earned, 0),
    completedDays: entries.filter((entry) => entry.status === 'after').length,
    projectedTotal: workDays * dailyPay,
    workDays,
  };
}

/** Each row belongs to its shift's start date, including ongoing overnight work. */
export function getMonthDetails(input = defaultSettings, date = new Date()) {
  const settings = config(input);
  const now = validDate(date);
  const month = now.getMonth();
  const entries = [];
  for (
    let day = new Date(now.getFullYear(), month, 1);
    day.getMonth() === month;
    day = addDays(day, 1)
  ) {
    entries.push(dateEntry(settings, day, now));
  }
  return entries;
}

export function getWeekSummary(input = defaultSettings, date = new Date()) {
  const settings = config(input);
  const now = validDate(date);
  const today = midnight(now);
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(monday, index);
    const entry = dateEntry(settings, day, now);
    return {
      date: entry.date,
      label: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][index],
      earned: entry.earned,
      isToday: entry.isToday,
      isFuture: entry.isFuture,
      isWorkDay: entry.isWorkDay,
    };
  });
}

export function formatDuration(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '00:00:00';
  const whole = Math.max(0, Math.floor(seconds));
  return [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}
