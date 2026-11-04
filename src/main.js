import './style.css';
import packageInfo from '../package.json';
import { mountGoals } from './goals-ui.js';
import { mountIncomeChart } from './income-chart.js';
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
  lastDay = '';
let goalsController, chartController;
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
  goalsController?.destroy();
  chartController?.destroy();
  goalsController = chartController = undefined;
  let saved = false;
  try {
    saved = !!localStorage.getItem(storageKey);
  } catch {}
  app.innerHTML = `<div class="ambient ambient-violet"></div><div class="ambient ambient-blue"></div><div class="ambient ambient-lime"></div><div class="window-texture"></div>
  <div class="app-window ${mini ? 'mini-window' : ''}">
    <header class="topbar">
      <a class="brand" href="#" aria-label="牛马计时器首页"><img src="./app-icon.png" alt="疲惫的卡通牛马图标"/><div><strong>牛马计时器<span>®</span></strong><small>GET PAID. STAY HUMAN.</small></div></a>
      ${mini ? '' : `<nav class="nav-tabs" aria-label="主要导航"><button data-nav="today" class="${view === 'today' ? 'active' : ''}">${icon('grid')} 搬砖现场</button><button data-nav="ledger" class="${view === 'ledger' ? 'active' : ''}">${icon('wallet')} 牛马账本</button></nav>`}
      <div class="top-actions">${demo ? '<button class="demo-badge" data-action="demo">演示中 · 退出</button>' : ''}<button class="icon-button privacy-button" data-action="privacy" aria-label="${hidden ? '显示金额' : '隐藏金额'}" title="隐藏或显示金额" aria-pressed="${hidden}">${icon('eye')}</button><button class="icon-button" data-action="${mini ? 'pin' : 'mini'}" aria-label="${mini ? '窗口置顶' : '打开迷你悬浮窗'}" title="${mini ? '窗口置顶' : '迷你悬浮窗'}">${icon(mini ? 'pin' : 'mini')}</button>${mini ? '' : `<button class="icon-button" data-action="settings" aria-label="打工配置" title="打工配置">${icon('settings')}</button>`}</div>
    </header>
    <main class="${mini ? 'mini-main' : 'main'}">${mini ? miniContent() : view === 'ledger' ? ledgerContent() : todayContent()}
      ${mini ? '' : `<footer><span>© ${new Date().getFullYear()} NIUMA · v${packageInfo.version} <i></i> 本机计算，快乐自定义。</span><button data-action="method">计算口径 ${icon('info')}</button><a href="https://github.com/fu379410-cell/niuma-timer" target="_blank" rel="noreferrer">${icon('code')} OPEN SOURCE</a></footer>`}
    </main>
  </div>
  <dialog id="settings-dialog" class="settings-dialog"><form id="settings-form" novalidate>${settingsForm()}</form></dialog>
  <dialog id="method-dialog" class="method-dialog glass"><button class="icon-button modal-close" data-action="close-method" aria-label="关闭计算说明">${icon('close')}</button><span class="eyebrow">THE MATH BEHIND THE MONEY</span><h2>每一分，都有个说法。</h2><p>日薪 = 月薪 ÷ 月计薪天数<br>时薪 = 日薪 ÷ 每日有效工作小时<br>今日已赚 = 日薪 × 已过有效工时比例</p><p>休息时段不计薪，下班后收入封顶。跨夜班次归属于上班当天。休息日不计薪，不自动计算加班费、税费、奖金和假期。</p><p><strong>月度与本周为排班估算：</strong>过往排班日按满勤补算，今天按实时进度计算。修改配置会重新估算本月全部数据。</p><p class="muted">趋势图按真实工时更新，午休与下班曲线保持平直。快乐目标金额为可修改的示例，仅保存在本机。</p><button type="button" class="primary-button" data-action="close-method">明白，继续发财 ${icon('arrow')}</button></dialog>`;
  app.classList.toggle('hide-money', hidden);
  app.classList.toggle('is-mini', mini);
  bind();
  if (document.querySelector('#income-chart'))
    chartController = mountIncomeChart(document.querySelector('#income-chart'), {
      getSettings: () => settings,
      getNow: now,
    });
  if (document.querySelector('#goals-root'))
    goalsController = mountGoals(document.querySelector('#goals-root'), {
      getIncome: () => getDaySummary(settings, now()),
      mini,
    });
  update();
  if (!saved && !mini && view === 'today')
    document.querySelector('.config-nudge')?.classList.add('show');
}
function todayContent() {
  return `<section class="page-heading"><div><div class="eyebrow">CLOCK IN. CASH OUT.</div><h1>钱在变多，<span>班在变少。</span><b>✳</b></h1></div><div class="heading-meta"><div class="status"><i></i><span id="status-text"></span></div><span id="top-date" class="top-date"></span><time id="live-clock"></time><button class="text-button config-nudge" data-action="settings">设置我的工资 ↗</button></div></section>
  <section class="hero-grid">
    <article class="earnings-card glass"><div class="card-top"><span>${icon('coins')} 今日已赚</span><span class="small-label">EVERY SECOND COUNTS.</span></div><div class="earning-row"><div class="big-earning"><span class="currency">¥</span>${cash('today-amount', '0.00')}</div><div class="rate-pill"><i></i>${cash('second-rate', '¥0.0000')}<small>/ 秒</small></div></div><p id="quote" class="income-quote">${quotes[quoteIndex]}</p><div id="income-chart"></div>
    <div class="salary-metrics"><div><span>${icon('clock')} 今日工时</span><strong id="hours-worked"></strong><small id="total-hours"></small></div><button data-nav="ledger"><span>${icon('wallet')} 本月已赚 <em>估算</em></span><strong id="month-amount" class="cash-value"></strong></button><div><span>${icon('bolt')} 时薪身价</span><strong id="hourly-rate" class="cash-value"></strong></div></div><div class="goal-line"><span>今日目标 <b id="daily-target" class="cash-value"></b></span><span id="progress-label"></span></div><div class="progress-track"><div id="main-progress"></div></div></article>
    <article class="mascot-card glass"><div class="character-headline"><span class="character-tag">工位常驻 NPC</span><span>ENERGY 1% · SALARY 100%</span></div><div class="mascot-scene"><div class="character-halo"></div><img class="mascot" src="./mascot-v2.png" alt="眼皮耷拉、顶着黑眼圈、领带松垮的疲惫卡通牛马"/><span class="character-sticker">薪尽<br>自然凉<span>✦</span></span><div class="character-whisper">精神离线，工资在线。</div></div><div class="countdown-box"><div class="countdown-label"><span id="countdown-label"></span><button class="recharge" data-action="coffee" aria-label="精神续杯" title="精神续杯">${icon('coffee')}</button></div><div class="countdown" id="countdown">00:00:00</div><p id="countdown-caption"></p><span id="shift-tag" class="shift-tag"></span></div></article>
  </section><div id="goals-root"></div>`;
}
function miniContent() {
  return `<div class="mini-overview glass"><img class="mini-mascot" src="./mascot-v2.png" alt="疲惫的卡通牛马"/><div class="mini-income"><span class="eyebrow">今日已赚 · 每一秒都没有白忍</span><div class="mini-cash">¥ ${cash('today-amount', '0.00')}</div><div class="status"><i></i><span id="status-text"></span></div></div><div class="mini-divider"></div><div class="mini-countdown"><span id="countdown-label"></span><div id="countdown" class="countdown"></div><p id="countdown-caption"></p></div></div><div id="goals-root"></div><button class="mini-settings text-button" data-action="settings">${icon('settings')} 打工配置</button>`;
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
  chartController?.update();
  goalsController?.update();
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
      const popup = window.open(url, 'niuma-mini', 'width=400,height=640');
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
document.body.classList.toggle('desktop', !!window.niumaDesktop);
shell();
if (window.niumaDesktop)
  window.niumaDesktop.getState().then((state) => {
    pinned = state.alwaysOnTop;
    document.body.dataset.platform = state.platform;
  });
setInterval(update, 1000);
