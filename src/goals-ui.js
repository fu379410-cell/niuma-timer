import './goals.css';
import {
  GOALS_STORAGE_KEY,
  GOAL_CATEGORIES,
  BUILTIN_GOALS,
  readGoalsState,
  saveGoalsState,
  getGoals,
  getSelectedGoal,
  selectGoal,
  addCustomGoal,
  editCustomGoal,
  deleteCustomGoal,
  validateGoal,
  goalProgress,
} from './lib/goals.mjs';

const formatMoney = (value) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(className, text, handler) {
  const el = node('button', className, text);
  el.type = 'button';
  if (handler) el.addEventListener('click', handler);
  return el;
}
function duration(seconds) {
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} 分钟`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)} 小时 ${Math.ceil((seconds % 3600) / 60)} 分钟`;
  return `${(seconds / 3600).toFixed(1)} 小时`;
}

/** Each mount owns its DOM/listeners; destroy before replacing its container. */
export function mountGoals(container, { getIncome, onChange, mini = false } = {}) {
  if (!(container instanceof Element)) throw new TypeError('mountGoals requires a DOM container.');
  let storage;
  try {
    storage = window.localStorage;
  } catch {}
  let state = readGoalsState(storage);
  let category = 'all',
    expanded = false,
    paused = false,
    destroyed = false;
  let nextRotation = Date.now() + 8000,
    editingId = null;
  const root = node('section', `goals-panel${mini ? ' goals-mini' : ''}`);
  root.setAttribute('aria-label', '快乐兑兑所：我的快乐目标');
  // Static markup only. All goal text is assigned through textContent/value below.
  root.innerHTML = `<div class="goals-heading"><div><div class="goals-eyebrow">HAPPINESS EXCHANGE</div><h2 class="goals-title">快乐兑兑所<span class="goals-title-star">✳</span></h2><p class="goals-subtitle">把窝囊费，换成喜欢的生活。</p></div><div class="goals-heading-actions"></div></div><div class="goals-stage"><div class="goals-art"><span class="goals-art-spark">✧</span><div class="goals-emoji" aria-hidden="true"></div><span class="goals-art-caption">FOR YOUR OWN JOY</span></div><div class="goals-current"><div class="goals-current-meta"><span class="goals-category-label"></span><span class="goals-custom-tag" hidden>自己定的快乐</span></div><h3 class="goals-current-name"></h3><p class="goals-quantity"></p><p class="goals-motivation"></p><div class="goals-progress-head"><span class="goals-progress-label"></span><span class="goals-percent"></span></div><div class="goals-progress" role="progressbar" aria-label="当前快乐目标进度" aria-valuemin="0" aria-valuemax="100"><div class="goals-progress-fill"></div></div><div class="goals-timing"></div></div><div class="goals-price-side"><span class="goals-price-label">一份快乐的价格</span><strong class="goals-price"></strong><span class="goals-price-unit"></span><div class="goals-selected-actions"></div></div></div><div class="goals-toolbar"><div class="goals-carousel-controls"></div><span class="goals-carousel-note"></span><button type="button" class="goals-library-toggle" aria-expanded="false">打开目标库 ↗</button></div><div class="goals-library" hidden><div class="goals-filters" role="group" aria-label="目标分类"></div><div class="goals-library-count"></div><div class="goals-library-grid"></div><p class="goals-library-note">内置金额只是小目标示例。你的快乐，你来定价。</p></div><div class="goals-feedback" role="status" aria-live="polite"></div>`;
  container.replaceChildren(root);
  const q = (selector) => root.querySelector(selector);
  const add = button('goals-add-button', '＋ 自定义快乐', () => openEditor());
  q('.goals-heading-actions').append(add);
  const previous = button('goals-arrow', '←', () => rotate(-1, true));
  previous.setAttribute('aria-label', '上一个快乐目标');
  const pause = button('goals-pause', 'Ⅱ 暂停轮播', () => {
    paused = !paused;
    nextRotation = Date.now() + 8000;
    renderControls();
  });
  pause.setAttribute('aria-pressed', 'false');
  const next = button('goals-arrow', '→', () => rotate(1, true));
  next.setAttribute('aria-label', '下一个快乐目标');
  q('.goals-carousel-controls').append(previous, pause, next);
  const libraryToggle = q('.goals-library-toggle');
  libraryToggle.addEventListener('click', () => {
    expanded = !expanded;
    q('.goals-library').hidden = !expanded;
    libraryToggle.setAttribute('aria-expanded', String(expanded));
    libraryToggle.textContent = expanded ? '收起目标库 ↑' : '打开目标库 ↗';
    nextRotation = Date.now() + 24000;
    renderControls();
  });

  const dialog = node('dialog', 'goals-dialog');
  dialog.setAttribute('aria-label', '自定义快乐目标');
  dialog.innerHTML = `<form class="goals-form" novalidate><div class="goals-dialog-heading"><div><span class="goals-eyebrow">YOUR JOY, YOUR RULES.</span><h2 class="goals-dialog-title">给快乐起个名字。</h2></div><button type="button" class="goals-dialog-close" aria-label="关闭目标编辑">×</button></div><div class="goals-form-body"><label class="goals-field">目标名称<input class="goals-input" name="name" placeholder="比如：去海边躺三天" maxlength="48" autocomplete="off" required></label><div class="goals-fields-row"><label class="goals-field">金额 / 元<input class="goals-input" name="price" type="number" min="0.01" max="1000000000" step="0.01" inputmode="decimal" placeholder="199" required></label><label class="goals-field">计量单位<input class="goals-input" name="unit" placeholder="趟 / 杯 / 本 / 双" maxlength="16" autocomplete="off" required></label></div><div class="goals-fields-row"><label class="goals-field">图标 Emoji<input class="goals-input goals-emoji-input" name="emoji" placeholder="✨" maxlength="24" autocomplete="off" required></label><label class="goals-field">放进哪个分类<select class="goals-input" name="category"></select></label></div><div class="goals-emoji-picker" role="group" aria-label="快速选择图标"></div><p class="goals-form-error" role="alert"></p><p class="goals-form-note">只保存在本机，和工资配置分开保存。<br>添加后就会成为当前目标，随时可以编辑或删除。</p></div><div class="goals-dialog-footer"><button type="button" class="goals-delete-button" hidden>删除这个目标</button><button type="submit" class="goals-save-button">就为这个，继续发财 ↗</button></div></form>`;
  root.append(dialog);
  const form = dialog.querySelector('form');
  const field = (name) => form.elements.namedItem(name);
  for (const cat of GOAL_CATEGORIES) {
    const option = node('option', '', `${cat.emoji} ${cat.name}`);
    option.value = cat.id;
    field('category').append(option);
  }
  for (const emoji of ['✨', '🧋', '🍜', '🎮', '📚', '🎧', '👟', '🪴', '🐈', '🚄', '🏝️', '🌙']) {
    const choice = button('goals-emoji-choice', emoji, () => {
      field('emoji').value = emoji;
    });
    choice.setAttribute('aria-label', `选择图标 ${emoji}`);
    dialog.querySelector('.goals-emoji-picker').append(choice);
  }
  dialog.querySelector('.goals-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    nextRotation = Date.now() + 24000;
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = {
      name: field('name').value,
      price: Number(field('price').value),
      unit: field('unit').value,
      emoji: field('emoji').value,
      category: field('category').value,
    };
    const errors = validateGoal(input);
    if (Object.keys(errors).length) {
      dialog.querySelector('.goals-form-error').textContent = Object.values(errors)[0];
      field(Object.keys(errors)[0])?.focus();
      return;
    }
    try {
      const nextState = editingId
        ? editCustomGoal(state, editingId, input)
        : addCustomGoal(state, input);
      commit(nextState, editingId ? 'edit' : 'add');
      category = 'custom';
      renderLibrary();
      dialog.close();
    } catch (error) {
      dialog.querySelector('.goals-form-error').textContent = error.message;
    }
  });
  dialog.querySelector('.goals-delete-button').addEventListener('click', () => {
    if (!editingId) return;
    try {
      commit(deleteCustomGoal(state, editingId), 'delete');
      dialog.close();
    } catch (error) {
      dialog.querySelector('.goals-form-error').textContent = error.message;
    }
  });

  function announce(message) {
    q('.goals-feedback').textContent = message;
  }
  function notify(reason) {
    if (typeof onChange === 'function') onChange(getSelectedGoal(state), { reason });
  }
  function commit(nextState, reason) {
    state = nextState;
    const stored = saveGoalsState(storage, state);
    nextRotation = Date.now() + (reason === 'rotate' ? 8000 : 24000);
    renderSelected();
    renderLibrary();
    renderControls();
    if (!stored) announce('目标暂存在本次打开中，本机存储目前不可用。');
    else if (reason === 'add') announce('新的快乐目标已加入。生活又有了一个盼头。');
    else if (reason === 'edit') announce('目标已更新，按自己的节奏来。');
    else if (reason === 'delete') announce('目标已删除，再选一个喜欢的吧。');
    else if (reason === 'select') announce('就朝这个快乐前进。');
    else announce('');
    notify(reason);
  }
  function filteredGoals() {
    return getGoals(state).filter(
      (goal) =>
        category === 'all' || (category === 'custom' ? goal.custom : goal.category === category)
    );
  }
  function choose(id) {
    commit(selectGoal(state, id), 'select');
  }
  function rotate(direction, user = false) {
    const goals = filteredGoals();
    if (!goals.length || (goals.length === 1 && goals[0].id === state.selectedId)) {
      nextRotation = Date.now() + 8000;
      return;
    }
    const index = goals.findIndex((goal) => goal.id === state.selectedId);
    const start = index < 0 ? (direction > 0 ? -1 : 0) : index;
    const target = goals[(start + direction + goals.length) % goals.length];
    commit(selectGoal(state, target.id), user ? 'select' : 'rotate');
  }
  function renderControls() {
    pause.textContent = paused ? '▷ 继续轮播' : 'Ⅱ 暂停轮播';
    pause.setAttribute('aria-pressed', String(paused));
    q('.goals-carousel-note').textContent = paused
      ? '快乐停在这一刻'
      : expanded
        ? '慢慢挑，轮播等你选好再继续'
        : Date.now() + 9000 < nextRotation
          ? '已选定 · 多停留一会儿'
          : '每 8 秒，换一个生活的盼头';
  }
  function renderSelected() {
    const goal = getSelectedGoal(state);
    q('.goals-emoji').textContent = goal.emoji;
    q('.goals-current-name').textContent = goal.name;
    q('.goals-category-label').textContent =
      GOAL_CATEGORIES.find((cat) => cat.id === goal.category)?.name || '我的快乐';
    q('.goals-custom-tag').hidden = !goal.custom;
    q('.goals-price').textContent = `¥${formatMoney(goal.price)}`;
    q('.goals-price-unit').textContent = `/ ${goal.unit}`;
    const actions = q('.goals-selected-actions');
    actions.replaceChildren(
      button('goals-edit-link', goal.custom ? '编辑目标 ↗' : '换个价格 ↗', () => openEditor(goal))
    );
    update();
  }
  function renderLibrary() {
    const filters = q('.goals-filters');
    filters.replaceChildren();
    for (const cat of [
      { id: 'all', name: '全部快乐' },
      ...GOAL_CATEGORIES,
      { id: 'custom', name: '我的目标' },
    ]) {
      const chip = button(
        `goals-chip${category === cat.id ? ' goals-chip-active' : ''}`,
        cat.name,
        () => {
          category = cat.id;
          nextRotation = Date.now() + 24000;
          renderLibrary();
          renderControls();
        }
      );
      chip.setAttribute('aria-pressed', String(category === cat.id));
      filters.append(chip);
    }
    const goals = filteredGoals();
    q('.goals-library-count').textContent =
      `${goals.length} 个生活盼头 · ${BUILTIN_GOALS.length} 个内置目标 + ${state.customGoals.length} 个自己定的快乐`;
    const grid = q('.goals-library-grid');
    grid.replaceChildren();
    for (const goal of goals) {
      const wrap = node(
        'div',
        `goals-choice${goal.id === state.selectedId ? ' goals-choice-selected' : ''}`
      );
      const select = button('goals-choice-select', undefined, () => choose(goal.id));
      select.setAttribute('aria-pressed', String(goal.id === state.selectedId));
      select.setAttribute(
        'aria-label',
        `${goal.name}，${formatMoney(goal.price)}元每${goal.unit}${goal.id === state.selectedId ? '，当前目标' : ''}`
      );
      const copy = node('span', 'goals-choice-copy');
      copy.append(
        node('strong', 'goals-choice-name', goal.name),
        node('small', 'goals-choice-price', `¥${formatMoney(goal.price)} / ${goal.unit}`)
      );
      select.append(
        node('span', 'goals-choice-emoji', goal.emoji),
        copy,
        node('span', 'goals-choice-check', goal.id === state.selectedId ? '✓' : '↗')
      );
      wrap.append(select);
      if (goal.custom) {
        const edit = button('goals-choice-edit', '编辑', () => openEditor(goal));
        edit.setAttribute('aria-label', `编辑${goal.name}`);
        wrap.append(edit);
      }
      grid.append(wrap);
    }
    if (!goals.length) {
      const empty = node('div', 'goals-empty');
      empty.append(
        node('p', '', '还没有自己的快乐目标。先给生活加一个小盼头。'),
        button('goals-add-button', '＋ 添加第一个', () => openEditor())
      );
      grid.append(empty);
    }
  }
  function openEditor(goal) {
    nextRotation = Date.now() + 24000;
    editingId = goal?.custom ? goal.id : null;
    field('name').value = goal?.name || '';
    field('price').value = goal?.price ?? '';
    field('unit').value = goal?.unit || '份';
    field('emoji').value = goal?.emoji || '✨';
    field('category').value =
      goal?.category || (GOAL_CATEGORIES.some((cat) => cat.id === category) ? category : 'food');
    dialog.querySelector('.goals-form-error').textContent = '';
    dialog.querySelector('.goals-dialog-title').textContent = editingId
      ? '快乐计划，随时可改。'
      : goal
        ? '快乐可以自己定价。'
        : '给快乐起个名字。';
    dialog.querySelector('.goals-delete-button').hidden = !editingId;
    dialog.showModal();
    field('name').focus();
  }
  function update() {
    if (destroyed) return;
    let income = {};
    try {
      income = typeof getIncome === 'function' ? getIncome() || {} : {};
    } catch {}
    const goal = getSelectedGoal(state);
    const progress = goalProgress(goal, income);
    q('.goals-quantity').textContent =
      progress.quantity > 0
        ? `今天的你，已赚到 ${formatMoney(progress.quantity)} ${goal.unit}${goal.name}。`
        : `先攒下第一${goal.unit}，快乐慢慢来。`;
    q('.goals-motivation').textContent =
      progress.quantity > 0
        ? '每一分认真生活，都有一份具体的回报。'
        : '赚钱的意义，是让喜欢的事离自己近一点。';
    q('.goals-progress-label').textContent =
      progress.remaining === 0 ? '第一份快乐已到账 ✓' : `还差 ¥${formatMoney(progress.remaining)}`;
    q('.goals-percent').textContent = `${Math.floor(progress.progress * 100)}%`;
    q('.goals-progress-fill').style.width = `${progress.progress * 100}%`;
    q('.goals-progress').setAttribute('aria-valuenow', String(Math.floor(progress.progress * 100)));
    q('.goals-timing').textContent =
      progress.remaining === 0
        ? '给今天的自己，一点小小的奖励。'
        : progress.secondsToGoal !== null
          ? `还需约 ${duration(progress.secondsToGoal)} 有效计薪时间。`
          : income.status === 'break'
            ? '休息时先充电，开工后继续攒快乐。'
            : '开工计薪后，这里会显示还需多少有效计薪时间。';
  }
  function storageChanged(event) {
    if (event.key !== GOALS_STORAGE_KEY && event.key !== null) return;
    if (dialog.open) dialog.close();
    state = readGoalsState(storage);
    nextRotation = Date.now() + 24000;
    renderSelected();
    renderLibrary();
    renderControls();
    announce('目标已与另一个窗口同步。');
    notify('storage');
  }
  window.addEventListener('storage', storageChanged);
  const timer = setInterval(() => {
    if (destroyed || document.hidden) return;
    if (!paused && !expanded && !dialog.open && Date.now() >= nextRotation) rotate(1);
    update();
    renderControls();
  }, 1000);
  renderSelected();
  renderLibrary();
  renderControls();
  return {
    update,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(timer);
      window.removeEventListener('storage', storageChanged);
      if (dialog.open) dialog.close();
      root.remove();
    },
  };
}
