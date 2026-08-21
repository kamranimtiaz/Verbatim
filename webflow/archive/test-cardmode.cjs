const { JSDOM } = require('jsdom');
(async () => {
const fs = require('fs');

const shim = fs.readFileSync('/Users/kamran/Client Projects/Verbitam/webflow/cardmode.js', 'utf8');

// Your real component markup, trimmed to the parts the shim touches.
const player = (withVideo) => `
<div class="card_wrap"><div class="card_layout">
  <div data-videoinline-hover="idle" data-trigger="hover focus"
       data-video-id="e422a6c5-c952-47ed-8930-570a033149f9"
       data-video-title="Who Funds the Funders"
       data-videoinline-state="idle" class="card_player">
    ${withVideo ? '<video data-videoinline-video="" class="card_video"></video>' : ''}
    <img data-videoinline-poster-img="" class="card_poster">
    <img data-videoinline-preview="" class="card_preview">
    ${withVideo ? '<div data-videoinline-loading="" class="card_loading"></div>' : ''}
    ${withVideo ? '<button data-videoinline-playpause="" class="card_bigbtn"></button>' : ''}
    <div data-videoinline-poster-meta="" class="card_poster_meta">
      <button data-trigger="hover focus" aria-label="Watch video" class="card_watch">
        <div class="videoinline_watch_label">WATCH</div>
      </button>
      <div data-videoinline-poster-time="" class="card_poster_time">00:22</div>
    </div>
    ${withVideo ? '<div data-videoinline-interface="" class="card_interface"></div>' : ''}
  </div>
  <div class="card_info"><div class="card_title">T</div><div class="card_date">D</div></div>
</div></div>`;

const html = `<!doctype html><html><body>
  <section class="videos">${player(true)}</section>
  <section class="investigation">${player(false)}</section>
  <section class="broken">
    <div class="card_player" data-video-title="No GUID"><div class="card_poster_meta">
      <button class="card_watch">WATCH</button></div></div>
  </section>
</body></html>`;

// resources/beforeParse left default: we want the document fully parsed and
// readyState === 'complete' before eval, so the shim takes its immediate path
// rather than waiting on a DOMContentLoaded that jsdom never fires here.
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;
await new Promise((r) => {
  if (window.document.readyState === 'complete') return r();
  window.addEventListener('load', r);
  setTimeout(r, 500);
});

const warnings = [];
window.console.warn = (...a) => warnings.push(a.map(String).join(' '));

window.eval(shim);

const $ = (s) => window.document.querySelector(s);
const inline = $('.videos .card_player');
const popup  = $('.investigation .card_player');
const broken = $('.broken .card_player');

let pass = 0, fail = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

console.log('--- inline card (video present) ---');
check('gets data-videoinline-player', inline.hasAttribute('data-videoinline-player'), true);
check('WATCH gets NO data-videopop-open', $('.videos .card_watch').hasAttribute('data-videopop-open'), false);
check('WATCH gets data-card-play', $('.videos .card_watch').hasAttribute('data-card-play'), true);
check('no cursor override', inline.style.cursor, '');

console.log('--- popup card (video stripped) ---');
check('no data-videoinline-player', popup.hasAttribute('data-videoinline-player'), false);
check('WATCH gets data-videopop-open', $('.investigation .card_watch').hasAttribute('data-videopop-open'), true);
check('GUID promoted from card (data-video-id)', $('.investigation .card_watch').getAttribute('data-video-id'), 'e422a6c5-c952-47ed-8930-570a033149f9');
check('title promoted from card', $('.investigation .card_watch').getAttribute('data-videopop-title'), 'Who Funds the Funders');
check('cursor pointer set', popup.style.cursor, 'pointer');
check('WATCH gets NO data-card-play', $('.investigation .card_watch').hasAttribute('data-card-play'), false);

console.log('--- malformed card (no GUID) ---');
check('no popup opener added', $('.broken .card_watch').hasAttribute('data-videopop-open'), false);
check('warned to console', warnings.some(w => w.includes('no data-video-id')), true);

console.log('--- idempotency (double init) ---');
const before = window.document.body.innerHTML;
window.eval(shim);
check('second run is a no-op', window.document.body.innerHTML, before);

console.log('--- click forwarding ---');
let clicks = 0;
$('.investigation .card_watch').addEventListener('click', () => clicks++);
popup.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('card click forwards to WATCH once', clicks, 1);
$('.investigation .card_watch').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
check('direct WATCH click does not double-fire', clicks, 2);

console.log('--- roles are mutually exclusive ---');
// A stale attribute from the opposite mode must never survive, or the button
// would be wired to both the inline player and the popup opener at once.
const stale = new JSDOM(`<!doctype html><html><body>
  <section class="a">${player(true).replace('class="card_watch"', 'class="card_watch" data-videopop-open=""')}</section>
  <section class="b">${player(false).replace('class="card_watch"', 'class="card_watch" data-card-play=""')}</section>
</body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true });
// Same wait as above: jsdom never fires DOMContentLoaded here, so without this
// the shim registers a listener that never runs and every assertion no-ops.
await new Promise((r) => {
  if (stale.window.document.readyState === 'complete') return r();
  stale.window.addEventListener('load', r);
  setTimeout(r, 500);
});
stale.window.eval(shim);
const sq = (sel) => stale.window.document.querySelector(sel);
check('inline strips stale data-videopop-open', sq('.a .card_watch').hasAttribute('data-videopop-open'), false);
check('inline sets data-card-play', sq('.a .card_watch').hasAttribute('data-card-play'), true);
check('popup strips stale data-card-play', sq('.b .card_watch').hasAttribute('data-card-play'), false);
check('popup sets data-videopop-open', sq('.b .card_watch').hasAttribute('data-videopop-open'), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
