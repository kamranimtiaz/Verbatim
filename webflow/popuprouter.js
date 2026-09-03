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
 * The router owns at most ONE history entry, ever. The first open pushes it;
 * opening a second article from inside an open popup replaces it, so Back
 * lands on the page the user came from instead of walking back through a
 * chain of articles. Closing does not consume the entry — it empties it in
 * place and remembers that it is still ours, so the next open reuses it and
 * repeated open/close cycles never stack up dead entries.
 *
 * Closing NEVER traverses history; see the long note on close() for why that
 * ejected iOS visitors to about:blank. Everything the router writes carries a
 * marker in history.state, so it can tell its own entries from Webflow's
 * normal page navigations.
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

  // Set while the router itself is driving a popup open/close, so the handlers
  // it calls can skip re-entering the router and pushing a second entry.
  var suppress = false;

  // True when the current history entry is one we wrote and then emptied on
  // close. The next open reuses it instead of stacking a new one, which caps
  // the router's history footprint at exactly one entry however many popups
  // are opened and closed.
  //
  // Deliberately NOT stored in history.state: state survives a reload, and a
  // stale flag would make the first open after a refresh replace the page's
  // own entry — Back would then leave the site instead of closing the popup.
  var ownsCurrentEntry = false;

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

    // Reuse the current entry whenever it is already ours, and push only when
    // standing on a genuine page entry. Two cases are ours:
    //
    //   history.state carries our marker — a live popup. The chain of articles
    //     a reader clicks through inside the overlay collapses to one Back
    //     press instead of one per article.
    //   ownsCurrentEntry — an entry we wrote and emptied on close. Reusing it
    //     is what stops repeated open/close cycles stacking dead entries.
    //
    // history.state is the authoritative test, so this no longer corroborates
    // against `current`. A stale `current` therefore cannot cause a replace
    // over the last clean entry.
    var st = window.history.state;
    if (replace || (st && st[MARKER]) || ownsCurrentEntry) {
      window.history.replaceState(payload, '', resolved);
    } else {
      window.history.pushState(payload, '', resolved);
    }

    ownsCurrentEntry = false;
    current = entry;
  }

  /**
   * Announce that a popup closed. Restores the pre-popup URL.
   *
   * NEVER TRAVERSES HISTORY
   * -----------------------
   * This used to call back() to consume the entry it had pushed. That assumed
   * the entry immediately behind was the clean pre-popup page — an assumption
   * nothing can verify, and one iOS breaks two ways:
   *
   *   The YouTube <iframe> pushes into the same joint session history that
   *     back() walks, so back() rewound the frame rather than the page. Chrome
   *     on desktop usually discards those via its history-manipulation
   *     intervention; iOS Chrome is WebKit and does not.
   *   A same-document traversal completes on a later task than setTimeout(0)
   *     on WebKit, so the old verify-and-repair timer fired mid-traversal,
   *     concluded the close had failed, and replaceState'd the entry it was in
   *     the middle of leaving — leaving a phantom duplicate behind.
   *
   * Each cycle drifted the count by one until back() walked off the front of
   * the list and the tab fell through to about:blank, ejecting the visitor
   * from the site. replaceState cannot navigate, so it cannot overshoot.
   *
   * The entry is emptied rather than consumed, and ownsCurrentEntry marks it
   * so the next open reuses it instead of stacking another.
   */
  function close(name) {
    if (suppress) return;
    if (!current || (name && current.kind !== name)) return;

    current = null;

    // Also the correct behaviour for a cold-loaded shared link, which the old
    // wasLanding branch handled with this exact call: Back then leaves the
    // site, as it should for an entry the visitor arrived on.
    window.history.replaceState(null, '', baseUrl);
    ownsCurrentEntry = true;
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
    // Any traversal lands us on a different entry, so whatever we owned before
    // is no longer the one we are standing on.
    ownsCurrentEntry = false;

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
