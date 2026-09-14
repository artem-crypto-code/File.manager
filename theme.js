// Ранний выбор темы, чтобы не было мигания при загрузке
(function () {
  var stored = null;
  try { stored = localStorage.getItem('fm.theme'); } catch (e) { /* приватный режим */ }
  var theme = stored || (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', theme);
})();
