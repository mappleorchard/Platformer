// Lightweight Nokia / KaiOS d-pad adapter for TurboWarp web builds.
// Include this file before your main script so d-pad input is available at startup.
// Safe Response.json wrapper — install early (before script.js) to catch non-JSON responses
(function () {
  if (!('Response' in window) || !Response.prototype) return;
  try {
    var _origJson = Response.prototype.json;
    Response.prototype.json = function () {
      // Save reference to the Response object
      var resp = this;
      try {
        var ct = resp.headers && resp.headers.get ? resp.headers.get('content-type') || '' : '';
        // If content-type isn't JSON-like, read as text and log helpful info
        if (!/application\/(json|.+\+json)/i.test(ct)) {
          return resp.text().then(function (text) {
            console.error('Non-JSON response when JSON was expected:', {
              url: resp.url,
              status: resp.status,
              contentType: ct,
              preview: (typeof text === 'string' ? text.slice(0, 200) : text)
            });
            // Throw to keep existing code behavior (but with clearer message)
            throw new Error('Non-JSON response for ' + (resp.url || '(unknown url)') + '; see console for preview');
          });
        }
      } catch (e) {
        // If anything goes wrong checking headers, fall back to original behavior below
      }
      // If content-type is JSON-ish, call original .json()
      return _origJson.call(this);
    };
  } catch (err) {
    // If the environment doesn't allow overriding, just skip silently
    try { console.warn('Could not install safe Response.json wrapper', err); } catch (e) {}
  }
})();
(function () {
  'use strict';

  // Normalize to a small set: 'up','down','left','right','enter','space'
  function normalizeDpadEvent(e) {
    var kc = e.keyCode || e.which || 0;
    var k = e.key || '';

    // Standard keys
    if (k === 'ArrowUp' || kc === 38) return 'up';
    if (k === 'ArrowDown' || kc === 40) return 'down';
    if (k === 'ArrowLeft' || kc === 37) return 'left';
    if (k === 'ArrowRight' || kc === 39) return 'right';
    if (k === 'Enter' || kc === 13) return 'enter';
    if (k === ' ' || kc === 32) return 'space';

    // Feature-phone / KaiOS fallbacks (common alternate mappings)
    // Map numeric keypad 2/8/4/6 to arrows if device doesn't produce Arrow keys.
    if (kc === 50 /* '2' */) return 'up';
    if (kc === 56 /* '8' */) return 'down';
    if (kc === 52 /* '4' */) return 'left';
    if (kc === 54 /* '6' */) return 'right';

    // Add additional device-specific mappings here if you discover them
    return null;
  }

  // Forward normalized events into the app
  function forwardEvent(action, isDown, originalEvent) {
    try { originalEvent && originalEvent.preventDefault(); } catch (e) {}

    // Dispatch a simple custom event so the app can listen explicitly for d-pad input
    var ev = new CustomEvent('nokia-dpad', {
      detail: { action: action, down: !!isDown, sourceEvent: originalEvent },
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(ev);

    // For compatibility: also synthesize keyboard events (so code listening for Arrow keys / Enter works)
    var synthKey = null;
    if (action === 'up') synthKey = 'ArrowUp';
    if (action === 'down') synthKey = 'ArrowDown';
    if (action === 'left') synthKey = 'ArrowLeft';
    if (action === 'right') synthKey = 'ArrowRight';
    if (action === 'enter') synthKey = 'Enter';
    if (action === 'space') synthKey = ' ';

    if (synthKey) {
      try {
        var type = isDown ? 'keydown' : 'keyup';
        var se = new KeyboardEvent(type, { key: synthKey, bubbles: true, cancelable: true });
        document.dispatchEvent(se);
      } catch (err) {
        // Older engines may not allow new KeyboardEvent; ignore in that case.
      }
    }
  }

  function handleKey(e, isDown) {
    var action = normalizeDpadEvent(e);
    if (!action) return;
    forwardEvent(action, isDown, e);
  }

  // Attach listeners (use capture so we get them early and can prevent default navigation)
  document.addEventListener('keydown', function (e) { handleKey(e, true); }, true);
  document.addEventListener('keyup', function (e) { handleKey(e, false); }, true);

  // Some phones only fire keypress for center/dpad; treat keypress as down and synthesize an up soon after.
  document.addEventListener('keypress', function (e) {
    var action = normalizeDpadEvent(e);
    if (!action) return;
    handleKey(e, true);
    // schedule a synthetic keyup shortly after so apps expecting keyup still receive it
    setTimeout(function () { forwardEvent(action, false, e); }, 120);
  }, true);

  // Convenience log for devices with Nokia/KaiOS user agents
  if (/KaiOS|Nokia/i.test(navigator.userAgent)) {
    try { console.info('Nokia/KaiOS d-pad adapter active'); } catch (e) {}
  }

  // Example: how to listen in your game code:
  // window.addEventListener('nokia-dpad', e => {
  //   const { action, down } = e.detail;
  //   // map action/down to your input state
  // });
})();
