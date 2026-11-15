const KEY = 'niuma.theme.v1';
const valid = (value) => ['light', 'dark', 'system'].includes(value);
const options = [
  { value: 'light', icon: '☀', label: '亮色玻璃', detail: '奶油白与淡紫光' },
  { value: 'dark', icon: '☾', label: '深色玻璃', detail: '午夜蓝与通透层次' },
  { value: 'system', icon: '◐', label: '跟随系统', detail: '跟随电脑的外观设置' },
];
export function initTheme() {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const bridge = window.niumaDesktop;
  let preference = 'system';
  try {
    const saved = localStorage.getItem(KEY);
    if (valid(saved)) preference = saved;
  } catch {}
  let nativeResolved,
    sequence = 0;
  const resolved = () =>
    preference === 'system' ? nativeResolved || (media.matches ? 'dark' : 'light') : preference;
  function persist() {
    try {
      localStorage.setItem(KEY, preference);
    } catch {}
  }
  function render() {
    const mode = resolved();
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = mode;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'light' ? '#f2f1f7' : '#17162a');
    const selected = options.find((o) => o.value === preference);
    document
      .querySelectorAll('[data-theme-symbol]')
      .forEach((el) => (el.textContent = selected.icon));
    document
      .querySelectorAll('[data-theme-label]')
      .forEach(
        (el) =>
          (el.textContent =
            preference === 'system' ? '跟随系统' : preference === 'light' ? '亮色' : '深色')
      );
    document
      .querySelectorAll('.theme-control summary')
      .forEach((el) =>
        el.setAttribute(
          'aria-label',
          `切换主题，当前${selected.label}${preference === 'system' ? `，${mode === 'light' ? '亮色' : '深色'}` : ''}`
        )
      );
    document
      .querySelectorAll('[data-theme-choice]')
      .forEach((el) =>
        el.setAttribute('aria-checked', String(el.dataset.themeChoice === preference))
      );
    window.dispatchEvent(
      new CustomEvent('niuma-theme-change', { detail: { preference, resolved: mode } })
    );
  }
  function applyNative(state) {
    if (!state || !valid(state.preference)) return;
    preference = state.preference;
    nativeResolved = state.resolved === 'dark' ? 'dark' : 'light';
    persist();
    render();
  }
  async function setPreference(value) {
    if (!valid(value)) throw new RangeError('未知主题');
    const request = ++sequence,
      previous = preference;
    preference = value;
    nativeResolved = undefined;
    render();
    try {
      if (typeof bridge?.setTheme === 'function') {
        const state = await bridge.setTheme(value);
        if (request === sequence) applyNative(state);
      } else persist();
    } catch (error) {
      if (request === sequence) {
        preference = previous;
        render();
      }
      throw error;
    }
  }
  function bindControls(container) {
    container.querySelectorAll('[data-theme-choice]').forEach((el) =>
      el.addEventListener('click', async () => {
        el.closest('details').open = false;
        try {
          await setPreference(el.dataset.themeChoice);
        } catch {
          window.dispatchEvent(new CustomEvent('niuma-theme-error'));
        }
      })
    );
    render();
  }
  media.addEventListener('change', () => {
    if (preference === 'system') {
      nativeResolved = undefined;
      render();
    }
  });
  window.addEventListener('storage', (event) => {
    if (event.key !== KEY) return;
    preference = valid(event.newValue) ? event.newValue : 'system';
    nativeResolved = undefined;
    render();
  });
  document.addEventListener('click', (event) =>
    document.querySelectorAll('.theme-control[open]').forEach((el) => {
      if (!el.contains(event.target)) el.open = false;
    })
  );
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape')
      document.querySelectorAll('.theme-control[open]').forEach((el) => (el.open = false));
  });
  if (typeof bridge?.onThemeChanged === 'function') bridge.onThemeChanged(applyNative);
  if (typeof bridge?.getState === 'function')
    bridge
      .getState()
      .then((state) => {
        if (sequence === 0 && valid(state.themePreference))
          applyNative({ preference: state.themePreference, resolved: state.resolvedTheme });
      })
      .catch(() => {});
  render();
  return { setPreference, bindControls, getState: () => ({ preference, resolved: resolved() }) };
}
export function themeControlMarkup() {
  return `<details class="theme-control"><summary aria-label="切换主题"><span class="theme-symbol" data-theme-symbol>◐</span><span data-theme-label>跟随系统</span><span class="theme-arrow">⌄</span></summary><div class="theme-popover" role="radiogroup" aria-label="界面主题">${options.map((o) => `<button type="button" role="radio" aria-checked="false" data-theme-choice="${o.value}"><span class="theme-option-icon">${o.icon}</span><span><strong>${o.label}</strong><small>${o.detail}</small></span><span class="theme-check" aria-hidden="true">✓</span></button>`).join('')}</div></details>`;
}
