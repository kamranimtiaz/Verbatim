/**
 * cardmode.js — decides whether a `.card_player` behaves as an inline player
 * or as a video-popup opener.
 *
 * THE CONDITIONAL: the presence of the `<video data-videoinline-video>` child.
 * Webflow strips that element in popup mode, so its presence *is* the mode.
 * Nothing else needs to be authored per instance.
 *
 * Inline  → add `data-videoinline-player` to the card and `data-card-play` to
 *           the WATCH button; videoinline.js claims both.
 * Popup   → copy the card's GUID/title onto the WATCH button as
 *           `data-videopop-*`; videopopup.js binds it as an opener.
 *
 * The WATCH button therefore has no fixed role in Webflow — the same button is
 * a play trigger in one mode and a popup opener in the other, and exactly one
 * of those two attributes is ever present on it.
 *
 * LOAD ORDER MATTERS. videopopup.js binds openers once, at its own init, over
 * whatever `[data-videopop-open]` elements exist at that moment. This file must
 * run first or the attributes appear too late to be seen:
 *
 *   cardmode.js  →  videopopup.js  →  videoinline.js
 */
(function () {
  // Set true to make the whole poster clickable in popup mode, not just WATCH.
  const CLICK_ANYWHERE = true;

  const CARD = '.card_player';
  const WATCH = '.card_watch';
  const VIDEO = '[data-videoinline-video]';

  const init = () => {
    document.querySelectorAll(CARD).forEach((card) => {
      if (card.dataset.cardModeInit) return;
      card.dataset.cardModeInit = 'true';

      const video = card.querySelector(VIDEO);
      const isInline = !!video;

      // Guard against the most likely build mistake. Webflow's Style-panel
      // "Hide" sets `display:none` and LEAVES the node in the DOM, so the card
      // reads as inline and the popup silently never opens. Only component
      // visibility properties / CMS conditional visibility remove the node.
      if (video && typeof getComputedStyle === 'function') {
        const hidden =
          getComputedStyle(video).display === 'none' ||
          !video.getClientRects().length;
        if (hidden) {
          console.warn(
            '[cardmode] <video> is present but hidden, so this card is being ' +
            'treated as INLINE and its popup will never open. Webflow must ' +
            'REMOVE the element (visibility property / conditional visibility), ' +
            'not hide it with display:none.',
            card
          );
        }
      }

      if (isInline) {
        // videoinline.js selects on this attribute; it re-scans on window.load,
        // so setting it here is picked up regardless of which file ran first.
        card.setAttribute('data-videoinline-player', '');

        // WATCH is a play trigger here and a popup opener in the other mode,
        // so it cannot be authored with a fixed role in Webflow. Stamp the
        // inline role now; videoinline.js binds `[data-card-play]` alongside
        // its own `[data-videoinline-playpause]` controls, and re-scans on
        // window.load, so load order does not matter.
        const watch = card.querySelector(WATCH);
        if (watch) {
          watch.setAttribute('data-card-play', '');
          // Defensive: if this card was ever stamped for popup, drop it, so a
          // mode change can never leave the button wired to both paths.
          watch.removeAttribute('data-videopop-open');
        } else {
          console.warn('[cardmode] inline card has no ' + WATCH, card);
        }
        return;
      }

      // --- Popup mode ---------------------------------------------------
      // videopopup.js reads the GUID and title off the *opener* element
      // (opener.dataset.videoId / .videopopTitle), so the card's own data is
      // promoted onto the button. This keeps the CMS binding in one place on
      // the card. `data-video-id` is the same generic name the inline player
      // reads, so one CMS field feeds both modes.
      const guid = card.getAttribute('data-video-id');
      if (!guid) {
        console.warn('[cardmode] popup card has no data-video-id', card);
        return;
      }

      const watch = card.querySelector(WATCH);
      if (!watch) {
        console.warn('[cardmode] popup card has no ' + WATCH, card);
        return;
      }

      watch.setAttribute('data-videopop-open', '');
      watch.removeAttribute('data-card-play'); // never both roles at once
      watch.setAttribute('data-video-id', guid);
      watch.setAttribute('data-videopop-title', card.getAttribute('data-video-title') || '');

      if (CLICK_ANYWHERE) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
          // The button handles its own clicks; forwarding would double-fire.
          if (e.target.closest(WATCH)) return;
          watch.click();
        });
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
