/** Goal state is independent from salary settings and contains no income data. */
export const GOALS_STORAGE_KEY = 'niuma.goals.v1';
export const MAX_CUSTOM_GOALS = 100;
export const GOAL_CATEGORIES = Object.freeze(
  [
    { id: 'food', name: '吃吃喝喝', emoji: '🍜' },
    { id: 'life', name: '认真生活', emoji: '🪴' },
    { id: 'hobby', name: '兴趣续命', emoji: '🎮' },
    { id: 'travel', name: '奔向远方', emoji: '🏝️' },
    { id: 'self', name: '犒劳自己', emoji: '✨' },
  ].map(Object.freeze)
);

const seed = [
  ['soda', '冰镇快乐水', 6, '🥤', '瓶', 'food'],
  ['coffee', '续命咖啡', 25, '☕', '杯', 'food'],
  ['tea', '下班奶茶', 18, '🧋', '杯', 'food'],
  ['breakfast', '不慌张的早餐', 12, '🥐', '份', 'food'],
  ['noodles', '热气腾腾的面', 16, '🍜', '碗', 'food'],
  ['hotpot', '快乐火锅局', 128, '🍲', '顿', 'food'],
  ['snack', '夜宵自由', 68, '🍢', '顿', 'food'],
  ['fruit', '一袋新鲜水果', 30, '🍑', '袋', 'food'],
  ['metro', '回家的地铁', 4, '🚇', '程', 'life'],
  ['flowers', '没有理由的花', 39, '💐', '束', 'life'],
  ['plant', '工位小森林', 35, '🪴', '盆', 'life'],
  ['lamp', '温柔的小夜灯', 89, '💡', '盏', 'life'],
  ['pillow', '一颗好睡的枕头', 129, '🛏️', '只', 'life'],
  ['mug', '喜欢的马克杯', 59, '🏺', '只', 'life'],
  ['groceries', '塞满冰箱', 150, '🥬', '次', 'life'],
  ['dinner', '认真做一顿饭', 45, '🍳', '顿', 'life'],
  ['movie', '大银幕的两小时', 45, '🎬', '场', 'hobby'],
  ['book', '书架的新朋友', 59, '📚', '本', 'hobby'],
  ['game', '愿望单里的游戏', 98, '🎮', '款', 'hobby'],
  ['music', '音乐会员', 15, '🎧', '个月', 'hobby'],
  ['puzzle', '慢慢拼的拼图', 69, '🧩', '盒', 'hobby'],
  ['paint', '涂掉烦恼的颜料', 79, '🎨', '盒', 'hobby'],
  ['film', '记录生活的胶卷', 85, '📷', '卷', 'hobby'],
  ['concert', '放声唱的演出', 399, '🎤', '场', 'hobby'],
  ['picnic', '草地上的野餐', 88, '🧺', '次', 'travel'],
  ['escape', '周末逃离计划', 299, '🚐', '趟', 'travel'],
  ['train', '开往自由的高铁', 300, '🚄', '程', 'travel'],
  ['camp', '星空下的露营', 399, '⛺', '次', 'travel'],
  ['sea', '海边发呆', 899, '🏖️', '趟', 'travel'],
  ['mountain', '去山里吸氧', 1299, '🏔️', '趟', 'travel'],
  ['flight', '飞向新地方', 1999, '✈️', '程', 'travel'],
  ['journey', '认真攒的旅行', 5000, '🌏', '趟', 'travel'],
  ['massage', '肩颈放个假', 99, '💆', '次', 'self'],
  ['shoes', '走远一点的鞋', 499, '👟', '双', 'self'],
  ['headphones', '自己的小世界', 399, '🎧', '副', 'self'],
  ['cake', '不等生日的蛋糕', 28, '🍰', '块', 'self'],
];
export const BUILTIN_GOALS = Object.freeze(
  seed.map(([id, name, price, emoji, unit, category]) =>
    Object.freeze({ id, name, price, emoji, unit, category })
  )
);
const categoryIds = new Set(GOAL_CATEGORIES.map((item) => item.id));
const builtinIds = new Set(BUILTIN_GOALS.map((item) => item.id));
const unsafeText = /[<>\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/u;
const text = (value) => (typeof value === 'string' ? value.normalize('NFC').trim() : '');
const length = (value) => [...value].length;

export function validateGoal(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { goal: '目标信息不完整。' };
  const errors = {};
  for (const [key, title, max] of [
    ['name', '目标名称', 24],
    ['unit', '计量单位', 8],
    ['emoji', '目标图标', 12],
  ]) {
    const value = text(input[key]);
    if (!value || length(value) > max) errors[key] = `${title}请填写 1–${max} 个字。`;
    else if (unsafeText.test(value)) errors[key] = `${title}不能包含代码符号或控制字符。`;
  }
  if (
    typeof input.price !== 'number' ||
    !Number.isFinite(input.price) ||
    input.price < 0.01 ||
    input.price > 1_000_000_000
  )
    errors.price = '目标金额需为 0.01–1,000,000,000 元之间的数字。';
  if (!categoryIds.has(input.category)) errors.category = '请选择一个目标分类。';
  return errors;
}

export function normalizeGoal(input) {
  const errors = validateGoal(input);
  if (Object.keys(errors).length) throw new RangeError(Object.values(errors)[0]);
  return {
    name: text(input.name),
    price: Math.round(input.price * 100) / 100,
    emoji: text(input.emoji),
    unit: text(input.unit),
    category: input.category,
  };
}

export function initialGoalsState() {
  return { version: 1, selectedId: 'coffee', customGoals: [] };
}

function normalizeState(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) return initialGoalsState();
  const customGoals = [];
  const ids = new Set();
  for (const item of Array.isArray(value.customGoals)
    ? value.customGoals.slice(0, MAX_CUSTOM_GOALS)
    : []) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !/^custom-[a-zA-Z0-9_-]{1,80}$/.test(item.id) ||
      ids.has(item.id) ||
      Object.keys(validateGoal(item)).length
    )
      continue;
    customGoals.push({ id: item.id, ...normalizeGoal(item) });
    ids.add(item.id);
  }
  return {
    version: 1,
    customGoals,
    selectedId:
      builtinIds.has(value.selectedId) || ids.has(value.selectedId) ? value.selectedId : 'coffee',
  };
}

export function parseGoalsState(raw) {
  try {
    return normalizeState(typeof raw === 'string' ? JSON.parse(raw) : null);
  } catch {
    return initialGoalsState();
  }
}

export function readGoalsState(storage) {
  try {
    return parseGoalsState(storage.getItem(GOALS_STORAGE_KEY));
  } catch {
    return initialGoalsState();
  }
}

export function saveGoalsState(storage, state) {
  try {
    storage.setItem(GOALS_STORAGE_KEY, JSON.stringify(normalizeState(state)));
    return true;
  } catch {
    return false;
  }
}

export function getGoals(state) {
  const normalized = normalizeState(state);
  return [
    ...BUILTIN_GOALS.map((item) => ({ ...item, custom: false })),
    ...normalized.customGoals.map((item) => ({ ...item, custom: true })),
  ];
}

export function getSelectedGoal(state) {
  return (
    getGoals(state).find((item) => item.id === state?.selectedId) || {
      ...BUILTIN_GOALS.find((item) => item.id === 'coffee'),
      custom: false,
    }
  );
}

export function selectGoal(state, id) {
  const next = normalizeState(state);
  if (!getGoals(next).some((item) => item.id === id))
    throw new RangeError('这个目标已经不存在了。');
  return { ...next, selectedId: id };
}

export function addCustomGoal(
  state,
  input,
  id = `custom-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
) {
  const next = normalizeState(state);
  if (next.customGoals.length >= MAX_CUSTOM_GOALS)
    throw new RangeError(`最多保存 ${MAX_CUSTOM_GOALS} 个自定义目标。`);
  if (!/^custom-[a-zA-Z0-9_-]{1,80}$/.test(id) || next.customGoals.some((item) => item.id === id))
    throw new RangeError('目标编号无效或重复。');
  const goal = { id, ...normalizeGoal(input) };
  return { ...next, selectedId: id, customGoals: [...next.customGoals, goal] };
}

export function editCustomGoal(state, id, input) {
  const next = normalizeState(state);
  if (!next.customGoals.some((item) => item.id === id))
    throw new RangeError('只有自己的目标可以修改。');
  const goal = { id, ...normalizeGoal(input) };
  return { ...next, customGoals: next.customGoals.map((item) => (item.id === id ? goal : item)) };
}

export function deleteCustomGoal(state, id) {
  const next = normalizeState(state);
  if (!next.customGoals.some((item) => item.id === id))
    throw new RangeError('只有自己的目标可以删除。');
  return {
    ...next,
    selectedId: next.selectedId === id ? 'coffee' : next.selectedId,
    customGoals: next.customGoals.filter((item) => item.id !== id),
  };
}

export function goalProgress(goal, income = {}) {
  const earned =
    typeof income.earned === 'number' && Number.isFinite(income.earned)
      ? Math.max(0, income.earned)
      : 0;
  const remaining = Math.max(0, goal.price - earned);
  const rate =
    typeof income.perSecond === 'number' &&
    Number.isFinite(income.perSecond) &&
    income.perSecond > 0
      ? income.perSecond
      : 0;
  return {
    earned,
    remaining,
    quantity: Math.floor(earned / goal.price),
    progress: Math.min(1, earned / goal.price),
    secondsToGoal:
      remaining > 0 && income.status === 'working' && rate > 0 && Number.isFinite(remaining / rate)
        ? Math.ceil(remaining / rate)
        : null,
  };
}
