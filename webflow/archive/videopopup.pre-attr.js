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
 *   1. `.card_watch` inside a `[data-player]` that is NOT flagged inline, or
 *   2. any element carrying `[data-videopop-open]` (hero buttons, links, …).
 *
 * The GUID and title are read from the opener first and from its owning
 * `[data-player]` second, so a card only needs `data-video-id` /
 * `data-video-title` — the same fields the inline player uses. One CMS binding
 * feeds both modes.
 *
 * ICON CLASS NAMES — both conventions work, everywhere:
 *   play        .videopop_play_icon            | .card_play_icon
 *   pause       .videopop_pause_icon           | .card_pause_icon
 *   volume on   .videopop_volume_up_icon       | .card_volume_up_icon
 *   volume off  .videopop_volume_mute_icon     | .card_volume_mute_icon
 *   maximise    .videopop_fullscreen_maximise  | .card_fullscreen_maximise
 *   minimise    .videopop_fullscreen_minimise  | .card_fullscreen_minimise
 *
 *   Every match inside the component is toggled, and the "shown" display value
 *   is read from the stylesheet at init rather than hard-coded to `block`, so
 *   flex-centred icons keep their centring.
 * ---------------------------------------------------------------------------
 */
(function () {
  const CARD = '[data-player]';
  const INLINE_FLAG = '[data-videoinline-player]';
  const WATCH = '.card_watch';
  const POPUP_CARD = `${CARD}:not(${INLINE_FLAG})`;

  // Give a popup-mode card its poster/preview images, which in inline mode
  // videoinline.js would have supplied. Set false if Webflow already binds
  // real images to those elements.
  const HYDRATE_CARDS = true;
  const WARM_ON_HOVER = true;

  const BUNNY_PULL_ZONE = 'vz-68927fba-cee.b-cdn.net';
  const HLS_JS_URL = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js';

  const ICON = {
    play: '.videopop_play_icon, .card_play_icon',
    pause: '.videopop_pause_icon, .card_pause_icon',
    volumeUp: '.videopop_volume_up_icon, .card_volume_up_icon',
    volumeMute: '.videopop_volume_mute_icon, .card_volume_mute_icon',
    maximise: '.videopop_fullscreen_maximise, .card_fullscreen_maximise',
    minimise: '.videopop_fullscreen_minimise, .card_fullscreen_minimise'
  };

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
    const card = opener.closest ? opener.closest(CARD) : null;
    const fromCard = (attr) => (card ? card.getAttribute(attr) : null);
    return {
      card,
      guid: opener.dataset.videoId || opener.dataset.videopopId || fromCard('data-video-id') || '',
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
    // CMS art wins outright; Bunny is only the fallback when the field is empty.
    // Resolved per-card rather than per-GUID so a card with a CMS thumbnail and
    // no GUID still hydrates — and never touches the CDN.
    const sources = cdnSources(guid);
    const poster = card.getAttribute('data-videoinline-poster-src') || sources.poster;
    const previewSrc = card.getAttribute('data-videoinline-preview-src') || sources.preview;

    // Nothing to show and nothing to warm — leave the card untouched so a later
    // pass (CMS binding, popup rehydrate) can still hydrate it.
    if (!guid && !poster && !previewSrc) return;
    card.dataset.videopopCardHydrated = 'true';

    const posterImg = card.querySelector('[data-videoinline-poster-img]');
    if (posterImg && poster && posterImg.getAttribute('src') !== poster) {
      posterImg.removeAttribute('srcset');
      posterImg.removeAttribute('sizes');
      posterImg.src = poster;
    }

    const previewImg = card.querySelector('[data-videoinline-preview]');
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
      if (!card.getAttribute('data-video-id') && !card.getAttribute('data-videopop-src')) {
        console.warn(
          '[videopopup] popup-mode card has no data-video-id, so it cannot open anything.',
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
    return openers;
  };

  const init = () => {
    const inWebflowEditor =
      document.documentElement.classList.contains('wf-design-mode') ||
      document.documentElement.classList.contains('w-editor') ||
      window.Webflow?.env?.('design') ||
      window.Webflow?.env?.('editor');

    document.querySelectorAll('.videopop_wrap').forEach((component) => {
      if (component.dataset.scriptInitialized) {
        // Already built. Only pick up openers that appeared since.
        if (component._videopopBindOpeners) component._videopopBindOpeners();
        return;
      }
      component.dataset.scriptInitialized = 'true';

      const backdrop = component.querySelector('[data-videopop-backdrop]');
      const dialog = component.querySelector('.videopop_dialog');
      const player = component.querySelector('[data-videopop-player]');
      const video = component.querySelector('[data-videopop-video]');

      if (!player || !video) {
        console.warn('[videopopup] .videopop_wrap is missing its player or video element', component);
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
      const playLabel = component.querySelector('.videopop_playpause_label');
      const bigBtnWrap = component.querySelector('.videopop_bigbtn_wrap, .card_bigbtn_wrap');

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

      playpauseButtons.forEach((btn) => btn.addEventListener('click', togglePlay));

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

      const openPopup = async (opener) => {
        if (isOpen) return;
        isOpen = true;
        lastFocused = document.activeElement;
        activeOpener = opener || null;

        applyOpener(opener);

        // Park every inline player on the page.
        document.dispatchEvent(new CustomEvent('videoinline:play', { detail: player }));

        component.style.visibility = 'visible';
        component.style.pointerEvents = 'auto';

        const guid = player.getAttribute('data-videopop-id');
        if (guid) {
          setPosterAndPrefetch();
        } else {
          await loadSource();
        }

        resetToStart(); // always open at 00:00
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

      const closePopup = () => {
        if (!isOpen) return;
        isOpen = false;
        video.pause();

        exitFullscreenIfActive();

        const finish = () => {
          destroyHls();
          loadedSrc = null;
          video.removeAttribute('src');
          video.load();
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

      closeButtons.forEach((btn) => btn.addEventListener('click', closePopup));
      if (backdrop) backdrop.addEventListener('click', closePopup);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) closePopup();
      });

      if (readButton) {
        readButton.addEventListener('click', () => {
          // Resolve the article link from the card that opened this video.
          const card = activeOpener
            ? activeOpener.closest('[data-card], .card_wrap')
            : null;
          const href =
            readButton.getAttribute('href') ||
            activeOpener?.getAttribute('data-article-href') ||
            card?.querySelector('.card_read')?.getAttribute('href');
          const title =
            player.getAttribute('data-videopop-title') || undefined;

          closePopup();

          const contentPopup = document.querySelector('.popup_wrap');
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

          opener.addEventListener('click', (e) => {
            e.preventDefault();
            openPopup(opener);
          });

          if (!WARM_ON_HOVER) return;

          // Preload the first frame on hover so the popup never flashes blank.
          const warm = async () => {
            if (isOpen) return;
            applyOpener(opener);
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