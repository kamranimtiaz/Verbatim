/**
 * test-youtube.cjs — Bunny vs YouTube source switching in videopopup.js.
 *
 * Covers the `data-video-youtube` mode switch: id extraction from every URL
 * shape an editor might paste, the iframe mount/teardown lifecycle (a frame
 * that keeps its src goes on playing audio behind a closed dialog), that the
 * two players are never both live, that ?watch= round-trips under the `yt:`
 * prefix, and that a Bunny UUID can never be mistaken for a YouTube id.
 *
 * Loads popuprouter.js first, exactly as the site does — without it every
 * ?watch= assertion would be testing a missing dependency.
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const dir = (f) => path.join(__dirname, '..', f);
const ROUTER = fs.readFileSync(dir('popuprouter.js'), 'utf8');
const POPUP_JS = fs.readFileSync(dir('videopopup.js'), 'utf8');

let fails = 0;
const check = (name, got, exp) => {
  const ok = String(got) === String(exp);
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n        got=${got}  exp=${exp}`}`);
};

// --- 1. id extraction --------------------------------------------------------
// Exercised through the same regex the script uses, kept in sync by eye; the
// DOM cases below prove the wiring, these prove the parsing surface.
const YT_ID = /(?:youtu\.be\/|\/shorts\/|\/embed\/|\/live\/|[?&]v=)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$/;
const ytId = (raw) => { if (!raw) return null; const m = String(raw).trim().match(YT_ID); return m ? m[1] || m[2] : null; };

console.log('=== id extraction ===');
[
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s', 'dQw4w9WgXcQ'],
  ['https://youtu.be/dQw4w9WgXcQ?si=abc123', 'dQw4w9WgXcQ'],
  ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['https://m.youtube.com/watch?app=desktop&v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ['  dQw4w9WgXcQ  ', 'dQw4w9WgXcQ'],
  ['', 'null'],
  // The one that must never match, or the two modes would collide.
  ['3c620596-11d3-4afd-b573-29ac60e59bd2', 'null'],
  ['https://example.com/nope', 'null']
].forEach(([inp, exp]) => check(JSON.stringify(inp), ytId(inp), exp));

// --- DOM harness -------------------------------------------------------------
const POPUP = `
<section data-videopop class="videopop_wrap">
  <div data-videopop-backdrop></div>
  <div data-videopop-dialog role="dialog" tabindex="-1"></div>
  <div data-videopop-state="paused" data-videopop-player data-videopop-hover="idle" class="videopop_player">
    <video data-videopop-video class="videopop_video"></video>
    <div data-videopop-loading class="videopop_loading"></div>
    <div data-videopop-playpause data-videopop-bigbtn class="videopop_bigbtn_wrap"></div>
    <div class="videopop_fade"></div>
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

const GUID = '3c620596-11d3-4afd-b573-29ac60e59bd2';
const CARDS = `
<div data-card><div data-player data-video-id="${GUID}" data-video-title="Bunny Clip" class="card_player">
  <img data-videoinline-poster-img><img data-videoinline-preview>
  <button data-card-watch>WATCH</button></div></div>
<div data-card><div data-player data-video-youtube="https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42" data-video-title="YouTube Clip" class="card_player">
  <img data-videoinline-poster-img><img data-videoinline-preview>
  <button data-card-watch>WATCH</button></div></div>`;

function boot(url) {
  const dom = new JSDOM(`<!doctype html><html><body>${POPUP}${CARDS}</body></html>`,
    { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const chain = () => { const o = { to: () => o, fromTo: () => o, set: () => o }; return o; };
  window.gsap = { set: () => {}, timeline: (c) => { if (c && c.onComplete) setTimeout(c.onComplete, 0); return chain(); } };
  window.HTMLMediaElement.prototype.load = function () {};
  window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () {};
  window.HTMLMediaElement.prototype.canPlayType = () => '';
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo = () => {};

  new Function('window', 'document', 'history', 'location', 'URL', 'setTimeout', ROUTER)(
    window, window.document, window.history, window.location, window.URL, window.setTimeout.bind(window));

  new Function('window', 'document', 'navigator', 'HTMLElement', 'CustomEvent', 'URL',
    'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout',
    'clearTimeout', 'matchMedia', 'gsap', POPUP_JS)(
    window, window.document, window.navigator, window.HTMLElement, window.CustomEvent, window.URL,
    window.getComputedStyle.bind(window), window.requestAnimationFrame.bind(window),
    window.cancelAnimationFrame.bind(window), window.setTimeout.bind(window),
    window.clearTimeout.bind(window), window.matchMedia.bind(window), window.gsap);

  // jsdom fires load before the scripts eval, so drive the same entry points
  // the browser's own listeners would have.
  if (typeof window.videopopupRefresh === 'function') window.videopopupRefresh();
  const d = window.document;
  return {
    window, d,
    player: d.querySelector('[data-videopop-player]'),
    video: d.querySelector('[data-videopop-video]'),
    watches: d.querySelectorAll('[data-card-watch]'),
    frame: () => d.querySelector('[data-videopop-youtube-frame]'),
    watchParam: () => new window.URL(window.location.href).searchParams.get('watch'),
    title: () => d.querySelector('[data-videopop-title-text]').textContent
  };
}

const run = async () => {
  const t = boot('https://verbitam.test/');
  const settle = () => new Promise((r) => setTimeout(r, 30));

  console.log('\n=== initial state ===');
  check('source defaults to bunny', t.player.getAttribute('data-videopop-source'), 'bunny');
  check('no iframe until needed', t.frame() === null, 'true');

  console.log('\n=== open Bunny card ===');
  t.watches[0].click();
  check('source=bunny', t.player.getAttribute('data-videopop-source'), 'bunny');
  check('title synced', t.title(), 'Bunny Clip');
  check('guid on player', t.player.getAttribute('data-videopop-id'), GUID);
  check('?watch= is bare guid', t.watchParam(), GUID);
  t.d.querySelector('[data-videopop-close]').click();
  await settle();

  console.log('\n=== open YouTube card ===');
  t.watches[1].click();
  check('source=youtube', t.player.getAttribute('data-videopop-source'), 'youtube');
  check('id extracted from pasted URL', t.player.getAttribute('data-videopop-youtube'), 'dQw4w9WgXcQ');
  check('title synced', t.title(), 'YouTube Clip');
  check('iframe mounted', t.frame() !== null, 'true');
  check('nocookie embed', /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/.test(t.frame().src), 'true');
  // Opens paused: the viewer presses play, same as a Bunny video.
  check('does NOT autoplay', /autoplay=0/.test(t.frame().src), 'true');
  check('allowfullscreen', t.frame().hasAttribute('allowfullscreen'), 'true');
  check('<video> parked (no src)', t.video.getAttribute('src'), 'null');
  check('?watch= yt-prefixed', t.watchParam(), 'yt:dQw4w9WgXcQ');

  console.log('\n=== close YouTube ===');
  t.d.querySelector('[data-videopop-close]').click();
  await settle();
  check('src dropped so audio stops', t.frame().getAttribute('src'), 'null');
  check('frame hidden', t.frame().style.display, 'none');

  console.log('\n=== Bunny again after YouTube ===');
  t.watches[0].click();
  check('source flips back', t.player.getAttribute('data-videopop-source'), 'bunny');
  check('youtube attr cleared', t.player.getAttribute('data-videopop-youtube'), 'null');
  check('frame still srcless', t.frame().getAttribute('src'), 'null');
  check('?watch= bare guid', t.watchParam(), GUID);

  console.log('\n=== card poster hydration ===');
  const posters = t.d.querySelectorAll('[data-videoinline-poster-img]');
  check('Bunny card -> b-cdn thumbnail', /b-cdn\.net\/.*thumbnail\.jpg/.test(posters[0].src), 'true');
  check('YouTube card -> ytimg still', /i\.ytimg\.com\/vi\/dQw4w9WgXcQ\/hqdefault\.jpg/.test(posters[1].src), 'true');

  console.log('\n=== cold load: shared ?watch=yt: link ===');
  const c = boot('https://verbitam.test/?watch=yt:dQw4w9WgXcQ');
  c.window.__popupRouter.restoreFromUrl();
  check('restores in youtube mode', c.player.getAttribute('data-videopop-source'), 'youtube');
  check('iframe points at that video', /embed\/dQw4w9WgXcQ/.test(c.frame().src), 'true');
  check('title from matching card', c.title(), 'YouTube Clip');
  check('popup visible', c.d.querySelector('[data-videopop]').style.visibility, 'visible');

  console.log('\n=== cold load: id with no matching card ===');
  const n = boot('https://verbitam.test/?watch=yt:aBcDeFgHiJk');
  n.window.__popupRouter.restoreFromUrl();
  check('still opens', /embed\/aBcDeFgHiJk/.test(n.frame().src), 'true');
  check('no stale title inherited', n.title(), '');
  check('no stale bunny guid', n.player.getAttribute('data-videopop-id'), 'null');

  console.log('\n=== cold-landed popup: close must notify the router ===');
  // Regression: restoreFromUrl opens the popup inside runSuppressed(), so
  // isSuppressed() is true. currentGuid used to be assigned inside the
  // `!isSuppressed()` block, so it stayed null for a restored popup and
  // closePopup's `if (hadGuid)` skipped router.close() entirely — the overlay
  // hid, ?watch= stayed in the URL, and `current` stayed set in the router,
  // which then poisoned every later open/close cycle.
  const k = boot('https://verbitam.test/?watch=yt:dQw4w9WgXcQ');
  k.window.__popupRouter.restoreFromUrl();
  k.d.querySelector('[data-videopop-close]').click();
  await settle();
  check('cold close strips ?watch=', k.watchParam(), 'null');
  check('cold close clears history.state', k.window.history.state, 'null');

  // And the cycle after it must still push, not replace onto a dirty entry.
  const lenBefore = k.window.history.length;
  k.watches[1].click();
  await settle();
  check('next open pushes a new entry', k.window.history.length > lenBefore, 'true');
  k.d.querySelector('[data-videopop-close]').click();
  await settle();
  check('and closes clean', k.watchParam(), 'null');

  console.log(fails ? `\n${fails} FAILING` : '\nAll assertions passed');
  process.exit(fails ? 1 : 0);
};
run();
