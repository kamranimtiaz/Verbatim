/**
 * test-cardclick.cjs — whole-area card click via [data-card-click].
 *
 * The attribute is authored on the WRAPPER (.card_wrap), above [data-player],
 * which is the case that breaks a naive closest() lookup: the card resolves to
 * null and the popup opens with no GUID and no title. Both directions are
 * covered here, plus the guard list that keeps WATCH / READ / socials and the
 * inline scrubber doing their own job.
 *
 * Two scripts own the two modes, so both are loaded: videopopup.js claims a
 * popup-mode area, videoinline.js claims an inline one, and neither may claim
 * the other's.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dir = (f) => path.join(__dirname, '..', f);
const ROUTER = fs.readFileSync(dir('popuprouter.js'), 'utf8');
const POPUP_JS = fs.readFileSync(dir('videopopup.js'), 'utf8');
const INLINE_JS = fs.readFileSync(dir('videoinline.js'), 'utf8');

let fails = 0;
const check = (name, got, exp) => {
  const ok = String(got) === String(exp);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        got=${got}  exp=${exp}`}`);
};

const POPUP = `
<section data-videopop class="videopop_wrap">
  <div data-videopop-backdrop></div>
  <div data-videopop-dialog role="dialog" tabindex="-1"></div>
  <div data-videopop-state="paused" data-videopop-player data-videopop-hover="idle" class="videopop_player">
    <video data-videopop-video class="videopop_video"></video>
    <div data-videopop-loading class="videopop_loading"></div>
    <div data-videopop-playpause data-videopop-bigbtn class="videopop_bigbtn_wrap"></div>
    <div data-videopop-interface class="videopop_interface">
      <div class="videopop_meta">
        <div data-videopop-title-text class="videopop_title"></div>
        <button data-videopop-read>Read</button>
      </div>
      <div data-videopop-timeline><div data-videopop-buffered></div><div data-videopop-progress></div></div>
      <div data-videopop-handle></div>
      <button data-videopop-playpause><div data-videopop-playpause-label>Play</div>
        <svg data-videopop-icon="play"></svg><svg data-videopop-icon="pause"></svg></button>
      <p data-videopop-progress-text></p><p data-videopop-duration-text></p>
      <button data-videopop-mute><svg data-videopop-icon="volume-up"></svg><svg data-videopop-icon="volume-mute"></svg></button>
      <div data-videopop-volume><div data-videopop-volume-fill></div></div>
      <button data-videopop-fullscreen><svg data-videopop-icon="maximise"></svg><svg data-videopop-icon="minimise"></svg></button>
    </div>
  </div>
  <button data-videopop-close></button>
</section>`;

const GUID_WRAP = '3c620596-11d3-4afd-b573-29ac60e59bd2';
const GUID_SELF = 'e422a6c5-c952-47ed-8930-570a033149f9';

// Card 1: area on the WRAPPER, above [data-player] — the real Webflow shape.
// Card 2: area on the card element itself, the single-element case (hero).
// Card 3: inline card, area on the wrapper — videoinline.js must own it.
const CARDS = `
<div id="wrapcard" data-card data-card-click class="card_wrap">
  <div class="card_layout">
    <div data-player data-video-id="${GUID_WRAP}" data-video-title="Wrapper Card" class="card_player">
      <img data-videoinline-poster-img><img data-videoinline-preview>
      <div class="card_poster_meta">
        <button data-card-watch id="w-watch">WATCH</button>
        <a data-popup-open id="w-read" href="/story/wrapper-card">READ</a>
        <a id="w-social" href="https://instagram.com/x">IG</a>
        <a id="w-download" href="/f.mp4" download>DOWNLOAD</a>
      </div>
    </div>
    <div class="card_info"><div data-card-title id="w-title" class="card_title">Wrapper Card</div></div>
  </div>
</div>

<div id="selfcard" data-card class="card_wrap">
  <div data-player data-card-click data-video-id="${GUID_SELF}" data-video-title="Self Card" class="card_player">
    <img data-videoinline-poster-img><img data-videoinline-preview>
    <button data-card-watch id="s-watch">WATCH</button>
  </div>
</div>

<div id="inlinecard" data-card data-card-click class="card_wrap">
  <!-- A plain .mp4 via data-videoinline-src, not a GUID: a GUID builds an HLS
       URL and togglePlay() then awaits hls.js from a CDN, which never resolves
       under jsdom. The click path under test is identical either way. -->
  <div data-player data-videoinline-player data-videoinline-src="/clip.mp4"
       data-video-title="Inline Card" data-videoinline-state="idle" class="card_player">
    <video data-videoinline-video class="card_video"></video>
    <img data-videoinline-poster-img><img data-videoinline-preview>
    <button data-videoinline-playpause id="i-playpause">Play</button>
    <div data-videoinline-timeline id="i-timeline"><div data-videoinline-buffered></div><div data-videoinline-progress></div></div>
    <div data-videoinline-handle></div>
    <button data-videoinline-mute><svg data-videoinline-icon="volume-up"></svg><svg data-videoinline-icon="volume-mute"></svg></button>
    <div data-videoinline-volume><div data-videoinline-volume-fill></div></div>
    <button data-videoinline-fullscreen><svg data-videoinline-icon="maximise"></svg><svg data-videoinline-icon="minimise"></svg></button>
    <p data-videoinline-progress-text></p><p data-videoinline-duration-text></p>
  </div>
</div>`;

function boot(url = 'https://verbitam.test/') {
  const dom = new JSDOM(`<!doctype html><html><body>${POPUP}${CARDS}</body></html>`,
    { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const chain = () => { const o = { to: () => o, fromTo: () => o, set: () => o }; return o; };
  window.gsap = { set: () => {}, timeline: (c) => { if (c && c.onComplete) setTimeout(c.onComplete, 0); return chain(); } };

  // Track play/pause so the inline assertions have something to read.
  const calls = { play: 0, pause: 0 };
  window.HTMLMediaElement.prototype.load = function () {};
  window.HTMLMediaElement.prototype.play = function () { calls.play++; this.paused = false; return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () { calls.pause++; this.paused = true; };
  window.HTMLMediaElement.prototype.canPlayType = () => '';
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

  new Function('window', 'document', 'history', 'location', 'URL', 'setTimeout', ROUTER)(
    window, window.document, window.history, window.location, window.URL, window.setTimeout.bind(window));

  const runScript = (src) => new Function('window', 'document', 'navigator', 'HTMLElement', 'CustomEvent', 'URL',
    'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout',
    'clearTimeout', 'matchMedia', 'gsap', 'IntersectionObserver', 'ResizeObserver', src)(
    window, window.document, window.navigator, window.HTMLElement, window.CustomEvent, window.URL,
    window.getComputedStyle.bind(window), window.requestAnimationFrame.bind(window),
    window.cancelAnimationFrame.bind(window), window.setTimeout.bind(window),
    window.clearTimeout.bind(window), window.matchMedia.bind(window), window.gsap,
    window.IntersectionObserver, window.ResizeObserver);

  runScript(POPUP_JS);
  runScript(INLINE_JS);

  if (typeof window.videopopupRefresh === 'function') window.videopopupRefresh();
  if (typeof window.videoinlineRefresh === 'function') window.videoinlineRefresh();

  const d = window.document;

  // A real left-click at a settled pointer position: pointerdown then click at
  // the same coordinates, which is what the drag-slop guard measures.
  const clickAt = (el, opts = {}) => {
    const { downX = 10, downY = 10, x = 10, y = 10, ...rest } = opts;
    el.dispatchEvent(new window.PointerEvent('pointerdown',
      { bubbles: true, clientX: downX, clientY: downY, button: 0 }));
    const ev = new window.MouseEvent('click',
      { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, detail: 1, ...rest });
    el.dispatchEvent(ev);
    return ev;
  };

  return {
    window, d, calls, clickAt,
    // The popup has no "open" attribute: it becomes visible and writes
    // ?watch= into the URL. Visibility is the signal openPopup() sets first.
    open: () => (d.querySelector('[data-videopop]').style.visibility === 'visible' ? 'true' : 'null'),
    popId: () => d.querySelector('[data-videopop-player]').getAttribute('data-videopop-id'),
    title: () => d.querySelector('[data-videopop-title-text]').textContent,
    watchParam: () => new window.URL(window.location.href).searchParams.get('watch')
  };
}

const settle = () => new Promise((r) => setTimeout(r, 30));

const run = async () => {
  // --- 1. area on the wrapper ------------------------------------------------
  console.log('\n=== area on .card_wrap (attribute above [data-player]) ===');
  {
    const t = boot();
    const area = t.d.getElementById('wrapcard');
    check('area is registered as an opener', area.dataset.videopopBound, 'true');

    t.clickAt(area);
    await settle();
    check('body click opens the popup', t.open(), 'true');
    // The regression the closest()-only lookup causes: card === null.
    check('GUID resolves from the descendant card', t.popId(), GUID_WRAP);
    check('title resolves from the descendant card', t.title(), 'Wrapper Card');
  }

  // --- 2. controls on top keep their own job ---------------------------------
  console.log('\n=== controls inside the area ===');
  {
    const t = boot();
    t.d.getElementById('w-watch').click();
    await settle();
    check('WATCH still opens the popup', t.open(), 'true');
    check('WATCH opens the right video', t.popId(), GUID_WRAP);
  }
  {
    const t = boot();
    const ev = t.clickAt(t.d.getElementById('w-read'));
    await settle();
    check('READ does not open the video popup', t.open(), 'null');
    check('READ is left to its own handler (not prevented)', ev.defaultPrevented, 'false');
  }
  {
    const t = boot();
    const ev = t.clickAt(t.d.getElementById('w-social'));
    await settle();
    check('social link does not open the popup', t.open(), 'null');
    check('social link navigates (not prevented)', ev.defaultPrevented, 'false');
  }
  {
    const t = boot();
    const ev = t.clickAt(t.d.getElementById('w-download'));
    await settle();
    check('DOWNLOAD does not open the popup', t.open(), 'null');
    check('DOWNLOAD is not prevented', ev.defaultPrevented, 'false');
  }
  {
    // The title sits outside .card_player but inside .card_wrap, so with the
    // attribute on the wrapper it is clickable — and must open the card.
    const t = boot();
    t.clickAt(t.d.getElementById('w-title'));
    await settle();
    check('title row opens the popup (wrapper scope)', t.open(), 'true');
  }

  // --- 3. rejected gestures --------------------------------------------------
  console.log('\n=== gestures that must not open ===');
  {
    const t = boot();
    t.clickAt(t.d.getElementById('wrapcard'), { downX: 10, downY: 10, x: 90, y: 10 });
    await settle();
    check('horizontal drag past slop is ignored', t.open(), 'null');
  }
  {
    const t = boot();
    t.clickAt(t.d.getElementById('wrapcard'), { downX: 10, downY: 10, x: 10, y: 90 });
    await settle();
    check('vertical drag past slop is ignored', t.open(), 'null');
  }
  {
    const t = boot();
    t.clickAt(t.d.getElementById('wrapcard'), { metaKey: true });
    await settle();
    check('cmd-click is ignored', t.open(), 'null');
  }
  {
    const t = boot();
    const area = t.d.getElementById('wrapcard');
    area.dispatchEvent(new t.window.PointerEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, button: 0 }));
    area.dispatchEvent(new t.window.MouseEvent('click',
      { bubbles: true, cancelable: true, clientX: 10, clientY: 10, button: 0, detail: 0 }));
    await settle();
    check('keyboard-synthesised click (detail 0) is ignored', t.open(), 'null');
  }
  {
    const t = boot();
    // A text selection left standing means the press was a drag, not a tap.
    t.window.getSelection = () => ({ isCollapsed: false, toString: () => 'Wrapper Card' });
    t.clickAt(t.d.getElementById('wrapcard'));
    await settle();
    check('click ending a text selection is ignored', t.open(), 'null');
  }
  {
    const t = boot();
    const ev = t.clickAt(t.d.getElementById('wrapcard'), { button: 2 });
    await settle();
    check('right-click is ignored', t.open(), 'null');
  }

  // --- 4. area on the card itself (hero shape) -------------------------------
  console.log('\n=== area on [data-player] itself ===');
  {
    const t = boot();
    t.clickAt(t.d.querySelector('#selfcard [data-player]'));
    await settle();
    check('single-element case opens', t.open(), 'true');
    check('single-element case has the right GUID', t.popId(), GUID_SELF);
    check('single-element case has the right title', t.title(), 'Self Card');
  }

  // --- 5. inline cards belong to videoinline.js ------------------------------
  console.log('\n=== inline card ===');
  {
    const t = boot();
    const inline = t.d.getElementById('inlinecard');
    check('videopopup.js does NOT claim an inline area', inline.dataset.videopopBound, 'undefined');
    check('videoinline.js DOES claim it', inline.dataset.videoinlineAreaBound, 'true');

    t.clickAt(inline);
    await settle();
    check('inline area click does not open the popup', t.open(), 'null');
    check('inline area click plays in place', t.calls.play > 0, 'true');
  }
  {
    const t = boot();
    const inline = t.d.getElementById('inlinecard');
    t.clickAt(t.d.getElementById('i-timeline'));
    await settle();
    check('scrubber click does not toggle playback', t.calls.play, 0);

    // A scrub released outside the timeline still bubbles a click to the area.
    t.d.querySelector('#inlinecard [data-player]').setAttribute('data-videoinline-drag', 'true');
    t.clickAt(inline);
    await settle();
    check('mid-scrub click is ignored', t.calls.play, 0);
  }
  {
    const t = boot();
    t.clickAt(t.d.getElementById('i-playpause'));
    await settle();
    const afterButton = t.calls.play;
    check('playpause button still works', afterButton > 0, 'true');
  }

  console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILED`}`);
  process.exit(fails === 0 ? 0 : 1);
};

run();
