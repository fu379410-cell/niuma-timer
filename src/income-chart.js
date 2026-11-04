import './income-chart.css';
import { getIncomeTrend } from './lib/trend.mjs';

let chartSequence = 0;
const statusText = {
  working: '每一秒，都在入账',
  break: '午休暂停计薪',
  after: '已下班 · 今日收入封顶',
  before: '尚未开工 · 等待计薪',
  off: '休息日 · 今天不营业',
};
const cash = (value, digits = 2) =>
  Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
const clock = (time, seconds = false) =>
  new Date(time).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
  });
const bounded = (value, min, max) => Math.min(max, Math.max(min, value));

/** Mount once; call update once per second from the host clock. */
export function mountIncomeChart(container, { getSettings, getNow }) {
  if (!container || typeof getSettings !== 'function' || typeof getNow !== 'function') {
    throw new TypeError('Income chart needs a container, getSettings and getNow.');
  }
  const gradientId = `niuma-income-fill-${++chartSequence}`;
  const root = document.createElement('section');
  root.className = 'income-chart';
  root.setAttribute('aria-label', '今日已赚趋势');
  root.innerHTML = `<div class="income-chart-header">
    <div class="income-chart-heading"><span>收入在路上</span><span class="income-chart-live"><i></i> LIVE</span></div>
    <div class="income-chart-tabs" role="group" aria-label="选择收入趋势范围">
      <button type="button" data-income-mode="live" aria-pressed="true">实时 60 秒</button>
      <button type="button" data-income-mode="day" aria-pressed="false">今日累计</button>
    </div>
  </div>
  <div class="income-chart-summary"><div><span data-income-period>近 60 秒</span><strong class="cash-value" data-income-delta>+¥0.00</strong></div><span data-income-status></span></div>
  <div class="income-chart-visual">
    <div class="income-chart-scale"><span class="cash-value" data-income-top></span><span class="cash-value" data-income-bottom></span></div>
    <svg class="income-chart-svg" viewBox="0 0 600 126" preserveAspectRatio="none" role="img" tabindex="0" aria-label="实时收入曲线。左右方向键可查看采样点。">
      <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ddf9a0" stop-opacity=".22"/><stop offset="1" stop-color="#ddf9a0" stop-opacity="0"/></linearGradient></defs>
      <path class="income-chart-grid" d="M4 14H596 M4 62H596 M4 110H596"/>
      <path class="income-chart-area" fill="url(#${gradientId})"/>
      <path class="income-chart-glow"/>
      <path class="income-chart-line"/>
      <path class="income-chart-flow"/>
      <line class="income-chart-hover-line" y1="7" y2="116"/>
      <circle class="income-chart-halo" r="8"/>
      <circle class="income-chart-dot" r="3.5"/>
      <circle class="income-chart-hover-dot" r="3.5"/>
    </svg>
    <div class="income-chart-tooltip" role="status" aria-live="off"><time></time><strong class="cash-value"></strong></div>
  </div>
  <div class="income-chart-axis"><time data-income-start></time><span data-income-caption>真实计薪 · 每秒刷新</span><time data-income-end></time></div>`;
  container.append(root);
  const find = (selector) => root.querySelector(selector);
  const svg = find('.income-chart-svg');
  const visual = find('.income-chart-visual');
  const tooltip = find('.income-chart-tooltip');
  const abort = new AbortController();
  let mode = 'live',
    model,
    liveRange,
    pointerFraction = null,
    keyboardIndex = null,
    destroyed = false;

  const pointXY = (point) => {
    const range = model.yMax - model.yMin || 1;
    return [
      4 + bounded((point.time - model.startAt) / (model.endAt - model.startAt || 1), 0, 1) * 592,
      110 - bounded((point.earned - model.yMin) / range, 0, 1) * 96,
    ];
  };

  function clearInspection() {
    pointerFraction = null;
    keyboardIndex = null;
    root.classList.remove('income-chart-inspecting');
  }

  function inspect() {
    if (!model || (pointerFraction === null && keyboardIndex === null)) return;
    let index = keyboardIndex;
    if (pointerFraction !== null) {
      const wanted = model.startAt + pointerFraction * (model.endAt - model.startAt);
      index = model.points.reduce(
        (best, point, current) =>
          Math.abs(point.time - wanted) < Math.abs(model.points[best].time - wanted)
            ? current
            : best,
        0
      );
    }
    index = bounded(index, 0, model.points.length - 1);
    const point = model.points[index];
    const [x, y] = pointXY(point);
    const hoverLine = find('.income-chart-hover-line');
    hoverLine.setAttribute('x1', x);
    hoverLine.setAttribute('x2', x);
    const hoverDot = find('.income-chart-hover-dot');
    hoverDot.setAttribute('cx', x);
    hoverDot.setAttribute('cy', y);
    tooltip.querySelector('time').textContent = clock(point.time, mode === 'live');
    tooltip.querySelector('strong').textContent = `¥${cash(point.earned, mode === 'live' ? 4 : 2)}`;
    tooltip.style.left = `${bounded((x / 600) * 100, 17, 83)}%`;
    tooltip.style.top = `${Math.max(0, (y / 126) * 100 - 48)}%`;
    root.classList.add('income-chart-inspecting');
  }

  function update() {
    if (destroyed) return;
    model = getIncomeTrend(getSettings(), getNow(), { mode, liveRange });
    liveRange = model.liveRange;
    root.dataset.status = model.status;
    root.dataset.mode = mode;
    find('[data-income-period]').textContent = mode === 'live' ? '近 60 秒' : '今日累计';
    find('[data-income-delta]').textContent =
      `${mode === 'live' ? '+' : ''}¥${cash(mode === 'live' ? model.delta : model.latestEarned)}`;
    find('[data-income-status]').textContent = statusText[model.status];
    const axisDigits =
      model.yTick && model.yTick < 0.01
        ? Math.min(6, Math.max(2, Math.ceil(-Math.log10(model.yTick))))
        : 2;
    find('[data-income-top]').textContent = `¥${cash(model.yMax, axisDigits)}`;
    find('[data-income-bottom]').textContent = `¥${cash(model.yMin, axisDigits)}`;
    find('[data-income-start]').textContent = clock(model.startAt, mode === 'live');
    find('[data-income-end]').textContent = clock(model.endAt, mode === 'live');
    find('[data-income-caption]').textContent =
      mode === 'live' ? '真实计薪 · 每秒刷新' : '午休不计薪 · 未含未来收入';
    const path = model.points
      .map((point, index) => {
        const [x, y] = pointXY(point);
        return `${index ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`;
      })
      .join(' ');
    const [firstX] = pointXY(model.points[0]);
    const [lastX, lastY] = pointXY(model.points.at(-1));
    find('.income-chart-area').setAttribute('d', `${path} L${lastX},120 L${firstX},120Z`);
    for (const selector of ['.income-chart-line', '.income-chart-glow', '.income-chart-flow']) {
      find(selector).setAttribute('d', path);
    }
    for (const selector of ['.income-chart-dot', '.income-chart-halo']) {
      find(selector).setAttribute('cx', lastX);
      find(selector).setAttribute('cy', lastY);
    }
    svg.setAttribute(
      'aria-label',
      `${mode === 'live' ? '实时六十秒' : '今日累计'}收入曲线，最新 ¥${cash(model.latestEarned)}，${statusText[model.status]}。左右方向键查看采样点。`
    );
    inspect();
  }

  root.querySelectorAll('[data-income-mode]').forEach((button) => {
    button.addEventListener(
      'click',
      () => {
        mode = button.dataset.incomeMode;
        liveRange = null;
        clearInspection();
        root
          .querySelectorAll('[data-income-mode]')
          .forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
        update();
      },
      { signal: abort.signal }
    );
  });
  const onPointer = (event) => {
    const rect = svg.getBoundingClientRect();
    pointerFraction = bounded((event.clientX - rect.left) / rect.width, 0, 1);
    keyboardIndex = null;
    inspect();
  };
  visual.addEventListener('pointermove', onPointer, { signal: abort.signal });
  visual.addEventListener('pointerdown', onPointer, { signal: abort.signal });
  visual.addEventListener('pointerleave', clearInspection, { signal: abort.signal });
  svg.addEventListener('blur', clearInspection, { signal: abort.signal });
  svg.addEventListener(
    'keydown',
    (event) => {
      if (!model) return;
      const max = model.points.length - 1;
      if (event.key === 'Escape') clearInspection();
      else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        pointerFraction = null;
        const current = keyboardIndex ?? max;
        keyboardIndex =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? max
              : bounded(current + (event.key === 'ArrowRight' ? 1 : -1), 0, max);
        inspect();
      }
    },
    { signal: abort.signal }
  );
  update();
  return {
    update,
    destroy() {
      destroyed = true;
      abort.abort();
      root.remove();
    },
  };
}
