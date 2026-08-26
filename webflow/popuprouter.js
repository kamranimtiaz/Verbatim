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

  // The URL to restore when every popup is closed. Captured once at load, so
  // it is the page the visitor actually arrived on, not whatever a popup
  // rewrote it to since.
  var baseUrl = window.location.href;

  // Registered popup kinds, in priority order of who gets asked to close first.
  // { name, close(), openFromUrl(state), matches(url) -> state|null }
  var kinds = [];

  // The popup state currently reflected in the address bar, or null.
  // { kind, state, url }
  var current = null;

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
    if (replace || current) {
      window.history.replaceState(payload, '', resolved);
    } else {
      window.history.pushState(payload, '', resolved);
    }

    current = entry;
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
    current = null;

    var st = window.history.state;
    if (st && st[MARKER] && st[MARKER].url === entry.url) {
      // popstate fires next tick; the handler sees current === null and so
      // does not try to close anything a second time.
      window.history.back();
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
    getBaseUrl: function () { return baseUrl; }
  };

  // Run after the popup scripts have had a chance to register. They init on
  // DOMContentLoaded, so restoring on `load` guarantees registration first.
  window.addEventListener('load', function () {
    restoreFromUrl();
  });
})();
