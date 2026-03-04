// Safe Response.json wrapper 
// Install early (before your main scripts) to catch non-JSON responses
(function () {
  if (!('Response' in window) || !Response.prototype) return;
  try {
    var _origJson = Response.prototype.json;
    Response.prototype.json = function () {
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
            throw new Error('Non-JSON response for ' + (resp.url || '(unknown url)') + '; see console for preview');
          });
        }
      } catch (e) {
        // Fall back to original behavior if headers fail
      }
      return _origJson.call(this);
    };
  } catch (err) {
    try { console.warn('Could not install safe Response.json wrapper', err); } catch (e) {}
  }
})();

// Lightweight Nokia / KaiOS d-pad adapter for TurboWarp web builds.
// Include this before your main script so d-pad input is available at startup.
(function () {
  'use strict';

  // Track active keys to prevent duplicate synthetic keyups from the keypress hack
  var activeKeys = {};

  // Normalize to a small set: 'up','down','left','right','enter','space', 'softLeft', 'softRight'
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

    // KaiOS Soft Keys
    if (k === 'SoftLeft') return 'softLeft';
    if (k === 'SoftRight') return 'softRight';

    // Feature-phone / KaiOS fallbacks (numeric keypad mapping)
    if (kc === 50 /* '2' */) return 'up';
    if (kc === 56 /* '8' */) return 'down';
    if (kc === 52 /* '4' */) return 'left';
    if (kc === 54 /* '6' */) return 'right';

    return null;
  }

  // Forward normalized events into the app
  function forwardEvent(action, isDown, originalEvent) {
    // Only prevent default if the user isn't interacting with a text input
    var targetTag = originalEvent.target ? originalEvent.target.tagName.toLowerCase() : '';
    if (targetTag !== 'input' && targetTag !== 'textarea') {
      try { originalEvent && originalEvent.preventDefault(); } catch (e) {}
    }

    // Dispatch custom event for explicit listeners
    var ev = new CustomEvent('nokia-dpad', {
      detail: { action: action, down: !!isDown, sourceEvent: originalEvent },
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(ev);

    // Synthesize keyboard events for standard game engine compatibility
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
    // CRITICAL FIX: Ignore our own synthesized events to prevent infinite loops
    if (e.isTrusted === false) return; 

    var action = normalizeDpadEvent(e);
    if (!action) return;

    // Track state to help the keypress hack
    activeKeys[action] = isDown;

    forwardEvent(action, isDown, e);
  }

  // Attach listeners with capture
  document.addEventListener('keydown', function (e) { handleKey(e, true); }, true);
  document.addEventListener('keyup', function (e) { handleKey(e, false); }, true);

  // Keypress hack for older feature phones
  document.addEventListener('keypress', function (e) {
    if (e.isTrusted === false) return;

    var action = normalizeDpadEvent(e);
    if (!action) return;
    
    // Only trigger if not already handled by a proper keydown event
    if (!activeKeys[action]) {
        handleKey(e, true);
        
        // Schedule synthetic keyup, but check if a real keyup fired in the meantime
        setTimeout(function () { 
            if (activeKeys[action]) { 
                activeKeys[action] = false;
                forwardEvent(action, false, e); 
            }
        }, 120);
    }
  }, true);

  // Convenience log for devices with Nokia/KaiOS user agents
  if (/KaiOS|Nokia/i.test(navigator.userAgent)) {
    try { console.info('Nokia/KaiOS d-pad adapter active'); } catch (e) {}
  }
})();
