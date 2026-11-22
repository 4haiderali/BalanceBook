/* Runs before first paint so the app never flashes the wrong theme.
   Must stay a separate file: the desktop server's CSP only allows scripts from 'self'.
   Keep the storage logic in sync with lib/theme.ts. */
(function () {
  var preference = 'system';
  try {
    var match = document.cookie.match(/(?:^|;\s*)balancebook-theme=(system|light|dark)(?:;|$)/);
    if (match) preference = match[1];
    else {
      var stored = window.localStorage.getItem('balancebook-theme');
      if (stored === 'system' || stored === 'light' || stored === 'dark') preference = stored;
    }
  } catch (e) { /* fall back to system */ }
  var dark = preference === 'dark' || (preference === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
