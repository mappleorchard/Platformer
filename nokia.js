// Safe Response.json wrapper 
(function () {
  if (!('Response' in window) || !Response.prototype) return;
  try {
    var _origJson = Response.prototype.json;
    Response.prototype.json = function () {
      var resp = this;
      try {
        var ct = resp.headers && resp.headers.get ? resp.headers.get('content-type') || '' : '';
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
      } catch (e) {}
      return _origJson.call(this);
    };
  } catch (err) {}
})();

// Advanced Nokia / KaiOS d-pad adapter
(function () {
  'use strict';

  var keyState = { up: false, down: false, left: false, right: false, enter: false, space: false, softLeft: false, softRight: false };
  var keyMap = { 'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight', 'enter': 'Enter', 'space': ' ', 'softLeft': 'Shift', 'softRight': 'Control' };

  // Optimization: Pre-allocate event names for faster dispatch
  var EVENT_NAME = 'nokia-dpad';

  function normalizeDpadEvent(e) {
    var kc = e.keyCode || e.which || 0;
    var k = e.key || '';
    // Priority check for common Nokia/KaiOS codes
    if (k === 'ArrowUp' || kc === 38 || kc === 50) return 'up';
    if (k === 'ArrowDown' || kc === 40 || kc === 56) return 'down';
    if (k === 'ArrowLeft' || kc === 37 || kc === 52) return 'left';
    if (k === 'ArrowRight' || kc === 39 || kc === 54) return 'right';
    if (k === 'Enter' || kc === 13) return 'enter';
    if (k === ' ' || kc === 32 || kc === 53) return 'space';
    if (k === 'SoftLeft' || kc === 407 || kc === 65 /* 'a' for emulator */) return 'softLeft';
    if (k === 'SoftRight' || kc === 408 || kc === 83 /* 's' for emulator */) return 'softRight';
    return null;
  }

  function forwardEvent(action, isDown, originalEvent) {
    if (keyState[action] === isDown) return;
    keyState[action] = isDown;

    // Haptic Feedback: subtle vibration for physical buttons (KaiOS/Web Standard)
    if (isDown && navigator.vibrate) {
      navigator.vibrate(10); 
    }

    // Prevent default browser scrolling/actions
    if (originalEvent && originalEvent.cancelable) {
      var tag = (originalEvent.target && originalEvent.target.tagName || '').toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        originalEvent.preventDefault();
      }
    }

    // Dispatch Custom Event with active key list for chord detection
    var activeList = [];
    for (var k in keyState) { if (keyState[k]) activeList.push(k); }
    
    window.dispatchEvent(new CustomEvent(EVENT_NAME, {
      detail: { action: action, down: isDown, activeKeys: activeList }
    }));

    // Synthesize KeyboardEvent for engines like TurboWarp
    var synthKey = keyMap[action];
    if (synthKey) {
      try {
        var se = new KeyboardEvent(isDown ? 'keydown' : 'keyup', { 
          key: synthKey, 
          code: synthKey,
          bubbles: true, 
          cancelable: true,
          shiftKey: keyState.softLeft,
          ctrlKey: keyState.softRight
        });
        document.dispatchEvent(se);
      } catch (err) {
        // Fallback for older browsers
        var evt = document.createEvent('KeyboardEvent');
        evt.initEvent(isDown ? 'keydown' : 'keyup', true, true);
        document.dispatchEvent(evt);
      }
    }
  }

  function handleKey(e, isDown) {
    if (e.isTrusted === false) return; 
    var action = normalizeDpadEvent(e);
    if (action) forwardEvent(action, isDown, e);
  }

  // Use {passive: false} to ensure preventDefault() works for game controls
  document.addEventListener('keydown', function (e) { handleKey(e, true); }, { capture: true, passive: false });
  document.addEventListener('keyup', function (e) { handleKey(e, false); }, { capture: true, passive: false });

  // Safety Reset: release all keys if user switches apps or menu opens
  window.addEventListener('blur', function() {
    for (var action in keyState) {
      if (keyState[action]) forwardEvent(action, false, null);
    }
  });

  console.log('Nokia Advanced Multi-Key Adapter Loaded');
})();
