const { JSDOM } = require('jsdom');
const fs = require('fs');
const shim = fs.readFileSync('/Users/kamran/Client Projects/Verbitam/webflow/cardmode.js', 'utf8');

// The failure mode: Webflow "Hide" sets display:none but leaves the node.
const html = `<!doctype html><html><head><style>.hidden-video{display:none}</style></head><body>
  <div class="card_player" data-video-id="abc" data-video-title="T">
    <video data-videoinline-video="" class="card_video hidden-video"></video>
    <div class="card_poster_meta"><button class="card_watch">WATCH</button></div>
  </div>
</body></html>`;

(async () => {
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  await new Promise((r) => { if (window.document.readyState === 'complete') return r(); window.addEventListener('load', r); setTimeout(r, 500); });
  const warns=[]; window.console.warn=(...a)=>warns.push(a.map(String).join(' '));
  window.eval(shim);

  const card = window.document.querySelector('.card_player');
  const v = window.document.querySelector('[data-videoinline-video]');
  console.log('video node still in DOM:      ', !!v);
  console.log('computed display:            ', window.getComputedStyle(v).display);
  console.log('querySelector still finds it:', !!card.querySelector('[data-videoinline-video]'));
  console.log('=> card treated as INLINE:   ', card.hasAttribute('data-videoinline-player'));
  console.log('=> popup opener added:       ', window.document.querySelector('.card_watch').hasAttribute('data-videopop-open'));
  console.log('\nGUARD FIRED:                 ', warns.some(w=>w.includes('hidden')));
  console.log('\nThis is the Step 4 failure mode: a hidden video reads as inline,');
  console.log('the popup never opens, and the card looks dead. Must be REMOVED.');
})();
