/**
 * popuprouter.js — shared URL <-> popup state for the Verbitam site.
 *
 * Gives the non-SPA Webflow site an SPA-like address bar: opening a popup
 * rewrites the URL to something shareable, Back closes it again.
 *
 * WHY REAL PATHS AND NOT `#slug`
 * ------------------------------
 * Article popups fetch a real Webflow CMS page ([data-content] on
 * /full-investigation-page/<slug>), so that page already exists, is already
 * indexed, and already has its own OG tags. Pushing that same path means a
 * shared link resolves server-side to the real article: Google indexes it and
 * Slack/iMessage/X unfurl the correct title and image. A fragment (#slug) is
 * never sent to the server, so every shared link would preview as the generic
 * homepage and no article would ever be indexed.
 *
 * Videos are the exception — a video has no page of its own — so those use a
 * query param (?watch=<guid>) layered on whatever page is showing.
 *
 * COLD LOADS ARE DELIBERATELY NOT INTERCEPTED
 * -------------------------------------------
 * Landing directly on /full-investigation-page/<slug> serves the standalone
 * Webflow page. We do NOT bounce to "/" and re-open it as a popup: that costs a
 * redirect plus a second fetch of content the browser already has, and the
 * crawler/unfurler sees the standalone page regardless. Popups are for
 * navigation *within* the site. Cold ?watch= loads DO restore, since there is
 * no standalone page to fall back to.
 *
 * HISTORY MODEL
 * -------------
 * One popup open == exactly one pushState. Opening a second article from inside
 * an open popup replaces rather than pushes, so Back always lands on the page
 * the user came from instead of walking back through a chain of articles.
 * Everything the router pushes carries a marker in history.state, so it can
 * tell its own entries from Webflow's normal page navigations.
 */
(function () {
  if (window.__popupRouter) return;

  var MARKER = 'verbitamPopup';

  // The URL to restore when every popup is closed. Captured at load, so it is
  // the page the visitor actually arrived on, not whatever a popup rewrote it
  // to since.
  //
  // It must never keep a popup's own param. A visitor landing on a shared
  // ?watch= link captures a DIRTY base here — this script evaluates before any
  // kind has registered, so there is nothing yet that knows `watch` is a popup
  // param. register() re-cleans it as soon as a kind can say so; without that,
  // every close after the first "restores" the URL back to the landing param.
  var baseUrl = window.location.href;

  // Registered popup kinds, in priority order of who gets asked to close first.
  // { name, close(), openFromUrl(state), matches(url) -> state|null }
  var kinds = [];

  // The popup state currently reflected in the address bar, or null.
  // { kind, state, url }
  var current = null;

  // True when `current` is the entry the visitor LANDED on (a shared ?watch=
  // link opened cold), rather than one we pushed. There is nothing behind it
  // to go back to, so closing must rewrite in place instead of calling back()
  // — see the note in close().
  var currentIsLanding = false;

  // Set while the router itself is driving a popup open/close, so the handlers
  // it calls can skip re-entering the router and pushing a second entry.
  var suppress = false;

  /** True while the router is applying a URL change, so popups stay quiet. */
  function isSuppressed() {
    return suppress;
  }

  function runSuppressed(fn) {
    var prev = suppress;
    suppress = true;
    try {
      fn();
    } finally {
      suppress = prev;
    }
  }

  /**
   * Register a popup type with the router.
   *
   *   name        stable id stored in history.state
   *   matches     (URL) -> state object if this URL represents an open popup
   *   open        (state) -> void, restore the popup for that state
   *   close       () -> void, close the popup without touching history
   */
  function register(kind) {
    kinds.push(kind);

    // Strip this kind's param from the base captured at script-eval, when no
    // kind had yet registered to identify it. Safe to repeat: cleanUrl only
    // removes what its own popup owns, and is a no-op once already gone.
    if (kind.cleanUrl) {
      try {
        var clean = new URL(baseUrl);
        kind.cleanUrl(clean);
        baseUrl = clean.href;
      } catch (e) {
        console.warn('[popuprouter] cleanUrl failed for ' + kind.name + ':', e);
      }
    }

  }

  /**
   * Announce that a popup just opened. Rewrites the address bar.
   *
   *   url      the shareable URL for this popup
   *   replace  true to overwrite the current entry instead of adding one —
   *            used when a popup opens from inside another popup
   */
  function open(name, state, url, replace) {
    if (suppress) return;

    var resolved = new URL(url, window.location.href).href;
    var entry = { kind: name, state: state, url: resolved };
    var payload = {};
    payload[MARKER] = entry;

    // Replace when we are already showing a popup: the chain of articles a
    // reader clicks through inside the overlay should collapse to one Back
    // press, not one per article.
    //
    // `current` alone is not enough to prove that. If a popup ever closes
    // without telling us, `current` goes stale, and replacing on a stale value
    // overwrites the last CLEAN entry — leaving nothing to go back to and
    // making the param impossible to shed. Corroborate against history.state:
    // a real chain has our marker on the current entry. Anything else falls
    // through to pushState, which is always recoverable.
    var st = window.history.state;
    var chaining = !!(current && st && st[MARKER] && st[MARKER].url === current.url);

    if (replace || chaining) {
      window.history.replaceState(payload, '', resolved);
    } else {
      window.history.pushState(payload, '', resolved);
    }

    current = entry;
    currentIsLanding = false;
  }

  /**
   * Announce that a popup closed. Restores the pre-popup URL.
   *
   * Uses back() when the top history entry is one of ours, so the entry is
   * consumed rather than left behind — otherwise closing a popup with the X and
   * then pressing Back would re-open it.
   */
  function close(name) {
    if (suppress) return;
    if (!current || (name && current.kind !== name)) return;

    var entry = current;
    var wasLanding = currentIsLanding;
    current = null;
    currentIsLanding = false;

    var st = window.history.state;
    // A landing entry has nothing behind it: back() would either be ignored
    // (leaving ?watch= in the address bar) or walk the visitor off the site.
    // Rewrite it in place instead — Back then leaves, which is correct for a
    // link opened cold.
    if (wasLanding) {
      window.history.replaceState(null, '', baseUrl);
    } else if (st && st[MARKER] && st[MARKER].url === entry.url) {
      // popstate fires next tick; the handler sees current === null and so
      // does not try to close anything a second time.
      window.history.back();

      // back() is a request, not a guarantee: the entry behind may not be the
      // clean page (a mis-tracked open can overwrite it), and Chrome's
      // history-manipulation intervention can decline the call outright. Both
      // strand the visitor on a popup URL. Verify on the next turn and rewrite
      // in place if we are still dirty — `current` is null by then, so this
      // cannot fight a popup that has legitimately reopened since.
      var expected = entry.url;
      window.setTimeout(function () {
        if (current) return;
        if (window.location.href !== expected) return;
        window.history.replaceState(null, '', baseUrl);
      }, 0);
    } else {
      window.history.replaceState(null, '', baseUrl);
    }
  }

  /** Ask every registered popup to close, without writing history. */
  function closeAllSuppressed() {
    runSuppressed(function () {
      kinds.forEach(function (kind) {
        try {
          kind.close();
        } catch (e) {
          console.warn('[popuprouter] close failed for ' + kind.name + ':', e);
        }
      });
    });
  }

  window.addEventListener('popstate', function (event) {
    var st = event.state;
    var entry = st && st[MARKER];

    if (entry) {
      // Forward into (or back to) a popup URL.
      if (current && current.url === entry.url) return;
      closeAllSuppressed();
      current = entry;
      currentIsLanding = false;
      var kind = kinds.filter(function (k) { return k.name === entry.kind; })[0];
      if (kind) {
        runSuppressed(function () {
          kind.open(entry.state);
        });
      }
      return;
    }

    // Back out of every popup URL — this is the Back button dismissing the
    // overlay. If nothing is open, the browser is navigating normally and the
    // router must not interfere.
    if (current) {
      current = null;
      currentIsLanding = false;
      closeAllSuppressed();
    }
  });

  /**
   * Restore a popup from the URL the visitor landed on.
   *
   * Only kinds that opt in via `restoreOnLoad` are considered. Article popups
   * do not: their URL is a real page that has already rendered. Video popups
   * do, since ?watch= has nothing to render on its own.
   */
  function restoreFromUrl() {
    var url = new URL(window.location.href);

    for (var i = 0; i < kinds.length; i++) {
      var kind = kinds[i];
      if (!kind.restoreOnLoad) continue;

      var state = null;
      try {
        state = kind.matches(url);
      } catch (e) {
        console.warn('[popuprouter] matches failed for ' + kind.name + ':', e);
      }
      if (!state) continue;

      // The landing URL already carries the popup, so it IS the entry to
      // return to — mark it in place rather than pushing a duplicate. Back
      // then leaves the site, which is correct for a link opened cold.
      var payload = {};
      payload[MARKER] = { kind: kind.name, state: state, url: window.location.href };
      window.history.replaceState(payload, '', window.location.href);
      current = payload[MARKER];
      currentIsLanding = true;

      // baseUrl must not keep the popup param, or closing would restore a URL
      // that immediately looks "open" again.
      var clean = new URL(window.location.href);
      if (kind.cleanUrl) kind.cleanUrl(clean);
      baseUrl = clean.href;

      var target = kind;
      var restoreState = state;
      runSuppressed(function () {
        try {
          target.open(restoreState);
        } catch (e) {
          console.warn('[popuprouter] restore failed for ' + target.name + ':', e);
        }
      });
      return true;
    }
    return false;
  }

  window.__popupRouter = {
    register: register,
    open: open,
    close: close,
    isSuppressed: isSuppressed,
    restoreFromUrl: restoreFromUrl,
    scrubUnclaimedParams: scrubUnclaimedParams,
    getBaseUrl: function () { return baseUrl; }
  };

  /**
   * Drop popup params that no kind claimed from the CURRENT history entry.
   *
   * A visitor can land on a ?watch= link that nothing restores — the id matched
   * no card, or the kind does not restore on load. The param then sits in the
   * landing history entry, and close()'s back() would later drop the visitor
   * right back onto it: the popup closes, the URL reverts, and it looks like
   * cleanup silently stopped working after the first close.
   *
   * Only runs when no popup is open, so a live ?watch= is never disturbed.
   */
  function scrubUnclaimedParams() {
    if (current) return;
    var url = new URL(window.location.href);
    var before = url.href;
    kinds.forEach(function (kind) {
      if (!kind.cleanUrl) return;
      try {
        kind.cleanUrl(url);
      } catch (e) {
        console.warn('[popuprouter] cleanUrl failed for ' + kind.name + ':', e);
      }
    });
    if (url.href !== before) {
      window.history.replaceState(window.history.state, '', url.href);
    }
    baseUrl = url.href;
  }

  // Run after the popup scripts have had a chance to register. They init on
  // DOMContentLoaded, so restoring on `load` guarantees registration first.
  window.addEventListener('load', function () {
    // Only scrub what the restore did NOT claim: if it opened a popup, the
    // param is live and `current` is set, so the scrub is a no-op.
    restoreFromUrl();
    scrubUnclaimedParams();
  });
})();
