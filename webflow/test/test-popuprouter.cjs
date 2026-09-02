/**
 * test-popuprouter.cjs — history semantics for popuprouter.js.
 *
 * Runs the real router against a minimal window/history stub rather than jsdom,
 * because the behaviour under test is entirely push/replace/back bookkeeping:
 * no DOM is involved and jsdom's history is not scriptable enough to assert on.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'popuprouter.js'), 'utf8');
const BASE = 'https://verbitam.com/';

/** A history stack that behaves like the browser's for push/replace/back. */
function makeEnv(startUrl = BASE) {
  const listeners = {};
  const stack = [{ url: startUrl, state: null }];
  let index = 0;

  const win = {
    location: { get href() { return stack[index].url; } },
    history: {
      get state() { return stack[index].state; },
      pushState(state, _t, url) {
        stack.length = index + 1;
        stack.push({ url: new URL(url, stack[index].url).href, state });
        index++;
      },
      replaceState(state, _t, url) {
        stack[index] = { url: new URL(url, stack[index].url).href, state };
      },
      back() {
        if (index === 0) return;
        index--;
        // Real browsers fire popstate asynchronously.
        queueMicrotask(() =>
          (listeners.popstate || []).forEach((fn) => fn({ state: stack[index].state }))
        );
      },
      forward() {
        if (index >= stack.length - 1) return;
        index++;
        // Real browsers fire popstate asynchronously.
        queueMicrotask(() =>
          (listeners.popstate || []).forEach((fn) => fn({ state: stack[index].state }))
        );
      }
    },
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    // close() schedules a verification pass on the next turn; the router
    // reaches for it as window.setTimeout.
    setTimeout,
    URL,
    console
  };
  win.window = win;
  return {
    win,
    stack,
    url: () => stack[index].url,
    // Entries behind the pointer, i.e. how many Back presses the user owes.
    depth: () => index + 1,
    length: () => stack.length
  };
}

/** Evaluate popuprouter.js with `window` bound to the stub. */
function loadRouter(env) {
  new Function('window', 'URL', 'console', SRC)(env.win, URL, console);
  return env.win.__popupRouter;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/** A fake popup that records what the router asks it to do. */
function fakeKind(name, opts = {}) {
  return {
    name,
    restoreOnLoad: opts.restoreOnLoad || false,
    matches: opts.matches || (() => null),
    cleanUrl: opts.cleanUrl,
    opened: [],
    closed: 0,
    open(state) { this.opened.push(state); },
    close() { this.closed++; }
  };
}

let failures = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log('  ok   ' + name);
  } catch (e) {
    failures++;
    console.log('  FAIL ' + name + '\n       ' + e.message);
  }
}

(async () => {
  console.log('popuprouter history semantics\n');

  await test('opening an article pushes its real path', () => {
    const env = makeEnv();
    const r = loadRouter(env);
    r.register(fakeKind('article'));
    r.open('article', { href: BASE + 'a' }, BASE + 'a');
    assert.strictEqual(env.url(), BASE + 'a');
    assert.strictEqual(env.depth(), 2, 'should add exactly one history entry');
  });

  await test('a second article REPLACES rather than stacking', () => {
    const env = makeEnv();
    const r = loadRouter(env);
    r.register(fakeKind('article'));
    r.open('article', { href: BASE + 'a' }, BASE + 'a');
    r.open('article', { href: BASE + 'b' }, BASE + 'b');
    assert.strictEqual(env.url(), BASE + 'b');
    assert.strictEqual(env.depth(), 2, 'reading a chain must collapse to one Back press');
  });

  await test('close restores the base URL and consumes the entry', async () => {
    const env = makeEnv();
    const r = loadRouter(env);
    r.register(fakeKind('article'));
    r.open('article', { href: BASE + 'a' }, BASE + 'a');
    r.close('article');
    await tick();
    assert.strictEqual(env.url(), BASE, 'URL should return to the landing page');
    // back() rewinds the pointer to the landing entry; the popup entry stays
    // ahead of it as a forward entry, exactly as in a real browser.
    assert.strictEqual(env.depth(), 1, 'closing must not leave the user a Back press deep');
  });

  await test('closing via X does not leave an entry Back can re-open', async () => {
    const env = makeEnv();
    const r = loadRouter(env);
    const article = fakeKind('article');
    r.register(article);
    r.open('article', { href: BASE + 'a' }, BASE + 'a');
    r.close('article');
    await tick();
    article.opened.length = 0;
    // Nothing left to go back to, so the popup must not reappear.
    env.win.history.back();
    await tick();
    assert.deepStrictEqual(article.opened, [], 'Back must not re-open a closed popup');
  });

  await test('Back closes an open popup', async () => {
    const env = makeEnv();
    const r = loadRouter(env);
    const article = fakeKind('article');
    r.register(article);
    r.open('article', { href: BASE + 'a' }, BASE + 'a');
    env.win.history.back();
    await tick();
    assert.strictEqual(article.closed, 1, 'Back should close the popup');
    assert.strictEqual(env.url(), BASE);
  });

  await test('Forward re-opens the popup', async () => {
    const env = makeEnv();
    const r = loadRouter(env);
    const article = fakeKind('article');
    r.register(article);
    r.open('article', { href: BASE + 'a' }, BASE + 'a');
    env.win.history.back();
    await tick();
    assert.strictEqual(article.closed, 1);
    article.opened.length = 0;
    env.win.history.forward();
    await tick();
    assert.deepStrictEqual(
      article.opened,
      [{ href: BASE + 'a' }],
      'Forward should restore the popup it closed'
    );
    assert.strictEqual(env.url(), BASE + 'a');
  });

  await test('video open writes ?watch= and close strips it', async () => {
    const env = makeEnv();
    const r = loadRouter(env);
    r.register(fakeKind('video'));
    r.open('video', { guid: 'g1' }, BASE + '?watch=g1');
    assert.strictEqual(env.url(), BASE + '?watch=g1');
    r.close('video');
    await tick();
    assert.strictEqual(env.url(), BASE, '?watch= must not survive close');
  });

  await test('Read handoff replaces the video entry with the article', () => {
    const env = makeEnv();
    const r = loadRouter(env);
    r.register(fakeKind('video'));
    r.register(fakeKind('article'));
    r.open('video', { guid: 'g1' }, BASE + '?watch=g1');
    // videopopup closes silently, so `current` is still set -> replace.
    r.open('article', { href: BASE + 'a' }, BASE + 'a');
    assert.strictEqual(env.url(), BASE + 'a');
    assert.strictEqual(env.depth(), 2, 'watch->read must be one Back press, not two');
  });

  await test('cold ?watch= load restores the video without adding an entry', () => {
    const env = makeEnv(BASE + '?watch=g9');
    const r = loadRouter(env);
    const video = fakeKind('video', {
      restoreOnLoad: true,
      matches: (url) => {
        const g = url.searchParams.get('watch');
        return g ? { guid: g } : null;
      },
      cleanUrl: (url) => url.searchParams.delete('watch')
    });
    r.register(video);
    assert.strictEqual(r.restoreFromUrl(), true);
    assert.deepStrictEqual(video.opened, [{ guid: 'g9' }]);
    assert.strictEqual(env.depth(), 1, 'a cold load must not push a duplicate entry');
    assert.strictEqual(r.getBaseUrl(), BASE, 'base URL must drop ?watch=');
  });

  await test('closing a COLD-LOADED ?watch= link strips the param', async () => {
    // Regression: restoreFromUrl marks the LANDING entry as the popup, so
    // there is nothing behind it. close() used to call history.back(), which
    // at index 0 is ignored — the popup hid but ?watch= stayed in the address
    // bar, and reloading re-opened it. Landing entries must rewrite in place.
    const env = makeEnv(BASE + '?watch=yt%3AVYg5EpGZFWg');
    const r = loadRouter(env);
    const kind = fakeKind('video', {
      restoreOnLoad: true,
      matches: (u) => (u.searchParams.get('watch') ? { guid: u.searchParams.get('watch') } : null),
      cleanUrl: (u) => u.searchParams.delete('watch')
    });
    r.register(kind);
    r.restoreFromUrl();
    assert.strictEqual(kind.opened.length, 1, 'cold link should restore the popup');
    r.close('video');
    await tick();
    assert.strictEqual(env.url(), BASE, '?watch= must be gone after close');
    assert.strictEqual(env.depth(), 1, 'must not strand the visitor off-site');
  });

  await test('every close after a cold ?watch= landing stays clean', async () => {
    // Regression: baseUrl is captured at script-eval, before any kind has
    // registered to say `watch` is a popup param — so landing on a shared link
    // captured a DIRTY base, and the landing history entry kept the param too.
    // The first close worked (landing branch), but every close after it either
    // restored the stale baseUrl or had back() drop the visitor onto the dirty
    // landing entry. Symptom: the same old ?watch= id reappears on close #2+.
    const dirty = BASE + '?watch=yt%3AVYg5EpGZFWg';
    const env = makeEnv(dirty);
    const r = loadRouter(env);
    // A kind that does NOT restore, so nothing claims the landing param.
    r.register(fakeKind('video', { cleanUrl: (u) => u.searchParams.delete('watch') }));
    // What the load listener does, in order.
    r.restoreFromUrl();
    r.scrubUnclaimedParams();
    assert.strictEqual(env.url(), BASE, 'unclaimed landing param must be scrubbed');

    for (let n = 2; n <= 4; n++) {
      r.open('video', { guid: 'yt:V' + n }, BASE + '?watch=yt%3AV' + n);
      r.close('video');
      await tick();
      assert.strictEqual(env.url(), BASE, `close #${n} must strip ?watch=`);
    }
  });

  await test('a stale `current` does not replace the last clean entry', async () => {
    // Hardening: if a popup ever closes without telling the router, `current`
    // goes stale. open() used to treat that as "chaining" and replaceState
    // over the clean entry, leaving nothing to go back to — one missed call
    // turned into a permanently stuck param. history.state must corroborate.
    const env = makeEnv();
    const r = loadRouter(env);
    r.register(fakeKind('video', { cleanUrl: (u) => u.searchParams.delete('watch') }));

    r.open('video', { guid: 'A' }, BASE + '?watch=A');
    const lenAfterFirst = env.length();
    // Simulate the popup hiding itself without calling router.close():
    // history.state still carries A's marker, but the user navigated onward.
    env.win.history.replaceState(null, '', BASE);

    r.open('video', { guid: 'B' }, BASE + '?watch=B');
    assert.ok(
      env.length() > lenAfterFirst,
      'stale `current` must fall through to pushState, not replace the clean entry'
    );

    r.close('video');
    await tick();
    assert.strictEqual(env.url(), BASE, 'close must still land clean');
  });

  await test('cold article URL is NOT hijacked into a popup', () => {
    const env = makeEnv(BASE + 'full-investigation-page/who-funds-the-funders');
    const r = loadRouter(env);
    const article = fakeKind('article', { restoreOnLoad: false });
    r.register(article);
    assert.strictEqual(r.restoreFromUrl(), false);
    assert.deepStrictEqual(article.opened, [], 'the standalone page must render as itself');
  });

  await test('restoring from the URL does not re-push (suppression works)', () => {
    const env = makeEnv(BASE + '?watch=g9');
    const r = loadRouter(env);
    const video = fakeKind('video', {
      restoreOnLoad: true,
      matches: (url) => {
        const g = url.searchParams.get('watch');
        return g ? { guid: g } : null;
      },
      cleanUrl: (url) => url.searchParams.delete('watch')
    });
    // The real popup calls router.open() from inside its own open path; while
    // restoring that must be a no-op or the entry doubles.
    video.open = function (state) {
      this.opened.push(state);
      r.open('video', state, BASE + '?watch=' + state.guid);
    };
    r.register(video);
    r.restoreFromUrl();
    assert.strictEqual(env.depth(), 1, 'suppressed open must not push');
  });

  console.log('\n' + (failures ? failures + ' failing' : 'all passing'));
  process.exit(failures ? 1 : 0);
})();
