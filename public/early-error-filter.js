// Loaded as a plain script before the app bundle: silences benign abort errors raised
// while the modules are still downloading. Kept out of index.html so the
// Content-Security-Policy can forbid inline scripts.
(function () {
  function isAbort(e) {
    if (!e) return false;
    var msg = (typeof e === 'string' ? e : (e.message || (e.reason && e.reason.message) || '')).toLowerCase();
    var name = (e.name || (e.reason && e.reason.name) || '');
    var code = (e.code || (e.reason && e.reason.code) || '');
    return name === 'AbortError' ||
           code === 'cancelled' ||
           code === 'auth/popup-closed-by-user' ||
           code === 'auth/cancelled-popup-request' ||
           msg.indexOf('aborted') !== -1 ||
           msg.indexOf('abort') !== -1 ||
           msg.indexOf('the user aborted a request') !== -1;
  }

  var origError = console.error;
  console.error = function () {
    for (var i = 0; i < arguments.length; i++) {
      if (isAbort(arguments[i])) return;
    }
    return origError.apply(console, arguments);
  };

  var origWarn = console.warn;
  console.warn = function () {
    for (var i = 0; i < arguments.length; i++) {
      if (isAbort(arguments[i])) return;
    }
    return origWarn.apply(console, arguments);
  };

  window.addEventListener('unhandledrejection', function (event) {
    if (isAbort(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('error', function (event) {
    if (isAbort(event.error) || isAbort(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
})();
