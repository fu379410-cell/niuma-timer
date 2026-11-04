import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOALS_STORAGE_KEY,
  GOAL_CATEGORIES,
  BUILTIN_GOALS,
  MAX_CUSTOM_GOALS,
  initialGoalsState,
  validateGoal,
  normalizeGoal,
  parseGoalsState,
  readGoalsState,
  saveGoalsState,
  getGoals,
  getSelectedGoal,
  selectGoal,
  addCustomGoal,
  editCustomGoal,
  deleteCustomGoal,
  goalProgress,
} from './goals.mjs';

const example = { name: '下班去海边', price: 199.99, emoji: '🏝️', unit: '趟', category: 'travel' };
function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test('builtins offer varied valid goals with stable unique IDs and useful units', () => {
  assert.ok(BUILTIN_GOALS.length >= 24);
  assert.equal(new Set(BUILTIN_GOALS.map((goal) => goal.id)).size, BUILTIN_GOALS.length);
  assert.ok(new Set(BUILTIN_GOALS.map((goal) => goal.unit)).size >= 8);
  for (const goal of BUILTIN_GOALS) assert.deepEqual(validateGoal(goal), {});
  for (const category of GOAL_CATEGORIES)
    assert.ok(BUILTIN_GOALS.some((goal) => goal.category === category.id));
});

test('price validation rejects zero, negative, nonnumeric, nonfinite and unusable bounds', () => {
  for (const price of [
    0,
    -1,
    NaN,
    Infinity,
    -Infinity,
    '25',
    null,
    undefined,
    0.001,
    1_000_000_001,
  ])
    assert.ok(validateGoal({ ...example, price }).price);
  assert.deepEqual(validateGoal({ ...example, price: 0.01 }), {});
  assert.equal(normalizeGoal({ ...example, price: 10.129 }).price, 10.13);
});

test('text validation bounds name/unit/icon and forbids markup and invisible controls', () => {
  for (const name of ['', '  ', '牛'.repeat(25), '<img src=x onerror=alert(1)>', '目标\u202E名字'])
    assert.ok(validateGoal({ ...example, name }).name);
  for (const unit of ['', '杯'.repeat(9), '<b>', '份\n次'])
    assert.ok(validateGoal({ ...example, unit }).unit);
  for (const emoji of ['', '<svg>', '\u0000', 'x'.repeat(13)])
    assert.ok(validateGoal({ ...example, emoji }).emoji);
  assert.ok(validateGoal({ ...example, category: '<script>' }).category);
  assert.deepEqual(
    validateGoal({ ...example, name: 'Jack & Jill 的快乐', unit: '趟', emoji: '✨' }),
    {}
  );
  assert.equal(normalizeGoal({ ...example, name: '  我的海边  ' }).name, '我的海边');
  assert.throws(() => normalizeGoal({ ...example, unit: '<script>' }), RangeError);
});

test('corrupt, empty or unknown-version storage safely restores default selection', () => {
  for (const raw of [
    null,
    undefined,
    '',
    '{oops',
    'null',
    '[]',
    '42',
    '{"version":2,"selectedId":"soda"}',
  ])
    assert.deepEqual(parseGoalsState(raw), initialGoalsState());
  const storage = memoryStorage();
  storage.setItem(GOALS_STORAGE_KEY, '{broken');
  assert.deepEqual(readGoalsState(storage), initialGoalsState());
});

test('stored invalid/duplicate IDs and unsafe goal text are dropped; unknown selection falls back', () => {
  const raw = JSON.stringify({
    version: 1,
    selectedId: 'custom-malicious',
    customGoals: [
      { id: 'custom-ok', ...example },
      { id: 'custom-ok', ...example, name: '重复的编号' },
      { id: 'coffee', ...example },
      { id: 'custom-malicious', ...example, name: '<svg onload=x>' },
      { id: 'custom-nan', ...example, price: 'NaN' },
      null,
    ],
  });
  const state = parseGoalsState(raw);
  assert.equal(state.customGoals.length, 1);
  assert.equal(state.customGoals[0].id, 'custom-ok');
  assert.equal(state.selectedId, 'coffee');
});

test('add, edit, choose and delete preserve other goals and never mutate source state', () => {
  const source = initialGoalsState();
  const snapshot = JSON.stringify(source);
  const added = addCustomGoal(source, example, 'custom-holiday');
  assert.equal(JSON.stringify(source), snapshot);
  assert.equal(added.selectedId, 'custom-holiday');
  assert.equal(getSelectedGoal(added).name, example.name);
  assert.equal(getSelectedGoal(added).custom, true);
  const changed = editCustomGoal(added, 'custom-holiday', {
    ...example,
    name: '去看雪',
    emoji: '❄️',
    price: 999,
    unit: '趟',
  });
  assert.equal(getSelectedGoal(changed).price, 999);
  assert.equal(getSelectedGoal(added).price, 199.99);
  const selectedBuiltin = selectGoal(changed, 'soda');
  const deleted = deleteCustomGoal(selectedBuiltin, 'custom-holiday');
  assert.equal(deleted.selectedId, 'soda');
  assert.equal(deleted.customGoals.length, 0);
  assert.equal(deleteCustomGoal(changed, 'custom-holiday').selectedId, 'coffee');
});

test('builtin goals cannot be overwritten or deleted; nonexistent and duplicate custom IDs fail', () => {
  const state = addCustomGoal(initialGoalsState(), example, 'custom-one');
  assert.throws(() => editCustomGoal(state, 'coffee', example), RangeError);
  assert.throws(() => deleteCustomGoal(state, 'coffee'), RangeError);
  assert.throws(() => selectGoal(state, 'does-not-exist'), RangeError);
  assert.throws(() => addCustomGoal(state, example, 'custom-one'), RangeError);
  assert.throws(() => addCustomGoal(state, example, 'coffee'), RangeError);
  assert.throws(() => addCustomGoal(state, { ...example, price: 0 }), RangeError);
  const copy = getGoals(state);
  copy[0].name = '本地修改';
  assert.notEqual(getGoals(state)[0].name, '本地修改');
});

test('selected custom goals and edits survive a storage round trip', () => {
  const storage = memoryStorage();
  const state = addCustomGoal(initialGoalsState(), example, 'custom-trip');
  assert.equal(saveGoalsState(storage, state), true);
  assert.deepEqual(readGoalsState(storage), state);
  const edited = editCustomGoal(readGoalsState(storage), 'custom-trip', {
    ...example,
    price: 388.88,
  });
  assert.equal(saveGoalsState(storage, edited), true);
  assert.equal(getSelectedGoal(readGoalsState(storage)).price, 388.88);
});

test('unavailable or quota-limited storage does not crash callers', () => {
  const forbidden = {
    getItem() {
      throw new Error('blocked');
    },
    setItem() {
      throw new Error('quota');
    },
  };
  assert.deepEqual(readGoalsState(forbidden), initialGoalsState());
  assert.deepEqual(readGoalsState(undefined), initialGoalsState());
  assert.equal(saveGoalsState(forbidden, initialGoalsState()), false);
  assert.equal(saveGoalsState(undefined, initialGoalsState()), false);
});

test('import limits excessive entries and prevents adding beyond the custom-goal limit', () => {
  const customGoals = Array.from({ length: MAX_CUSTOM_GOALS + 5 }, (_, index) => ({
    ...example,
    id: `custom-${index}`,
  }));
  const state = parseGoalsState(JSON.stringify({ version: 1, selectedId: 'coffee', customGoals }));
  assert.equal(state.customGoals.length, MAX_CUSTOM_GOALS);
  assert.throws(() => addCustomGoal(state, example, 'custom-extra'), RangeError);
});

test('progress uses the goal unit and price, caps the first-goal bar, and computes whole purchase count', () => {
  const goal = { ...example, price: 25, unit: '本' };
  assert.deepEqual(goalProgress(goal, { earned: 12.5, perSecond: 0.1, status: 'working' }), {
    earned: 12.5,
    remaining: 12.5,
    quantity: 0,
    progress: 0.5,
    secondsToGoal: 125,
  });
  assert.deepEqual(goalProgress(goal, { earned: 76, perSecond: 0.1, status: 'working' }), {
    earned: 76,
    remaining: 0,
    quantity: 3,
    progress: 1,
    secondsToGoal: null,
  });
});

test('time estimates appear only while earning, and bad income data stays finite', () => {
  const goal = { ...example, price: 25 };
  for (const status of ['before', 'after', 'off', 'break'])
    assert.equal(goalProgress(goal, { earned: 5, perSecond: 0.1, status }).secondsToGoal, null);
  for (const perSecond of [0, -1, NaN, Infinity])
    assert.equal(
      goalProgress(goal, { earned: 5, perSecond, status: 'working' }).secondsToGoal,
      null
    );
  for (const earned of [NaN, Infinity, -1, '99']) {
    const progress = goalProgress(goal, { earned, perSecond: 0, status: 'working' });
    assert.equal(progress.earned, 0);
    assert.equal(progress.quantity, 0);
    assert.equal(progress.progress, 0);
    assert.equal(progress.remaining, 25);
  }
});
