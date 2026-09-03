/**
 * videopopup.js — modal video player + card openers
 * ---------------------------------------------------------------------------
 * MODE CONTRACT (one attribute, authored in Webflow, no JS shim)
 *
 *   [data-player][data-videoinline-player]  -> INLINE  (videoinline.js)
 *   [data-player]  without that attribute   -> POPUP   (this file)
 *
 * This file discovers its own openers. Nothing has to stamp attributes onto
 * the card first, so there is no load-order dependency between the two files.
 *
 * An opener is either:
 *   1. `[data-card-watch]` inside a `[data-player]` that is NOT flagged inline, or
 *   2. any element carrying `[data-videopop-open]` (hero buttons, links, …).
 *
 * The GUID and title are read from the opener first and from its owning
 * `[data-player]` second, so a card only needs `data-video-id` /
 * `data-video-title` — the same fields the inline player uses. One CMS binding
 * feeds both modes.
 *
 * SOURCE CONTRACT (Bunny vs YouTube — one attribute, no second code path)
 *
 *   data-video-youtube="<any YouTube URL or bare id>"  on the card or opener
 *
 * Present  -> YOUTUBE mode: an <iframe> is mounted and YouTube draws its own
 *             controls. No IFrame API is loaded, so there is no second
 *             play/seek/volume system to keep in sync.
 * Absent   -> BUNNY mode: the <video> element plus all the chrome below.
 *
 * The mode is published as `data-videopop-source="bunny"|"youtube"` on
 * [data-videopop-player]. WHICH ELEMENTS HIDE IS DECIDED IN CSS, NOT HERE —
 * see youtube-mode.css. To hide one more thing in YouTube mode, add a
 * selector there; this file does not need to change.
 *
 * Shared links: ?watch=<guid> for Bunny, ?watch=yt:<id> for YouTube. One
 * param, one router kind — the 11-char YouTube charset cannot collide with a
 * Bunny UUID.
 *
 * ICONS — found by attribute, styled by class:
 *   data-videopop-icon="play" | "pause" | "volume-up" | "volume-mute"
 *                     | "maximise" | "minimise"
 *
 *   Every match inside the component is toggled, and the "shown" display value
 *   is read from the stylesheet at init rather than hard-coded to `block`, so
 *   flex-centred icons keep their centring.
 * ---------------------------------------------------------------------------
 */
(function () {
  // --- Shared scroll lock ------------------------------------------------------
  // Installed by whichever popup script runs first; both use the same counter so
  // closing one popup can't unlock the page while another is still open.
  // Mirrors the .hero-intro-lock rule in webflow.js.
  (function () {
    if (window.__popupScrollLock) return;

    var depth = 0;
    var scrollY = 0;

    var style = document.createElement('style');
    style.setAttribute('data-popup-scroll-lock', '');
    style.textContent =
      'html.popup-scroll-lock, html.popup-scroll-lock body { overflow: hidden; }' +
      // position:fixed is what actually holds iOS still; overflow alone is ignored.
      'html.popup-scroll-lock body { position: fixed; width: 100%; touch-action: none; }';
    (document.head || document.documentElement).appendChild(style);

    window.__popupScrollLock = {
      lock: function () {
        if (++depth > 1) return;
        scrollY = window.scrollY || window.pageYOffset || 0;
        document.body.style.top = -scrollY + 'px';
        document.documentElement.classList.add('popup-scroll-lock');
      },
      unlock: function () {
        if (depth === 0 || --depth > 0) return;
        document.documentElement.classList.remove('popup-scroll-lock');
        document.body.style.top = '';
        // body was fixed, so the page jumped to the top — put it back.
        window.scrollTo(0, scrollY);
      }
    };
  })();

  const CARD = '[data-player]';
  const INLINE_FLAG = '[data-videoinline-player]';
  const WATCH = '[data-card-watch]';
  const POPUP_CARD = `${CARD}:not(${INLINE_FLAG})`;

  // The whole thumbnail area, authored in Webflow on the wrapper. Clicking it
  // does the card's main thing; the controls sitting on top keep their own.
  const CLICK_AREA = '[data-card-click]';

  // A click landing on any of these belongs to that control, not to the area.
  // It is a list rather than a stopPropagation() at each control so a control
  // added later inherits the behaviour with no code change here.
  // NOTE: duplicated in videoinline.js — edit one, edit both.
  // <video> is deliberately absent: without `controls` it has no default click
  // behaviour, and listing it would kill click-to-pause on inline cards.
  const INTERACTIVE =
    'a, button, input, select, textarea, label, summary, ' +
    '[role="button"], [role="link"], [onclick], ' +
    '[data-card-watch], [data-popup-open], [data-videopop-open], ' +
    '[data-videoinline-playpause], [data-videoinline-timeline], ' +
    '[data-videoinline-volume], [data-videoinline-mute], ' +
    '[data-videoinline-fullscreen]';

  // A press that travels further than this was a scrub or a text drag.
  const DRAG_SLOP = 6;

  // Give a popup-mode card its poster/preview images, which in inline mode
  // videoinline.js would have supplied. Set false if Webflow already binds
  // real images to those elements.
  const HYDRATE_CARDS = true;
  const WARM_ON_HOVER = true;

  const BUNNY_PULL_ZONE = 'vz-db5eff76-e50.b-cdn.net';
  const HLS_JS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js';

  const ICON = {
    play: '[data-videopop-icon="play"]',
    pause: '[data-videopop-icon="pause"]',
    volumeUp: '[data-videopop-icon="volume-up"]',
    volumeMute: '[data-videopop-icon="volume-mute"]',
    maximise: '[data-videopop-icon="maximise"]',
    minimise: '[data-videopop-icon="minimise"]'
  };

  // --- YouTube ---------------------------------------------------------------
  // A card is a YouTube card when `data-video-youtube` holds anything we can
  // pull an id out of. That one attribute is the whole mode switch, mirroring
  // how `data-videoinline-player` alone decides inline vs popup.
  //
  // YouTube keeps its OWN controls (see `data-videopop-source` below), so there
  // is no IFrame API to load and no second set of play/seek/volume plumbing to
  // keep in sync with the <video> element.

  // Every shape an editor might paste, plus a bare id. The id is always the
  // 11-char [A-Za-z0-9_-] token; anything after it (&t=, ?si=, /) is dropped.
  const YT_ID = /(?:youtu\.be\/|\/shorts\/|\/embed\/|\/live\/|[?&]v=)([A-Za-z0-9_-]{11})|^([A-Za-z0-9_-]{11})$/;

  const youtubeId = (raw) => {
    if (!raw) return null;
    const m = String(raw).trim().match(YT_ID);
    return m ? m[1] || m[2] : null;
  };

  // The popup opens PAUSED — the viewer presses play, same as a Bunny video,
  // and nothing starts making noise on its own.
  //
  //   rel=0            end-cards stay on the same channel
  //   playsinline=1    stops iOS yanking the video out of the dialog into its
  //                    own native fullscreen
  //   modestbranding=1 drops the YouTube wordmark from the control bar
  //
  // YouTube's own top-right overlay (share / watch-later / more) sits exactly
  // where our close button does. There is no embed parameter that removes it,
  // so the fix is z-index in CSS — see youtube-mode.css.
  const youtubeEmbed = (id, { autoplay = false } = {}) =>
    `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&autoplay=${autoplay ? 1 : 0}`;

  // Bunny only ever supplies what the CMS did not. With no GUID every field is
  // null, so a card that carries CMS art but no video still renders its poster.
  const cdnSources = (guid) => {
    if (!guid) return { hls: null, poster: null, preview: null, mp4: null };
    const base = `https://${BUNNY_PULL_ZONE}/${guid}`;
    return {
      hls: `${base}/playlist.m3u8`,
      poster: `${base}/thumbnail.jpg`,
      preview: `${base}/preview.webp`,
      mp4: `${base}/play_1080p.mp4`
    };
  };

  // An empty CMS image field is not rendered as an empty `src` — Webflow
  // substitutes its stock plugin placeholder, which would otherwise read as
  // real art and pin the card to a grey box. The fingerprint hash changes
  // whenever Webflow reships the asset, so only the path shape is matched.
  const isPlaceholder = (url) =>
    /\/plugins\/Basic\/assets\/placeholder\.[^/]*\.svg(\?|#|$)/.test(url);

  // Webflow binds a CMS image straight into the element's `src`, so an explicit
  // -src attribute is not the only way art arrives. Anything already in `src`
  // counts as CMS art unless it is empty, Webflow's placeholder, or the exact
  // URL Bunny auto-derives from the GUID — the preview may itself live on the
  // pull zone under a hand-picked path, which a hostname test would discard.
  const cmsArt = (img, autoUrl) => {
    if (!img) return null;
    const current = img.getAttribute('src');
    if (!current || current === autoUrl || isPlaceholder(current)) return null;
    return current;
  };

  const prefetchResource = (url, as) => {
    if (!url) return;
    if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    if (as) link.as = as;
    document.head.appendChild(link);
  };

  /**
   * Everything the popup needs, resolved opener-first then card-second.
   */
  const readOpener = (opener) => {
    // An opener is normally inside the card. A click area may sit above it
    // (on .card_wrap), so look down as well as up — otherwise the card
    // resolves to null and the popup opens with no GUID and no title.
    const card = opener.closest
      ? opener.closest(CARD) || opener.querySelector(CARD)
      : null;
    const fromCard = (attr) => (card ? card.getAttribute(attr) : null);
    return {
      card,
      guid: opener.dataset.videoId || opener.dataset.videopopId || fromCard('data-video-id') || '',
      // Any YouTube URL shape, or a bare id. Non-null => YouTube mode.
      youtube: youtubeId(
        opener.dataset.videoYoutube ||
          opener.dataset.videopopYoutube ||
          fromCard('data-video-youtube') ||
          ''
      ),
      src:
        opener.dataset.videopopSrc ||
        fromCard('data-videopop-src') ||
        fromCard('data-videoinline-src') ||
        '',
      title:
        opener.dataset.videopopTitle ||
        opener.dataset.videoTitle ||
        fromCard('data-video-title') ||
        '',
      poster:
        opener.dataset.videopopPoster ||
        fromCard('data-videopop-poster') ||
        fromCard('data-videoinline-poster-src') ||
        '',
      preview:
        opener.dataset.videopopPreview ||
        fromCard('data-videopop-preview') ||
        fromCard('data-videoinline-preview-src') ||
        ''
    };
  };

  /**
   * Popup-mode cards have no <video>, so videoinline.js never touches them and
   * their poster/preview images stay empty. Fill them in from the GUID.
   */
  const hydrateCard = (card) => {
    if (!HYDRATE_CARDS || card.dataset.videopopCardHydrated) return;

    const guid = card.getAttribute('data-video-id');
    const ytId = youtubeId(card.getAttribute('data-video-youtube'));
    // CMS art wins outright; Bunny is only the fallback when the field is empty.
    // Resolved per-card rather than per-GUID so a card with a CMS thumbnail and
    // no GUID still hydrates — and never touches the CDN.
    const sources = cdnSources(guid);
    const posterImg = card.querySelector('[data-videoinline-poster-img]');
    const previewImg = card.querySelector('[data-videoinline-preview]');

    // YouTube has no preview clip and only one still, so it fills the poster
    // slot only. hqdefault exists for every video; maxres does not.
    const ytPoster = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null;

    // Precedence: explicit -src attribute, then art the CMS already bound into
    // the img, then the auto-derived file. Neither CDN overwrites CMS art.
    const poster =
      card.getAttribute('data-videoinline-poster-src') ||
      cmsArt(posterImg, sources.poster || ytPoster) ||
      sources.poster ||
      ytPoster;
    const previewSrc =
      card.getAttribute('data-videoinline-preview-src') ||
      cmsArt(previewImg, sources.preview) ||
      sources.preview;

    // Nothing to show and nothing to warm — leave the card untouched so a later
    // pass (CMS binding, popup rehydrate) can still hydrate it.
    if (!guid && !ytId && !poster && !previewSrc) return;
    card.dataset.videopopCardHydrated = 'true';

    if (posterImg && poster && posterImg.getAttribute('src') !== poster) {
      posterImg.removeAttribute('srcset');
      posterImg.removeAttribute('sizes');
      posterImg.src = poster;
    }

    let previewLoaded = false;
    const loadPreview = () => {
      if (previewLoaded || !previewImg || !previewSrc) return;
      previewLoaded = true;
      previewImg.src = previewSrc;
    };

    let hoverTimer;
    card.addEventListener('pointerenter', () => {
      loadPreview();
      // Only warm the CDN when there is actually a Bunny video behind the card.
      if (WARM_ON_HOVER && sources.hls) {
        prefetchResource(HLS_JS_URL, 'script');
        prefetchResource(sources.hls);
      }
    });
    card.addEventListener('focusin', loadPreview);
    card.addEventListener('pointermove', () => {
      card.setAttribute('data-videoinline-hover', 'active');
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => card.setAttribute('data-videoinline-hover', 'idle'), 3000);
    });
    card.addEventListener('pointerleave', () => {
      clearTimeout(hoverTimer);
      card.setAttribute('data-videoinline-hover', 'idle');
    });
  };

  /**
   * Every element that should open the popup, in document order.
   */
  const collectOpeners = () => {
    const openers = [];
    const seen = new Set();
    const add = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      openers.push(el);
    };

    document.querySelectorAll(POPUP_CARD).forEach((card) => {
      if (
        !card.getAttribute('data-video-id') &&
        !card.getAttribute('data-videopop-src') &&
        !youtubeId(card.getAttribute('data-video-youtube'))
      ) {
        console.warn(
          '[videopopup] popup-mode card has no data-video-id or data-video-youtube, ' +
            'so it cannot open anything.',
          card
        );
        return;
      }
      const watch = card.querySelector(WATCH);
      if (!watch) {
        console.warn(`[videopopup] popup-mode card has no ${WATCH}`, card);
        return;
      }
      hydrateCard(card);
      add(watch);
    });

    document.querySelectorAll('[data-videopop-open]').forEach(add);

    // Click areas. An area belonging to an INLINE card is skipped: that card
    // plays in place and videoinline.js owns its area click. The area may sit
    // on the card itself or on a wrapper above it, so test both directions.
    document.querySelectorAll(CLICK_AREA).forEach((area) => {
      if (area.closest(INLINE_FLAG) || area.querySelector(INLINE_FLAG)) return;
      if (!area.closest(POPUP_CARD) && !area.querySelector(POPUP_CARD)) return;
      add(area);
    });

    return openers;
  };

  const init = () => {
    const inWebflowEditor =
      document.documentElement.classList.contains('wf-design-mode') ||
      document.documentElement.classList.contains('w-editor') ||
      window.Webflow?.env?.('design') ||
      window.Webflow?.env?.('editor');

    document.querySelectorAll('[data-videopop]').forEach((component) => {
      if (component.dataset.scriptInitialized) {
        // Already built. Only pick up openers that appeared since.
        if (component._videopopBindOpeners) component._videopopBindOpeners();
        return;
      }
      component.dataset.scriptInitialized = 'true';

      const backdrop = component.querySelector('[data-videopop-backdrop]');
      const dialog = component.querySelector('[data-videopop-dialog]');
      const player = component.querySelector('[data-videopop-player]');
      const video = component.querySelector('[data-videopop-video]');

      if (!player || !video) {
        console.warn('[videopopup] [data-videopop] is missing its player or video element', component);
        return;
      }

      const closeButtons = component.querySelectorAll('[data-videopop-close]');
      const playpauseButtons = component.querySelectorAll('[data-videopop-playpause]');
      const readButton = component.querySelector('[data-videopop-read]');
      const muteButton = component.querySelector('[data-videopop-mute]');
      const fullscreenButton = component.querySelector('[data-videopop-fullscreen]');
      const timeline = component.querySelector('[data-videopop-timeline]');
      const progressBar = component.querySelector('[data-videopop-progress]');
      const bufferedBar = component.querySelector('[data-videopop-buffered]');
      const handle = component.querySelector('[data-videopop-handle]');
      const progressText = component.querySelector('[data-videopop-progress-text]');
      const durationText = component.querySelector('[data-videopop-duration-text]');
      const titleText = component.querySelector('[data-videopop-title-text]');
      const loading = component.querySelector('[data-videopop-loading]');
      const volumeSlider = component.querySelector('[data-videopop-volume]');
      const volumeFill = component.querySelector('[data-videopop-volume-fill]');
      const playLabel = component.querySelector('[data-videopop-playpause-label]');
      const bigBtnWrap = component.querySelector('[data-videopop-bigbtn]');

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // --- Icons -----------------------------------------------------------
      const resolveShownDisplay = (el) => {
        const own = getComputedStyle(el).display;
        if (own && own !== 'none') return own;
        const parent = el.parentElement;
        if (parent) {
          for (const sib of parent.children) {
            if (sib === el) continue;
            const d = getComputedStyle(sib).display;
            if (d && d !== 'none') return d;
          }
        }
        return 'block';
      };

      const iconGroup = (selector) =>
        Array.prototype.map.call(component.querySelectorAll(selector), (el) => ({
          el,
          shown: resolveShownDisplay(el)
        }));

      const setGroupVisible = (group, on) => {
        group.forEach((entry) => {
          entry.el.style.display = on ? entry.shown : 'none';
        });
      };

      const playIcons = iconGroup(ICON.play);
      const pauseIcons = iconGroup(ICON.pause);
      const volumeUpIcons = iconGroup(ICON.volumeUp);
      const volumeMuteIcons = iconGroup(ICON.volumeMute);
      const maximiseIcons = iconGroup(ICON.maximise);
      const minimiseIcons = iconGroup(ICON.minimise);

      const setState = (s) => {
        player.setAttribute('data-videopop-state', s);
        const playing = s === 'playing';
        setGroupVisible(playIcons, !playing);
        setGroupVisible(pauseIcons, playing);
        if (playLabel) playLabel.textContent = playing ? 'Pause' : 'Play';
        if (bigBtnWrap) {
          bigBtnWrap.style.opacity = playing ? '0' : '1';
          bigBtnWrap.style.pointerEvents = playing ? 'none' : 'auto';
        }
      };

      const setHover = (s) => player.setAttribute('data-videopop-hover', s);

      const setLoading = (on) => {
        if (!loading) return;
        loading.style.opacity = on ? '1' : '0';
        loading.style.visibility = on ? 'visible' : 'hidden';
      };

      const pad2 = (n) => (n < 10 ? '0' : '') + n;

      const formatTime = (sec) => {
        if (!isFinite(sec) || sec < 0) return '00:00';
        const s = Math.floor(sec);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = s % 60;
        return h > 0 ? `${h}:${pad2(m)}:${pad2(r)}` : `${pad2(m)}:${pad2(r)}`;
      };

      const updateTimeText = () => {
        if (progressText) progressText.textContent = formatTime(video.currentTime);
        if (durationText) durationText.textContent = formatTime(video.duration);
      };

      const updateProgressVisuals = () => {
        if (!video.duration) return;
        const pct = (video.currentTime / video.duration) * 100;
        if (progressBar) progressBar.style.transform = `translateX(${-100 + pct}%)`;
        if (handle) handle.style.left = `${pct}%`;
      };

      let loadedSrc = null;
      let currentHls = null;
      let hlsLoadedPromise = null;

      const loadHlsJs = () => {
        if (hlsLoadedPromise) return hlsLoadedPromise;
        if (window.Hls) return Promise.resolve(window.Hls);
        hlsLoadedPromise = new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = HLS_JS_URL;
          script.async = true;
          script.onload = () => resolve(window.Hls);
          script.onerror = () => reject(new Error('Failed to load hls.js'));
          document.head.appendChild(script);
        });
        return hlsLoadedPromise;
      };

      const destroyHls = () => {
        if (currentHls) {
          currentHls.destroy();
          currentHls = null;
        }
        if (video.src && video.src.startsWith('blob:')) {
          URL.revokeObjectURL(video.src);
        }
      };

      const fallbackToMp4 = (guid) => {
        destroyHls();
        if (!guid) {
          console.error('[videopopup] HLS failed and no GUID is available for MP4 fallback');
          return;
        }
        video.src = cdnSources(guid).mp4 + '#t=0.1';
        video.load();
      };

      const setPosterAndPrefetch = () => {
        const guid = player.getAttribute('data-videopop-id');
        const sources = cdnSources(guid);
        // CMS poster first; only fall back to the CDN thumbnail when it is empty.
        const poster = player.getAttribute('data-videopop-poster') || sources.poster;
        if (poster) video.poster = poster;
        else video.removeAttribute('poster');
        prefetchResource(poster, 'image');
        // A CMS poster is already served by Webflow — there is nothing on Bunny
        // to warm unless the video itself lives there.
        if (sources.hls) {
          prefetchResource(HLS_JS_URL, 'script');
          prefetchResource(sources.hls);
        }
      };

      const loadSource = async () => {
        const guid = player.getAttribute('data-videopop-id');
        let raw = player.getAttribute('data-videopop-src');
        let poster = player.getAttribute('data-videopop-poster');
        if (guid) {
          const sources = cdnSources(guid);
          raw = sources.hls;
          if (!poster) poster = sources.poster;
        }
        if (!raw) return;
        if (loadedSrc === raw) return; // same video, already loaded

        destroyHls();
        loadedSrc = raw;
        video.removeAttribute('src');
        video.load(); // reset the element
        if (poster) video.poster = poster;
        else video.removeAttribute('poster');

        const isHls = raw.endsWith('.m3u8') || raw.includes('/playlist.m3u8');
        if (!isHls) {
          video.src = raw.indexOf('#') === -1 ? raw + '#t=0.1' : raw;
          video.load();
          return;
        }
        try {
          const Hls = await loadHlsJs();
          if (Hls && Hls.isSupported()) {
            currentHls = new Hls({
              capLevelToPlayerSize: true,
              maxMaxBufferLength: 30,
              maxBufferLength: 30,
              backBufferLength: 30
            });
            currentHls.on(Hls.Events.ERROR, (_event, data) => {
              if (!data.fatal) return;
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  currentHls.startLoad();
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  currentHls.recoverMediaError();
                  break;
                default:
                  currentHls.destroy();
                  currentHls = null;
                  fallbackToMp4(guid);
              }
            });
            currentHls.attachMedia(video);
            currentHls.on(Hls.Events.MEDIA_ATTACHED, () => {
              currentHls.loadSource(raw);
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = raw;
          } else {
            fallbackToMp4(guid);
          }
        } catch (e) {
          fallbackToMp4(guid);
        }
      };

      // --- YouTube mode ----------------------------------------------------
      // The popup shows exactly one of two players. Bunny gets the <video> and
      // all the custom chrome; YouTube gets an <iframe> and its own controls.
      //
      // Which chrome is visible is decided in CSS off `data-videopop-source` on
      // the player (see the embed in Part 1E / components.html), NOT here — so
      // restyling or hiding another element never means touching this file:
      //
      //   [data-videopop-source="youtube"] .videopop_interface,
      //   [data-videopop-source="youtube"] .videopop_bigbtn_wrap,
      //   [data-videopop-source="youtube"] .videopop_loading,
      //   [data-videopop-source="youtube"] .videopop_fade { display: none; }
      //
      // The title/Read row is ours in both modes, so if it lives inside
      // .videopop_interface, lift it out rather than adding a JS exception.
      let ytFrame = null;

      const setSource = (mode) => player.setAttribute('data-videopop-source', mode);

      // Built on first use and reused after — same lifecycle as the <video>,
      // so the two players never both hold a source.
      const mountYoutube = (id) => {
        if (!ytFrame) {
          ytFrame = document.createElement('iframe');
          // Distinct from the player's `data-videopop-youtube`, which holds the
          // id and is the mode flag — this only marks the frame element.
          ytFrame.setAttribute('data-videopop-youtube-frame', '');
          ytFrame.setAttribute('title', 'YouTube video player');
          ytFrame.setAttribute('frameborder', '0');
          ytFrame.setAttribute('allowfullscreen', '');
          ytFrame.setAttribute(
            'allow',
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          );
          // Matches the <video>'s box so the CSS that sizes .videopop_video
          // does not have to be duplicated for the frame.
          ytFrame.style.cssText =
            'position:absolute;inset:0;width:100%;height:100%;border:0;background:#000;';
          video.parentNode.insertBefore(ytFrame, video.nextSibling);
        }
        ytFrame.src = youtubeEmbed(id);
        ytFrame.style.display = '';
      };

      // Dropping the src is what actually stops playback — an iframe left
      // mounted keeps playing audio behind a closed dialog.
      const unmountYoutube = () => {
        if (!ytFrame) return;
        ytFrame.removeAttribute('src');
        ytFrame.style.display = 'none';
      };

      const resetToStart = () => {
        if (!video.src) return; // no source loaded yet (HLS deferred), nothing to reset
        const seek = () => {
          try {
            video.currentTime = 0;
          } catch (e) {}
          updateProgressVisuals();
          updateTimeText();
        };
        if (video.readyState >= 1) seek();
        else video.addEventListener('loadedmetadata', seek, { once: true });
      };

      const syncTitle = () => {
        const title = player.getAttribute('data-videopop-title');
        if (titleText) titleText.textContent = title || '';
      };

      /**
       * Copy the opener's (or its card's) video data onto the popup player.
       */
      const applyOpener = (opener) => {
        if (!opener) return;
        const data = readOpener(opener);

        // YouTube wins when both are present — an explicit YouTube link is a
        // deliberate override of whatever GUID the card was carrying.
        if (data.youtube) player.setAttribute('data-videopop-youtube', data.youtube);
        else player.removeAttribute('data-videopop-youtube');
        setSource(data.youtube ? 'youtube' : 'bunny');

        if (data.guid) player.setAttribute('data-videopop-id', data.guid);
        else player.removeAttribute('data-videopop-id');

        if (data.src) player.setAttribute('data-videopop-src', data.src);
        else player.removeAttribute('data-videopop-src');

        if (data.title) player.setAttribute('data-videopop-title', data.title);
        else player.removeAttribute('data-videopop-title');

        if (data.poster) player.setAttribute('data-videopop-poster', data.poster);
        else player.removeAttribute('data-videopop-poster');

        if (data.preview) player.setAttribute('data-videopop-preview', data.preview);
        else player.removeAttribute('data-videopop-preview');

        syncTitle();
      };

      syncTitle();
      setState('paused');
      // Default until an opener says otherwise, so the CSS always has a value
      // to match and the Bunny chrome is visible on first paint.
      setSource(player.getAttribute('data-videopop-youtube') ? 'youtube' : 'bunny');

      const safePlay = () => {
        const p = video.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      };

      const togglePlay = async () => {
        if (!video.src) setLoading(true);
        await loadSource();
        if (video.paused || video.ended) {
          if (video.readyState < 3) setLoading(true);
          safePlay();
        } else {
          video.pause();
        }
      };

      // The big button is a play trigger in its own right. Binding it here as
      // well as via [data-videopop-playpause] means it works whether or not the
      // author doubled up the attributes, and a Set keeps a doubled-up element
      // from toggling twice per click.
      const playTriggers = new Set(playpauseButtons);
      if (bigBtnWrap) playTriggers.add(bigBtnWrap);
      playTriggers.forEach((btn) => btn.addEventListener('click', togglePlay));

      video.addEventListener('play', () => setState('playing'));
      video.addEventListener('playing', () => {
        setLoading(false);
        setState('playing');
      });
      video.addEventListener('pause', () => setState('paused'));
      video.addEventListener('waiting', () => setLoading(true));
      video.addEventListener('canplay', () => setLoading(false));
      video.addEventListener('loadeddata', () => setLoading(false));
      video.addEventListener('ended', () => {
        setState('paused');
        // The control bar hides itself once playback stops, which would strand
        // the viewer in fullscreen with no way out but ESC. Drop back to the
        // popup, where close and replay are both visible again.
        exitFullscreenIfActive();
        destroyHls();
        loadedSrc = null;
        video.removeAttribute('src');
        video.load();
        updateProgressVisuals();
        updateTimeText();
      });

      // --- Volume ----------------------------------------------------------
      const syncMuteIcons = () => {
        const muted = video.muted || video.volume === 0;
        setGroupVisible(volumeUpIcons, !muted);
        setGroupVisible(volumeMuteIcons, muted);
      };

      const syncVolumeFill = () => {
        if (!volumeFill) return;
        const pct = video.muted ? 0 : video.volume;
        volumeFill.style.transform = `scaleX(${pct})`;
      };

      if (muteButton) {
        muteButton.addEventListener('click', () => {
          video.muted = !video.muted;
        });
      }

      video.addEventListener('volumechange', () => {
        syncMuteIcons();
        syncVolumeFill();
      });

      if (volumeSlider) {
        const setVolumeFromX = (clientX) => {
          const rect = volumeSlider.getBoundingClientRect();
          let f = (clientX - rect.left) / rect.width;
          f = Math.min(1, Math.max(0, f));
          video.volume = f;
          video.muted = f === 0;
        };
        let volDragging = false;
        volumeSlider.addEventListener('pointerdown', (e) => {
          volDragging = true;
          volumeSlider.setPointerCapture?.(e.pointerId);
          setVolumeFromX(e.clientX);
        });
        volumeSlider.addEventListener('pointermove', (e) => {
          if (volDragging) setVolumeFromX(e.clientX);
        });
        const endVol = () => {
          volDragging = false;
        };
        volumeSlider.addEventListener('pointerup', endVol);
        volumeSlider.addEventListener('pointercancel', endVol);
      }

      syncMuteIcons();
      syncVolumeFill();

      // --- Fullscreen ------------------------------------------------------
      // Leaving fullscreen is only allowed for the element that owns it, and
      // only while it still does — calling exit otherwise rejects.
      const isFullscreen = () =>
        document.fullscreenElement === player || document.webkitFullscreenElement === player;

      const exitFullscreenIfActive = () => {
        // iOS Safari hands the <video> its own native fullscreen, which never
        // shows up in document.fullscreenElement — it needs its own exit call.
        if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
          try {
            video.webkitExitFullscreen();
          } catch (e) {}
          return;
        }
        if (!isFullscreen()) return;
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        try {
          const r = exit?.call(document);
          if (r && typeof r.catch === 'function') r.catch(() => {});
        } catch (e) {
          /* already exiting, or denied — nothing to recover */
        }
      };

      const syncFullscreenIcons = () => {
        const active = isFullscreen();
        setGroupVisible(maximiseIcons, !active);
        setGroupVisible(minimiseIcons, active);
      };

      if (fullscreenButton) {
        fullscreenButton.addEventListener('click', () => {
          const active = document.fullscreenElement || document.webkitFullscreenElement;
          if (active) {
            (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
          } else if (player.requestFullscreen || player.webkitRequestFullscreen) {
            (player.requestFullscreen || player.webkitRequestFullscreen).call(player);
          } else if (video.webkitEnterFullscreen) {
            video.webkitEnterFullscreen();
          }
        });
      }

      document.addEventListener('fullscreenchange', syncFullscreenIcons);
      document.addEventListener('webkitfullscreenchange', syncFullscreenIcons);
      syncFullscreenIcons();

      // --- Time / progress -------------------------------------------------
      video.addEventListener('loadedmetadata', updateTimeText);
      video.addEventListener('durationchange', updateTimeText);
      video.addEventListener('timeupdate', updateTimeText);

      let rafId;
      const loop = () => {
        updateProgressVisuals();
        if (!video.paused && !video.ended) rafId = requestAnimationFrame(loop);
      };
      video.addEventListener('play', () => {
        cancelAnimationFrame(rafId);
        loop();
      });
      video.addEventListener('pause', () => {
        cancelAnimationFrame(rafId);
        updateProgressVisuals();
      });

      const updateBuffered = () => {
        if (!bufferedBar || !video.duration || !video.buffered.length) return;
        const end = video.buffered.end(video.buffered.length - 1);
        bufferedBar.style.transform = `translateX(${-100 + (end / video.duration) * 100}%)`;
      };
      video.addEventListener('progress', updateBuffered);
      video.addEventListener('durationchange', updateBuffered);

      // --- Scrubbing -------------------------------------------------------
      if (timeline) {
        let dragging = false;
        let wasPlaying = false;
        const fractionFromX = (clientX) => {
          const rect = timeline.getBoundingClientRect();
          const f = (clientX - rect.left) / rect.width;
          return Math.min(1, Math.max(0, f));
        };
        const previewAt = (f) => {
          const pct = f * 100;
          if (progressBar) progressBar.style.transform = `translateX(${-100 + pct}%)`;
          if (handle) handle.style.left = `${pct}%`;
          if (progressText && video.duration) progressText.textContent = formatTime(f * video.duration);
        };
        timeline.addEventListener('pointerdown', (e) => {
          if (!video.duration) return;
          dragging = true;
          wasPlaying = !video.paused && !video.ended;
          if (wasPlaying) video.pause();
          player.setAttribute('data-videopop-drag', 'true');
          if (handle) handle.style.transform = 'translate(-50%, -50%) scale(1)';
          timeline.setPointerCapture?.(e.pointerId);
          previewAt(fractionFromX(e.clientX));
        });
        timeline.addEventListener('pointermove', (e) => {
          if (dragging) previewAt(fractionFromX(e.clientX));
        });
        const endDrag = (e) => {
          if (!dragging) return;
          dragging = false;
          player.setAttribute('data-videopop-drag', 'false');
          if (handle) handle.style.transform = 'translate(-50%, -50%) scale(0)';
          video.currentTime = fractionFromX(e.clientX) * video.duration;
          if (wasPlaying) safePlay();
          else {
            updateProgressVisuals();
            updateTimeText();
          }
        };
        timeline.addEventListener('pointerup', endDrag);
        timeline.addEventListener('pointercancel', endDrag);
      }

      // --- Hover -----------------------------------------------------------
      let hoverTimer;
      const wake = () => {
        setHover('active');
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => setHover('idle'), 3000);
      };
      player.addEventListener('pointermove', wake);
      player.addEventListener('pointerleave', () => {
        clearTimeout(hoverTimer);
        setHover('idle');
      });

      // --- Open / close ----------------------------------------------------
      let isOpen = false;
      let lastFocused = null;
      // Kept so the "Read" button can find the article link for this video.
      let activeOpener = null;
      // The video id currently reflected in the address bar, or null.
      let currentGuid = null;

      const openPopup = async (opener) => {
        if (isOpen) return;
        isOpen = true;
        lastFocused = document.activeElement;
        window.__popupScrollLock.lock();
        activeOpener = opener || null;

        applyOpener(opener);

        // Park every inline player on the page.
        document.dispatchEvent(new CustomEvent('videoinline:play', { detail: player }));

        component.style.visibility = 'visible';
        component.style.pointerEvents = 'auto';

        const guid = player.getAttribute('data-videopop-id');
        const ytId = player.getAttribute('data-videopop-youtube');

        // Reflect the video in the address bar. A video has no page of its own,
        // so this is a query param on whatever page is showing rather than a
        // path — see the header note in popuprouter.js. YouTube ids share the
        // same param under a `yt:` prefix: one param, one router kind, and the
        // 11-char id charset can never collide with a Bunny UUID.
        const watchId = ytId ? `yt:${ytId}` : guid;
        // What the popup is SHOWING, tracked however it was opened. The router
        // drives a cold-link restore inside runSuppressed(), so isSuppressed()
        // is true on that path — gating this assignment on it (as the history
        // write below rightly is) left currentGuid null for restored popups,
        // and closePopup's `if (hadGuid)` then skipped router.close() entirely.
        // The overlay hid, the URL kept ?watch=, and `current` stayed set in
        // the router, which poisoned every later open/close cycle.
        currentGuid = watchId || null;

        // Only the history WRITE is suppressed: during a restore the address
        // bar already shows this video, so re-writing it would push a
        // duplicate entry over the one the visitor landed on.
        if (watchId && !window.__popupRouter?.isSuppressed()) {
          const url = new URL(window.location.href);
          url.searchParams.set('watch', watchId);
          window.__popupRouter?.open('video', { guid: watchId }, url.href);
        }

        if (ytId) {
          // Hand off to YouTube entirely: park the <video> so a previously
          // played Bunny clip cannot keep running behind the iframe.
          video.pause();
          destroyHls();
          loadedSrc = null;
          video.removeAttribute('src');
          video.load();
          mountYoutube(ytId);
        } else {
          unmountYoutube();
          if (guid) {
            setPosterAndPrefetch();
          } else {
            await loadSource();
          }
          resetToStart(); // always open at 00:00
        }

        setState('paused');
        setLoading(false);

        if (reduceMotion) {
          gsap.set(backdrop, { opacity: 1 });
          gsap.set(dialog, { opacity: 1, y: 0 });
        } else {
          gsap
            .timeline()
            .to(backdrop, { opacity: 1, duration: 0.4, ease: 'power2.out' })
            .fromTo(
              dialog,
              { opacity: 0, y: '2rem' },
              { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
              '<'
            );
        }

        if (dialog) dialog.focus();
      };

      // Closes without touching history — used by the router when Back has
      // already moved the URL, and by the "Read" handoff, which pushes the
      // article URL over this one rather than retracting first.
      const closePopupSilently = () => {
        if (!isOpen) return;
        isOpen = false;
        currentGuid = null;
        window.__popupScrollLock.unlock();
        video.pause();

        exitFullscreenIfActive();

        const finish = () => {
          destroyHls();
          loadedSrc = null;
          video.removeAttribute('src');
          video.load();
          // Must happen on close, not just on the next open: an iframe that
          // keeps its src goes on playing audio behind the hidden dialog.
          unmountYoutube();
          component.style.visibility = 'hidden';
          component.style.pointerEvents = 'none';
          resetToStart(); // rewind so the next open starts clean
          setState('paused');
          setLoading(false);
          if (lastFocused) lastFocused.focus();
        };

        if (reduceMotion) {
          gsap.set(dialog, { opacity: 0, y: '2rem' });
          gsap.set(backdrop, { opacity: 0 });
          finish();
        } else {
          gsap
            .timeline({ onComplete: finish })
            .to(dialog, { opacity: 0, y: '2rem', duration: 0.4, ease: 'power3.in' })
            .to(backdrop, { opacity: 0, duration: 0.35, ease: 'power2.in' }, '<');
        }
      };

      // The close path every user gesture goes through: retract ?watch= as
      // well as hiding the popup.
      const closePopup = () => {
        if (!isOpen) return;
        const hadGuid = currentGuid;
        closePopupSilently();
        if (hadGuid) window.__popupRouter?.close('video');
      };

      // Find the opener for a given ?watch= id, so a shared link can be
      // restored with the same poster/title/article-link the card would supply.
      // `yt:` ids match on the card's YouTube field, bare ids on its GUID.
      const findOpenerForGuid = (id) => {
        const yt = id.indexOf('yt:') === 0 ? id.slice(3) : null;
        return (
          collectOpeners().filter((o) => {
            const data = readOpener(o);
            return yt ? data.youtube === yt : data.guid === id;
          })[0] || null
        );
      };

      window.__popupRouter?.register({
        name: 'video',
        // A ?watch= URL has no standalone page behind it, so unlike articles
        // it does have to be restored on a cold load.
        restoreOnLoad: true,
        matches: (url) => {
          const guid = url.searchParams.get('watch');
          return guid ? { guid: guid } : null;
        },
        // What the URL should fall back to once the video closes.
        cleanUrl: (url) => url.searchParams.delete('watch'),
        open: (state) => {
          if (!state?.guid) return;
          const opener = findOpenerForGuid(state.guid);
          // No matching card (CMS list not rendered yet, or the video was
          // removed) — open on the bare id rather than doing nothing.
          if (opener) {
            openPopup(opener);
          } else {
            // applyOpener(null) is a no-op, so seed the player directly and
            // clear the previous video's metadata rather than inheriting it.
            const yt = state.guid.indexOf('yt:') === 0 ? state.guid.slice(3) : null;
            if (yt) {
              player.setAttribute('data-videopop-youtube', yt);
              player.removeAttribute('data-videopop-id');
            } else {
              player.setAttribute('data-videopop-id', state.guid);
              player.removeAttribute('data-videopop-youtube');
            }
            setSource(yt ? 'youtube' : 'bunny');
            player.removeAttribute('data-videopop-src');
            player.removeAttribute('data-videopop-title');
            player.removeAttribute('data-videopop-poster');
            player.removeAttribute('data-videopop-preview');
            syncTitle();
            openPopup(null);
          }
        },
        close: closePopupSilently
      });

      closeButtons.forEach((btn) => btn.addEventListener('click', closePopup));
      if (backdrop) backdrop.addEventListener('click', closePopup);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) closePopup();
      });

      if (readButton) {
        readButton.addEventListener('click', () => {
          // Resolve the article link from the card that opened this video.
          const card = activeOpener
            ? activeOpener.closest('[data-card]')
            : null;
          const href =
            readButton.getAttribute('href') ||
            activeOpener?.getAttribute('data-article-href') ||
            card?.querySelector('[data-popup-open]')?.getAttribute('href');
          const title =
            player.getAttribute('data-videopop-title') || undefined;

          // Silent: the article popup is about to write its own URL over this
          // one. Retracting first would push the user back a step mid-handoff.
          closePopupSilently();

          const contentPopup = document.querySelector('[data-popup]');
          if (contentPopup && href && contentPopup._openPopupWithContent) {
            contentPopup._openPopupWithContent(href, title);
          } else if (contentPopup && contentPopup._openPopup) {
            contentPopup._openPopup();
          } else if (href) {
            window.location.href = href;
          } else {
            const contentOpener = document.querySelector('[data-popup-open]');
            if (contentOpener) contentOpener.click();
          }
        });
      }

      // --- Openers ---------------------------------------------------------
      const bindOpeners = () => {
        collectOpeners().forEach((opener) => {
          if (opener.dataset.videopopBound) return;
          opener.dataset.videopopBound = 'true';

          // Guards apply only when the opener is a click area. A button IS
          // the control, so it needs none of them.
          const isArea = opener.matches(CLICK_AREA);
          let downX = 0;
          let downY = 0;
          if (isArea) {
            // Capture, so the coordinates are recorded even when a child
            // stops the event bubbling.
            opener.addEventListener(
              'pointerdown',
              (e) => {
                downX = e.clientX;
                downY = e.clientY;
              },
              true
            );
          }

          opener.addEventListener('click', (e) => {
            if (isArea) {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              if (!e.detail) return; // keyboard-synthesised click
              if (e.target.closest(INTERACTIVE)) return; // WATCH / READ / socials
              if (Math.abs(e.clientX - downX) > DRAG_SLOP) return;
              if (Math.abs(e.clientY - downY) > DRAG_SLOP) return;
              const sel = window.getSelection && window.getSelection();
              if (sel && !sel.isCollapsed && sel.toString().trim()) return;
            }
            e.preventDefault();
            openPopup(opener);
          });

          if (!WARM_ON_HOVER) return;

          // Preload the first frame on hover so the popup never flashes blank.
          const warm = async () => {
            if (isOpen) return;
            applyOpener(opener);
            // YouTube loads nothing until the popup opens — the iframe is the
            // whole player, and mounting one per hover would autoplay it.
            if (player.getAttribute('data-videopop-youtube')) return;
            const guid = player.getAttribute('data-videopop-id');
            if (guid) {
              setPosterAndPrefetch();
            } else {
              await loadSource();
            }
          };
          opener.addEventListener('pointerenter', warm);
          opener.addEventListener('focus', warm);
        });
      };

      component._videopopBindOpeners = bindOpeners;
      component._openVideoPopup = openPopup;
      bindOpeners();

      if (!inWebflowEditor) {
        component.style.visibility = 'hidden';
        component.style.pointerEvents = 'none';
        gsap.set(backdrop, { opacity: 0 });
        gsap.set(dialog, { opacity: 0, y: '2rem' });
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // CMS lists and Webflow interactions can add cards after DOMContentLoaded.
  window.addEventListener('load', init);

  window.videopopupRefresh = init;
  window.addEventListener('videopopup:refresh', init);
})();