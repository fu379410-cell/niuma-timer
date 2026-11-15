// Runs before the page paints; keeps saved light mode from flashing dark on launch.
(() => {
  let preference = 'system';
  try {
    const saved = localStorage.getItem('niuma.theme.v1');
    if (['light', 'dark', 'system'].includes(saved)) preference = saved;
  } catch {}
  const resolved = preference === 'system'
    ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolved;
})();
