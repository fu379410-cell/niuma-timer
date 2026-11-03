import './style.css';
import packageInfo from '../package.json';
import {
  defaultSettings,
  validateSettings,
  getDaySummary,
  getMonthSummary,
  getMonthDetails,
  getWeekSummary,
  formatDuration,
} from './lib/salary.mjs';

const paths = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  wallet: 'M3 7V5a2 2 0 0 1 2-2h14v4 M3 7h17a1 1 0 0 1 1 1v12H5a2 2 0 0 1-2-2V7Z M16 12h5v5h-5z',
  settings:
    'm12 3 2 3 3-.5.5 3 3 2-3 2-.5 3-3-.5-2 3-2-3-3 .5-.5-3-3-2 3-2 .5-3 3 .5Z M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  clock: 'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  coffee:
    'M3 8h13v7a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Z M16 8h2a3 3 0 0 1 0 6h-2 M6 2v3 M10 1v4 M14 2v3',
  coins:
    'M20 6c0 2-4 3-8 3S4 8 4 6s4-3 8-3 8 1 8 3Z M4 6v5c0 2 4 3 8 3s8-1 8-3V6 M4 11v5c0 2 4 3 8 3s8-1 8-3v-5',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  bolt: 'm13 2-9 12h7l-1 8 10-12h-7l1-8Z',
  chart: 'M4 20V13 M10 20V4 M16 20V9 M22 20V2',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  mini: 'M3 3h18v18H3z M12 12h9v9h-9z',
  close: 'm6 6 12 12 M18 6 6 18',
  check: 'm5 12 4 4L19 6',
  download: 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  info: 'M12 11v6 M12 7h.01 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  pin: 'm8 3 8 0-1 7 4 4H5l4-4-1-7Z M12 14v8',
  code: 'm8 6-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18',
};
const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.clock}"/></svg>`;
const cow = `<svg viewBox="0 0 64 64" class="cow-logo" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m20 23-5-10 12 6m17 4 5-10-12 6M18 30c-6 0-7-7-5-9l10 4m23 5c6 0 7-7 5-9l-10 4M21 23c5-7 17-7 22 0l4 20c0 8-30 8-30 0Z M24 32h3m10 0h3m-13 9h1m8 0h1"/></svg>`;
const app = document.querySelector('#app');
const storageKey = 'niuma.settings.v1';
function readSettings() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey));
    return value && !Object.keys(validateSettings(value)).length
      ? { ...defaultSettings, ...value }
      : structuredClone(defaultSettings);
  } catch {
    return structuredClone(defaultSettings);
  }
}
let settings = readSettings(),
  view = 'today',
  demo = new URLSearchParams(location.search).has('demo');
const mini = new URLSearchParams(location.search).has('mini');
let hidden = false,
  pinned = mini,
  quoteIndex = 0,
  toastTimeout,
  lastDay = '',
  selectedGoal = 0;
let demoBase, openedAt;
function resetDemoClock() {
  demoBase = new Date();
  for (let i = 0; i < 7 && !settings.workDays.includes(demoBase.getDay()); i++)
    demoBase.setDate(demoBase.getDate() - 1);
  const [h, m] = settings.startTime.split(':').map(Number);
  demoBase.setHours(h, m, 0, 0);
  const summary = getDaySummary(settings, demoBase);
  demoBase = new Date(+summary.startAt + (summary.endAt - summary.startAt) * 0.63);
  if (getDaySummary(settings, demoBase).status === 'break')
    demoBase = new Date(+summary.startAt + (summary.endAt - summary.startAt) * 0.82);
  openedAt = Date.now();
}
resetDemoClock();
const now = () => (demo ? new Date(+demoBase + Date.now() - openedAt) : new Date());
const money = (n) =>
  Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateText = (d) =>
  d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
const cash = (id, value, extra = '') =>
  `<span id="${id}" class="cash-value ${extra}">${value}</span>`;
const quotes = [
  '每一秒，都没有白忍。',
  '可以累，但不能白累。',
  '你负责呼吸，时间负责打钱。',
  '上班是副业，养活自己才是主业。',
  '保持呼吸，持续入账。',
];
const statusCopy = {
  working: ['正在搬砖', '距离下班还有', '再忍一下，即将恢复人形。'],
  before: ['尚未开工', '距离上班还有', '先把自己照顾好，再去征服工位。'],
  break: ['午休回血', '距离下班还有', '电量正在恢复，灵魂暂时离线。'],
  after: ['已下班 · 恢复人形', '今日搬砖已结束', '今日任务完成，生活现在开始。'],
  off: ['今天不营业', '休息日，理直气壮', '牛马也有草原，今天属于自己。'],
};
const goals = [
  { name: '快乐水', price: 6, emoji: '🥤' },
  { name: '续命咖啡', price: 25, emoji: '☕' },
  { name: '下班大餐', price: 68, emoji: '🍜' },
];
function toast(text) {
  document.querySelector('#toast').textContent = text;
  document.querySelector('#toast').classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(
    () => document.querySelector('#toast').classList.remove('visible'),
    3000
  );
}
function shell() {
  let saved = false;
  try {
    saved = !!localStorage.getItem(storageKey);
  } catch {}
  app.innerHTML = `<div class="ambient ambient-lime"></div><div class="ambient ambient-purple"></div><div class="ambient ambient-peach"></div>
 ${mini ? '' : `<aside class="sidebar glass"><a class="brand" href="#" aria-label="牛马计时器首页">${cow}<div><strong>NIUMA<span>®</span></strong><small>TIME TO GET PAID</small></div></a><div class="brand-cn">牛 马 计 时 器</div><nav aria-label="主要导航"><button data-nav="today" aria-label="今日搬砖" class="${view === 'today' ? 'active' : ''}">${icon('grid')}<span>今日搬砖</span><span class="nav-dot"></span></button><button data-nav="ledger" aria-label="牛马账本" class="${view === 'ledger' ? 'active' : ''}">${icon('wallet')}<span>牛马账本</span></button><button data-action="settings" aria-label="打工配置">${icon('settings')}<span>打工配置</span></button></nav><div class="sidebar-note"><span class="tiny-star">✳</span><p>上班可以，<br>上头不行。</p><small>YOU ARE MORE<br>THAN YOUR JOB.</small></div><a class="open-source" href="https://github.com/fu379410-cell/niuma-timer" target="_blank" rel="noreferrer">${icon('code')} 开源 · 牛马自由</a><div class="sidebar-version">LOCAL FIRST <span>v${packageInfo.version}</span></div></aside>`}
 <main class="${mini ? 'mini-main' : 'main'}"><header class="topbar"><div class="status"><i></i><span id="status-text"></span></div><span class="top-date" id="top-date"></span><time id="live-clock"></time><div class="top-actions">${demo ? '<button class="demo-badge" data-action="demo">演示模式 · 退出</button>' : '<span class="local-badge">本机计算 · 安心发财</span>'}<button class="icon-button privacy-button" data-action="privacy" title="隐藏或显示金额" aria-label="隐藏金额" aria-pressed="false">${icon('eye')}</button><button class="icon-button" data-action="${mini ? 'pin' : 'mini'}" title="${mini ? '窗口置顶' : '迷你悬浮窗'}" aria-label="${mini ? '窗口置顶' : '打开迷你悬浮窗'}">${icon(mini ? 'pin' : 'mini')}</button></div></header>
 ${mini ? miniContent() : view === 'ledger' ? ledgerContent() : todayContent()}
 ${mini ? '' : `<footer><span><i></i> 工资在涨，别让快乐掉线。</span><button data-action="method">计算口径 ${icon('info')}</button><span>MADE FOR EVERY HARDWORKING SOUL ↗</span></footer>`}</main>
 <dialog id="settings-dialog" class="settings-dialog"><form id="settings-form" novalidate>${settingsForm()}</form></dialog>
 <dialog id="method-dialog" class="method-dialog glass"><button class="icon-button modal-close" data-action="close-method" aria-label="关闭计算说明">${icon('close')}</button><span class="eyebrow">THE MATH BEHIND THE MONEY</span><h2>每一分，都有个说法。</h2><p>日薪 = 月薪 ÷ 月计薪天数<br>时薪 = 日薪 ÷ 每日有效工作小时<br>今日已赚 = 日薪 × 已过有效工时比例</p><p>休息时段不计薪，下班后收入封顶。跨夜班次归属于上班当天。休息日不计薪，不自动计算加班费、税费、奖金和假期。</p><p><strong>月度与本周为排班估算：</strong>过往排班日按满勤补算，今天按实时进度计算。应用不会记录真实出勤；修改配置会重新估算本月全部数据。</p><p class="muted">所有时间跟随本机时区。默认月薪 ¥8,000、月计薪 21.75 天只是示例配置，可在「打工配置」中修改。</p><button type="button" class="primary-button" data-action="close-method">明白，继续发财 ${icon('arrow')}</button></dialog>`;
  app.classList.toggle('hide-money', hidden);
  app.classList.toggle('is-mini', mini);
  bind();
  update();
  if (!saved && !mini && view === 'today')
    document.querySelector('.config-nudge')?.classList.add('show');
}
function todayContent() {
  return `<section class="page-heading"><div><div class="eyebrow">ANOTHER DAY, ANOTHER PAYDAY.</div><h1>又是赚<span class="scribble">窝囊费</span>的一天<span class="heading-star">✳</span></h1><p>把班上明白，把钱看清楚。</p></div><button class="text-button config-nudge" data-action="settings">初始为示例配置 ${icon('arrow')}</button></section>
 <section class="hero-grid"><article class="earnings-card glass"><div class="card-top"><span>${icon('coins')} 今日已赚</span><span class="small-label">TODAY'S LITTLE VICTORY</span></div><div class="big-earning"><span class="currency">¥</span>${cash('today-amount', '0.00')}<span class="earning-dot"></span></div><div class="income-caption"><p id="quote">${quotes[quoteIndex]}</p><span class="rate-pill">↗ ${cash('second-rate', '¥0.0000')}<small> / 秒</small></span></div><div class="sparkline"><svg viewBox="0 0 600 110" preserveAspectRatio="none" role="img" aria-label="按有效工时计算的今日收入曲线"><defs><linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c8e979" stop-opacity=".36"/><stop offset="100%" stop-color="#c8e979" stop-opacity="0"/></linearGradient></defs><path id="spark-area" fill="url(#spark-fill)"/><path id="spark-path" fill="none" stroke="#a9cc60" stroke-width="2.5"/><circle id="spark-dot" r="5" fill="#b9db71" stroke="white" stroke-width="3"/></svg><span>${settings.startTime}</span><span>${settings.endTime}</span></div><div class="goal-line"><span>今日小目标 <strong class="cash-value" id="daily-target"></strong></span><strong id="progress-label"></strong></div><div class="progress-track"><div id="main-progress"></div></div><button class="coffee-button" data-action="coffee">${icon('coffee')} 精神续杯，接着发财 <span>↗</span></button><div class="coffee-caption">不加班，不内耗，按时下班最重要。</div></article>
 <article class="mascot-card glass"><div class="mascot-scene"><span class="scene-id">EMPLOYEE OF THE MONTH<br><b>（并不想当）</b></span><img src="./mascot.png" class="mascot" alt="穿着紫色衬衫、歪领带，抱咖啡的疲惫牛马"/><div class="sticker">薪尽<br>自然凉<span>〰</span></div><span class="little-spark">✧</span></div><div class="countdown-section"><div class="countdown-label"><span></span><span id="countdown-label">距离下班还有</span><span></span></div><div class="countdown" id="countdown">00:00:00</div><p id="countdown-caption"></p></div><div class="shift-tag"><span id="shift-tag"></span><span>按时下班 · 拒绝感动自己</span></div></article></section>
 <section class="stats-grid"><article class="stat-card glass"><h2>${icon('clock')} 今日有效工时</h2><div class="stat-value" id="hours-worked"></div><div class="stat-bottom"><div class="progress-track small"><div id="hours-progress"></div></div><span id="total-hours"></span></div></article><button class="stat-card glass stat-link" data-nav="ledger"><h2>${icon('wallet')} 本月窝囊费 ${icon('arrow', 'trailing-icon')}</h2><div class="stat-value cash-value" id="month-amount"></div><div class="stat-bottom"><span class="soft-pill" id="month-days"></span><span>满勤估算</span></div></button><article class="stat-card glass"><h2>${icon('bolt')} 时薪身价</h2><div class="stat-value cash-value" id="hourly-rate"></div><div class="stat-bottom"><span>我的时间，很贵的。</span></div></article><article class="stat-card glass week-card"><h2>${icon('chart')} 本周搬砖 <span>估算</span></h2><div class="week-chart" id="week-chart"></div></article></section>
 <section class="survival-strip glass"><div class="survival-icon">${goals[selectedGoal].emoji}</div><div class="survival-copy"><strong id="goal-title"></strong><span id="goal-subtitle"></span></div><select id="goal-select" aria-label="选择快乐小目标">${goals.map((g, i) => `<option value="${i}" ${i === selectedGoal ? 'selected' : ''}>${g.name} · ¥${g.price}</option>`).join('')}</select><span class="strip-line"></span><span class="survival-footnote">工作只是生活的一部分。<b>你才是主角。</b></span></section>`;
}
function miniContent() {
  return `<div class="mini-brand">${cow}<strong>牛马计时器</strong><span>SMALL WINDOW, BIG DREAM.</span></div><div class="mini-hero glass"><img src="./mascot.png" alt="疲惫的小牛马"/><span class="eyebrow">今日已赚</span><div class="mini-cash">¥ ${cash('today-amount', '0.00')}</div><p id="quote">${quotes[0]}</p><div class="progress-track"><div id="main-progress"></div></div><div class="mini-count-label" id="countdown-label"></div><div id="countdown" class="countdown"></div><p id="countdown-caption"></p></div><button class="primary-button" data-action="settings">${icon('settings')} 打工配置</button>`;
}
function ledgerContent() {
  const n = now(),
    m = getMonthSummary(settings, n),
    details = getMonthDetails(settings, n),
    first = new Date(n.getFullYear(), n.getMonth(), 1);
  let days = '';
  for (let i = 0; i < (first.getDay() + 6) % 7; i++) days += '<div class="calendar-empty"></div>';
  for (const day of details) {
    days += `<div class="calendar-day ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''} ${day.isWorkDay ? 'scheduled' : 'rest'}"><span>${day.date.slice(-2)}${day.isToday ? '<b>今天</b>' : ''}</span><strong class="cash-value" id="day-${day.date}">${!day.isWorkDay ? '休息' : day.isFuture ? '—' : '¥' + money(day.earned)}</strong><small>${!day.isWorkDay ? '拒绝营业' : day.isFuture ? '尚未入账' : day.status === 'working' || day.status === 'break' ? '实时估算' : day.status === 'before' ? '尚未开工' : '满勤估算'}</small></div>`;
  }
  return `<section class="page-heading"><div><span class="eyebrow">THE FRUITS OF YOUR PATIENCE.</span><h1>每一份忍耐，<span class="scribble">都有回报。</span></h1><p>${n.getFullYear()} 年 ${n.getMonth() + 1} 月 · 排班估算账本</p></div><button data-action="export" class="outline-button">${icon('download')} 导出本月</button></section><div class="ledger-summary glass"><div><span>本月已赚（估算）</span><strong class="cash-value" id="ledger-earned">¥ ${money(m.earned)}</strong></div><div><span>已完成班次</span><strong><span id="ledger-days">${m.completedDays}</span><small> / ${m.workDays} 天</small></strong></div><div><span>本月满勤预计</span><strong class="cash-value">¥ ${money(m.projectedTotal)}</strong></div></div><div class="ledger-notice">${icon('info')} 过往排班日按满勤估算，今天按实时进度计算。修改工资或排班会重新估算，非真实出勤记录。<button data-action="method">了解口径 ↗</button></div><section class="calendar glass"><div class="calendar-header">${['MON 周一', 'TUE 周二', 'WED 周三', 'THU 周四', 'FRI 周五', 'SAT 周六', 'SUN 周日'].map((x) => `<span>${x}</span>`).join('')}</div><div class="calendar-grid">${days}</div></section>`;
}
function settingsForm() {
  return `<div class="modal-heading"><div><span class="eyebrow">SET YOUR OWN PACE</span><h2>打工配置<span>。</span></h2><p>工资可以保密，身价必须清楚。</p></div><button type="button" data-action="close-settings" class="icon-button" aria-label="关闭打工配置">${icon('close')}</button></div><div class="settings-body"><div class="form-section-title">01 <span>我的身价</span></div><div class="field-grid"><label>税前月薪（元）<input name="monthlySalary" type="number" min="0" step="0.01" required value="${settings.monthlySalary}" inputmode="decimal"/></label><label>月计薪天数<input name="payableDays" type="number" min="0.01" max="31" step="0.01" required value="${settings.payableDays}"/></label></div><p class="field-hint">日薪 = 月薪 ÷ 月计薪天数。默认 21.75 可按实际约定修改。</p><div class="form-section-title">02 <span>我的营业时间</span></div><div class="field-grid"><label>上班时间<input name="startTime" type="time" required value="${settings.startTime}"/></label><label>下班时间<input name="endTime" type="time" required value="${settings.endTime}"/></label></div><p class="field-hint">下班早于上班时，自动按跨夜班次计算。</p><div class="break-toggle"><label for="break-enabled">休息时段不计薪<small>牛马也需要充电。</small></label><input id="break-enabled" class="switch" name="breakEnabled" type="checkbox" ${settings.breakEnabled ? 'checked' : ''}/></div><div class="field-grid break-fields"><label>休息开始<input name="breakStart" type="time" value="${settings.breakStart}"/></label><label>休息结束<input name="breakEnd" type="time" value="${settings.breakEnd}"/></label></div><fieldset><legend>每周工作日</legend><div class="weekday-options">${[1, 2, 3, 4, 5, 6, 0].map((d, i) => `<label><input type="checkbox" name="workDays" value="${d}" ${settings.workDays.includes(d) ? 'checked' : ''}/><span>${['一', '二', '三', '四', '五', '六', '日'][i]}</span></label>`).join('')}</div></fieldset><p id="form-error" class="form-error" role="alert"></p><div class="settings-note">${icon('info')} 配置仅保存在本机。月度历史按当前排班估算，修改后会同步重算。</div></div><div class="modal-footer"><button class="text-button" type="button" data-action="demo">${demo ? '退出演示' : '看看上班效果'} ↗</button><button class="primary-button" type="submit">保存，开始发财 ${icon('check')}</button></div>`;
}
function set(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function width(id, value) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${value}%`;
}
function update() {
  const n = now(),
    d = getDaySummary(settings, n),
    m = getMonthSummary(settings, n),
    copy = statusCopy[d.status];
  set('status-text', copy[0]);
  document.querySelector('.status')?.setAttribute('data-status', d.status);
  set('top-date', dateText(n));
  set('live-clock', n.toLocaleTimeString('en-GB'));
  set('today-amount', money(d.earned));
  set('second-rate', `¥${(d.status === 'working' ? d.perSecond : 0).toFixed(4)}`);
  set('daily-target', `¥${money(d.dailyPay)}`);
  set('progress-label', `${(d.progress * 100).toFixed(1)}%`);
  width('main-progress', d.progress * 100);
  width('hours-progress', d.progress * 100);
  set('countdown-label', copy[1]);
  set('countdown-caption', copy[2]);
  set(
    'countdown',
    formatDuration(d.status === 'before' ? (d.startAt - n) / 1000 : d.remainingSeconds)
  );
  set(
    'shift-tag',
    `${settings.startTime} — ${settings.endTime}${settings.breakEnabled ? ' · 扣除休息' : ''}`
  );
  const hrs = Math.floor(d.elapsedSeconds / 3600),
    mins = Math.floor((d.elapsedSeconds % 3600) / 60);
  const hours = document.getElementById('hours-worked');
  if (hours)
    hours.innerHTML = `${hrs}<small>h</small> ${String(mins).padStart(2, '0')}<small>m</small>`;
  set('total-hours', `/ ${(d.totalSeconds / 3600).toFixed(1)}h`);
  set('month-amount', `¥${money(m.earned)}`);
  set('ledger-earned', `¥ ${money(m.earned)}`);
  set('ledger-days', m.completedDays);
  if (view === 'ledger')
    for (const day of getMonthDetails(settings, n)) {
      if (day.isWorkDay && !day.isFuture) set(`day-${day.date}`, `¥${money(day.earned)}`);
    }
  set('month-days', `↗ 已完成 ${m.completedDays} 天`);
  set('hourly-rate', `¥${money(d.hourlyRate)}`);
  const goal = goals[selectedGoal];
  set(
    'goal-title',
    `今天的你，已经赚到 ${(d.earned / goal.price).toFixed(1)} ${goal.name === '下班大餐' ? '顿' : '杯'}${goal.name}。`
  );
  set(
    'goal-subtitle',
    d.earned >= goal.price
      ? '给认真生活的自己，一点小小的奖励。'
      : `再攒 ¥${money(Math.max(0, goal.price - d.earned))}，快乐就到账。`
  );
  drawSpark(d, n);
  const chart = document.getElementById('week-chart');
  if (chart) {
    chart.innerHTML = getWeekSummary(settings, n)
      .map(
        (w) =>
          `<div class="week-column ${w.isToday ? 'current' : ''}"><span class="cash-value">${w.isFuture ? '' : w.isWorkDay ? '¥' + Math.round(w.earned) : '休'}</span><div class="bar-area"><div class="bar ${w.isFuture ? 'future' : ''}" style="height:${w.isFuture ? 30 : Math.max(4, (d.dailyPay > 0 ? w.earned / d.dailyPay : 0) * 53)}px"></div></div><small>${w.label}</small></div>`
      )
      .join('');
  }
  const day = n.toDateString();
  const dayChanged = lastDay && day !== lastDay;
  lastDay = day;
  if (dayChanged) shell();
}
function drawSpark(d, n) {
  if (!document.querySelector('#spark-path')) return;
  const start = +d.startAt,
    end = +d.endAt,
    current = Math.min(Math.max(+n, start), end);
  let points = [];
  for (let i = 0; i <= 60; i++) {
    const time = start + ((current - start) * i) / 60;
    const s = getDaySummary(settings, new Date(time));
    const y = 98 - s.progress * 84;
    points.push([(i / 60) * ((current - start) / (end - start)) * 590 + 5, y]);
  }
  const path = points
    .map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`)
    .join(' ');
  document.querySelector('#spark-path').setAttribute('d', path);
  const last = points.at(-1);
  document.querySelector('#spark-area').setAttribute('d', `${path} L${last[0]},110 L5,110 Z`);
  document.querySelector('#spark-dot').setAttribute('cx', last[0]);
  document.querySelector('#spark-dot').setAttribute('cy', last[1]);
}
function bind() {
  app.querySelectorAll('[data-nav]').forEach((b) =>
    b.addEventListener('click', () => {
      view = b.dataset.nav;
      shell();
    })
  );
  app.querySelector('.brand')?.addEventListener('click', (e) => {
    e.preventDefault();
    view = 'today';
    shell();
  });
  app
    .querySelectorAll('[data-action]')
    .forEach((b) => b.addEventListener('click', () => action(b.dataset.action)));
  app.querySelector('#settings-form').addEventListener('submit', saveSettings);
  app.querySelector('#break-enabled').addEventListener('change', toggleBreak);
  app.querySelector('#goal-select')?.addEventListener('change', (e) => {
    selectedGoal = Number(e.target.value);
    document.querySelector('.survival-icon').textContent = goals[selectedGoal].emoji;
    update();
  });
  app.querySelectorAll('dialog').forEach((d) =>
    d.addEventListener('click', (e) => {
      if (e.target === d) {
        const r = d.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
          d.close();
      }
    })
  );
  toggleBreak();
}
function toggleBreak() {
  const enabled = document.querySelector('#break-enabled').checked;
  document.querySelectorAll('.break-fields input').forEach((x) => (x.disabled = !enabled));
}
async function action(type) {
  if (type === 'settings') {
    document.querySelector('#settings-form').innerHTML = settingsForm();
    document
      .querySelector('#settings-form')
      .querySelectorAll('[data-action]')
      .forEach((b) => b.addEventListener('click', () => action(b.dataset.action)));
    document.querySelector('#break-enabled').addEventListener('change', toggleBreak);
    toggleBreak();
    document.querySelector('#settings-dialog').showModal();
  } else if (type === 'close-settings') document.querySelector('#settings-dialog').close();
  else if (type === 'method') document.querySelector('#method-dialog').showModal();
  else if (type === 'close-method') document.querySelector('#method-dialog').close();
  else if (type === 'privacy') {
    hidden = !hidden;
    app.classList.toggle('hide-money', hidden);
    document.querySelector('.privacy-button').setAttribute('aria-pressed', hidden);
    document
      .querySelector('.privacy-button')
      .setAttribute('aria-label', hidden ? '显示金额' : '隐藏金额');
  } else if (type === 'coffee') {
    quoteIndex = (quoteIndex + 1) % quotes.length;
    set('quote', quotes[quoteIndex]);
    document
      .querySelector('.mascot')
      ?.animate(
        [
          { transform: 'translateY(0) rotate(0)' },
          { transform: 'translateY(-5px) rotate(-1deg)' },
          { transform: 'translateY(0) rotate(0)' },
        ],
        { duration: 450 }
      );
    toast(
      ['精神电量 +1，今天也辛苦了。', '咖啡到位，烦恼退散。', '已为你续上一口打工仙气。'][
        quoteIndex % 3
      ]
    );
  } else if (type === 'mini') {
    if (window.niumaDesktop) await window.niumaDesktop.openMini();
    else {
      const url = new URL(location.href);
      url.searchParams.set('mini', '1');
      const popup = window.open(url, 'niuma-mini', 'width=390,height=600');
      if (!popup) toast('请允许弹窗后打开迷你模式。');
    }
  } else if (type === 'pin') {
    if (window.niumaDesktop) {
      pinned = await window.niumaDesktop.setAlwaysOnTop(!pinned);
      toast(pinned ? '已置顶，陪你一起搬砖。' : '已取消置顶。');
    } else toast('桌面安装版支持窗口置顶。');
  } else if (type === 'demo') {
    demo = !demo;
    if (demo) resetDemoClock();
    const url = new URL(location.href);
    if (demo) url.searchParams.set('demo', '1');
    else url.searchParams.delete('demo');
    history.replaceState(null, '', url);
    document.querySelector('#settings-dialog').close();
    shell();
    toast(demo ? '当前为演示时间，未修改你的配置。' : '已恢复本机实时时间。');
  } else if (type === 'export') exportCsv();
}
function saveSettings(e) {
  e.preventDefault();
  const form = new FormData(e.target);
  const next = {
    monthlySalary: Number(form.get('monthlySalary')),
    payableDays: Number(form.get('payableDays')),
    startTime: form.get('startTime'),
    endTime: form.get('endTime'),
    breakEnabled: form.has('breakEnabled'),
    breakStart: form.get('breakStart') || settings.breakStart,
    breakEnd: form.get('breakEnd') || settings.breakEnd,
    workDays: form.getAll('workDays').map(Number),
  };
  const errors = validateSettings(next);
  if (!form.get('monthlySalary')) errors.monthlySalary = '请填写月薪，0 也可以。';
  if (Object.keys(errors).length) {
    set('form-error', Object.values(errors)[0]);
    return;
  }
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
    settings = next;
    if (demo) resetDemoClock();
    shell();
    toast('配置已保存。每一秒，开始有了身价。');
  } catch {
    set('form-error', '本机存储不可用，配置暂未保存。');
  }
}
function exportCsv() {
  const n = now(),
    rows = [['日期', '排班', '估算收入（元）', '口径']];
  for (const day of getMonthDetails(settings, n)) {
    rows.push([
      day.date,
      day.isWorkDay ? '工作日' : '休息日',
      day.earned.toFixed(2),
      day.isFuture
        ? '未来未入账'
        : !day.isWorkDay
          ? '休息'
          : day.status === 'before'
            ? '尚未开工'
            : day.status === 'working' || day.status === 'break'
              ? '实时估算'
              : '满勤估算',
    ]);
  }
  const blob = new Blob(['\uFEFF' + rows.map((r) => r.join(',')).join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `牛马账本-${n.getFullYear()}-${n.getMonth() + 1}${demo ? '-演示' : ''}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('本月排班估算已导出。');
}
window.addEventListener('storage', (e) => {
  if (e.key === storageKey) {
    settings = readSettings();
    shell();
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) update();
});
shell();
if (window.niumaDesktop)
  window.niumaDesktop.getState().then((state) => {
    pinned = state.alwaysOnTop;
  });
setInterval(update, 1000);
