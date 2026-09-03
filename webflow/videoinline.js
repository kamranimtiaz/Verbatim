/**
 * videoinline.js — inline card player
 * ---------------------------------------------------------------------------
 * MODE CONTRACT (one attribute, authored in Webflow, no JS shim)
 *
 *   [data-player][data-videoinline-player]  -> INLINE  (this file claims it)
 *   [data-player]  without that attribute   -> POPUP   (videopopup.js claims it)
 *
 * Nothing stamps the attribute at runtime. Add it in Webflow via a component
 * property / conditional visibility on the inline variant only. The two files
 * never touch the same card, so load order between them does not matter.
 *
 * WATCH BUTTON
 *   `.card_watch` inside an inline player is a play trigger. In popup mode the
 *   same button is the popup opener and videopopup.js binds it instead.
 *   `[data-card-play]` is still honoured for markup written before this change.
 *
 * ICON CLASS NAMES — both conventions work, everywhere:
 *   play        .videoinline_play_icon            | .card_play_icon
 *   pause       .videoinline_pause_icon           | .card_pause_icon
 *   volume on   .videoinline_volume_up_icon       | .card_volume_up_icon
 *   volume off  .videoinline_volume_mute_icon     | .card_volume_mute_icon
 *   maximise    .videoinline_fullscreen_maximise  | .card_fullscreen_maximise
 *   minimise    .videoinline_fullscreen_minimise  | .card_fullscreen_minimise
 *
 *   Every match inside the player is toggled, so the big-button copy and the
 *   control-bar copy of the same icon stay in sync. The "shown" display value
 *   is read from the stylesheet at init instead of being hard-coded to
 *   `block`, so flex-centred icons keep their centring.
 * ---------------------------------------------------------------------------
 */
(function () {
  // Found by attribute, styled by class.
  const ICON = {
    play: '[data-videoinline-icon="play"]',
    pause: '[data-videoinline-icon="pause"]',
    volumeUp: '[data-videoinline-icon="volume-up"]',
    volumeMute: '[data-videoinline-icon="volume-mute"]',
    maximise: '[data-videoinline-icon="maximise"]',
    minimise: '[data-videoinline-icon="minimise"]'
  };

  // Anything inside an inline card that should toggle playback.
  const PLAY_TRIGGERS = '[data-videoinline-playpause], [data-card-watch]';

  // The whole thumbnail area, authored in Webflow on the wrapper. On an inline
  // card it toggles playback in place; videopopup.js skips these deliberately.
  const CLICK_AREA = '[data-card-click]';

  // A click landing on any of these belongs to that control, not to the area.
  // NOTE: duplicated in videopopup.js — edit one, edit both.
  // <video> is deliberately absent: listing it would kill click-to-pause.
  const INTERACTIVE =
    'a, button, input, select, textarea, label, summary, ' +
    '[role="button"], [role="link"], [onclick], ' +
    '[data-card-watch], [data-popup-open], [data-videopop-open], ' +
    '[data-videoinline-playpause], [data-videoinline-timeline], ' +
    '[data-videoinline-volume], [data-videoinline-mute], ' +
    '[data-videoinline-fullscreen]';

  // A press that travels further than this was a scrub or a text drag.
  const DRAG_SLOP = 6;

  const init = () => {
    // Skip the live-site reset while editing in the Webflow Designer/Editor so
    // every element stays visible and selectable on canvas.
    const inWebflowEditor =
      document.documentElement.classList.contains('wf-design-mode') ||
      document.documentElement.classList.contains('w-editor') ||
      window.Webflow?.env?.('design') ||
      window.Webflow?.env?.('editor');

    // Players are found document-wide, and only where the mode attribute is
    // present. A card without it belongs to videopopup.js.
    document.querySelectorAll('[data-videoinline-player]').forEach((player) => {
      if (player.dataset.scriptInitialized) return;
      player.dataset.scriptInitialized = 'true';

      const q = (sel) => player.querySelector(sel);
      const qa = (sel) => player.querySelectorAll(sel);

      const video = q('[data-videoinline-video]');
      if (!video) {
        // The card is flagged inline but Webflow removed the <video>. That is
        // a build mistake: drop the attribute and it becomes a popup card.
        console.warn(
          '[videoinline] card has [data-videoinline-player] but no ' +
            '<video data-videoinline-video>. Remove the attribute if this card ' +
            'is meant to open the popup.',
          player
        );
        return;
      }

      const posterImg = q('[data-videoinline-poster-img]');
      const preview = q('[data-videoinline-preview]');
      const playpauseButtons = qa(PLAY_TRIGGERS);
      const muteButton = q('[data-videoinline-mute]');
      const fullscreenButton = q('[data-videoinline-fullscreen]');
      const timeline = q('[data-videoinline-timeline]');
      const progressBar = q('[data-videoinline-progress]');
      const bufferedBar = q('[data-videoinline-buffered]');
      const handle = q('[data-videoinline-handle]');
      const progressText = q('[data-videoinline-progress-text]');
      const durationText = q('[data-videoinline-duration-text]');
      const posterTime = q('[data-videoinline-poster-time]');
      const loading = q('[data-videoinline-loading]');
      const volumeSlider = q('[data-videoinline-volume]');
      const volumeFill = q('[data-videoinline-volume-fill]');

      // --- Icons -----------------------------------------------------------
      // Resolve the display value the stylesheet gives an icon when it is
      // visible. For the hidden half of a pair (CSS ships it as display:none)
      // borrow the value from its visible sibling in the same button.
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
        Array.prototype.map.call(qa(selector), (el) => ({
          el,
          shown: resolveShownDisplay(el)
        }));

      const setGroupVisible = (group, on) => {
        group.forEach((entry) => {
          entry.el.style.display = on ? entry.shown : 'none';
        });
      };

      // Read once, before anything writes an inline display.
      const playIcons = iconGroup(ICON.play);
      const pauseIcons = iconGroup(ICON.pause);
      const volumeUpIcons = iconGroup(ICON.volumeUp);
      const volumeMuteIcons = iconGroup(ICON.volumeMute);
      const maximiseIcons = iconGroup(ICON.maximise);
      const minimiseIcons = iconGroup(ICON.minimise);

      const bunnyPullZone = 'vz-db5eff76-e50.b-cdn.net';
      const hlsJsUrl = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.8/dist/hls.min.js';

      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('disablepictureinpicture', '');
      if (!video.hasAttribute('preload')) video.setAttribute('preload', 'metadata');

      // Bunny only ever supplies what the CMS did not. With no GUID every field
      // is null, so a card carrying CMS art but no video still shows its poster.
      const buildSources = (guid) => {
        if (!guid) return { hls: null, poster: null, preview: null, mp4: null };
        const base = `https://${bunnyPullZone}/${guid}`;
        return {
          hls: `${base}/playlist.m3u8`,
          poster: `${base}/thumbnail.jpg`,
          preview: `${base}/preview.webp`,
          mp4: `${base}/play_1080p.mp4`
        };
      };

      // An empty CMS image field is not rendered as an empty `src` — Webflow
      // substitutes its stock plugin placeholder, which would otherwise read
      // as real art and pin the card to a grey box. The fingerprint hash
      // changes whenever Webflow reships the asset, so only the path shape
      // is matched.
      const isPlaceholder = (url) =>
        /\/plugins\/Basic\/assets\/placeholder\.[^/]*\.svg(\?|#|$)/.test(url);

      // Webflow binds a CMS image straight into the element's `src`, so an
      // explicit -src attribute is not the only way art arrives. Anything
      // already in `src` counts as CMS art unless it is empty, Webflow's
      // placeholder, or the exact URL Bunny auto-derives from the GUID — the
      // preview may itself live on the pull zone under a hand-picked path,
      // which a hostname test would wrongly discard.
      const cmsArt = (img, autoUrl) => {
        if (!img) return null;
        const current = img.getAttribute('src');
        if (!current || current === autoUrl || isPlaceholder(current)) return null;
        return current;
      };

      let loadedSrc = null;
      let currentHls = null;
      let hlsLoadedPromise = null;
      let previewLoaded = false;
      let sourcePromise = null;
      let resetting = false;

      const loadHlsJs = () => {
        if (window.Hls) return Promise.resolve(window.Hls);
        if (hlsLoadedPromise) return hlsLoadedPromise;
        hlsLoadedPromise = new Promise((resolve, reject) => {
          let script = document.querySelector(`script[src="${hlsJsUrl}"]`);
          if (!script) {
            script = document.createElement('script');
            script.src = hlsJsUrl;
            script.async = true;
            document.head.appendChild(script);
          }
          script.addEventListener('load', () => resolve(window.Hls));
          script.addEventListener('error', () => reject(new Error('Failed to load hls.js')));
        });
        return hlsLoadedPromise;
      };

      const prefetchResource = (url) => {
        if (!url) return;
        if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) return;
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
      };

      const destroyHls = () => {
        if (currentHls) {
          currentHls.destroy();
          currentHls = null;
        }
      };

      const fallbackToMp4 = (guid) => {
        destroyHls();
        if (!guid) {
          console.error('[videoinline] HLS failed and no GUID is available for MP4 fallback');
          return;
        }
        video.src = buildSources(guid).mp4 + '#t=0.1';
        video.load();
      };

      // idle    -> never started; poster and WATCH are the whole UI
      // playing -> transport visible, big button hidden
      // paused  -> started but stopped; transport controls stay visible
      const setState = (state) => {
        player.setAttribute('data-videoinline-state', state);
        const playing = state === 'playing';
        const started = state !== 'idle';

        setGroupVisible(playIcons, !playing);
        setGroupVisible(pauseIcons, playing);

        // Private variables rather than the framework's --_state---*, so the
        // Lumos state manager keeps full control of its own variables here.
        player.style.setProperty('--videoinline--idle', started ? '0' : '1');
        player.style.setProperty('--videoinline--poster-events', started ? 'none' : 'auto');
        player.style.setProperty('--videoinline--interface-opacity', started ? '1' : '0');
        player.style.setProperty('--videoinline--interface-events', started ? 'auto' : 'none');
        player.style.setProperty('--videoinline--bigbtn-opacity', playing ? '0' : started ? '1' : '0');
        player.style.setProperty('--videoinline--bigbtn-events', !playing && started ? 'auto' : 'none');
      };

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

      // CMS thumbnail wins outright; the CDN is only consulted when it is empty.
      const posterSrc = () => {
        const auto = buildSources(player.getAttribute('data-video-id')).poster;
        return (
          player.getAttribute('data-videoinline-poster-src') ||
          cmsArt(posterImg, auto) ||
          auto
        );
      };

      const setPoster = () => {
        const poster = posterSrc();
        if (poster) {
          if (posterImg && posterImg.getAttribute('src') !== poster) posterImg.src = poster;
          if (!video.currentSrc && !video.src) video.poster = poster;
        } else if (posterImg) {
          posterImg.removeAttribute('src');
        }
      };

      const loadPreview = () => {
        if (previewLoaded || !preview) return;
        const auto = buildSources(player.getAttribute('data-video-id')).preview;
        const src =
          player.getAttribute('data-videoinline-preview-src') ||
          cmsArt(preview, auto) ||
          auto;
        if (!src) return;
        previewLoaded = true;
        preview.src = src;
      };

      const warm = () => {
        loadPreview();
        // Only worth warming when the video itself is on Bunny. A CMS-only card
        // has nothing on the CDN to pre-load.
        const hls = buildSources(player.getAttribute('data-video-id')).hls;
        if (!hls) return;
        prefetchResource(hlsJsUrl);
        prefetchResource(hls);
      };

      const attachSource = async () => {
        const guid = player.getAttribute('data-video-id');
        let raw = player.getAttribute('data-videoinline-src');
        if (guid) raw = buildSources(guid).hls;
        if (!raw) return;
        if (loadedSrc === raw) return; // same video, already attached

        destroyHls();
        loadedSrc = raw;
        video.removeAttribute('src');
        video.removeAttribute('poster');
        setPoster();

        const isHls = raw.endsWith('.m3u8') || raw.includes('/playlist.m3u8');
        if (!isHls) {
          video.src = raw.indexOf('#') === -1 ? raw + '#t=0.1' : raw;
          video.load();
          return;
        }
        if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = raw;
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
                  fallbackToMp4(guid);
              }
            });
            currentHls.on(Hls.Events.MEDIA_ATTACHED, () => currentHls.loadSource(raw));
            currentHls.attachMedia(video);
          } else {
            fallbackToMp4(guid);
          }
        } catch (e) {
          fallbackToMp4(guid);
        }
      };

      const loadSource = () => {
        if (!sourcePromise) {
          sourcePromise = attachSource().finally(() => {
            sourcePromise = null;
          });
        }
        return sourcePromise;
      };

      const safePlay = () => {
        const p = video.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      };

      const togglePlay = async () => {
        if (!loadedSrc) setLoading(true);
        await loadSource();
        if (video.paused || video.ended) {
          if (video.ended || video.currentTime >= video.duration) video.currentTime = 0;
          if (video.readyState < 3) setLoading(true);
          safePlay();
        } else {
          video.pause();
        }
      };

      playpauseButtons.forEach((btn) => btn.addEventListener('click', togglePlay));

      // Whole-area click. closest() includes the element itself, so the
      // attribute works whether it sits on .card_player or on a wrapper above.
      // The area can live outside `player`, which is what carries the
      // initialised flag, so it is marked separately to survive refresh().
      const clickArea = player.closest(CLICK_AREA);
      if (clickArea && !clickArea.dataset.videoinlineAreaBound) {
        clickArea.dataset.videoinlineAreaBound = 'true';
        let downX = 0;
        let downY = 0;
        clickArea.addEventListener(
          'pointerdown',
          (e) => {
            downX = e.clientX;
            downY = e.clientY;
          },
          true
        );
        clickArea.addEventListener('click', (e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          if (!e.detail) return; // keyboard-synthesised click
          if (e.target.closest(INTERACTIVE)) return; // WATCH / READ / socials
          // Released after a scrub that ended outside the timeline.
          if (player.getAttribute('data-videoinline-drag') === 'true') return;
          if (Math.abs(e.clientX - downX) > DRAG_SLOP) return;
          if (Math.abs(e.clientY - downY) > DRAG_SLOP) return;
          const sel = window.getSelection && window.getSelection();
          if (sel && !sel.isCollapsed && sel.toString().trim()) return;
          togglePlay();
        });
      }

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

      const resetToIdle = () => {
        resetting = true;
        // Returning to the idle poster hides the whole control bar, which would
        // strand a fullscreen viewer with no exit but ESC. Come back out first.
        exitFullscreenIfActive();
        if (!video.paused) video.pause();
        setPoster();
        setState('idle');
        setLoading(false);
        try {
          video.currentTime = 0;
        } catch (e) {}
        if (progressBar) progressBar.style.transform = 'translateX(-100%)';
        if (handle) handle.style.left = '0%';
        if (progressText) progressText.textContent = formatTime(0);
        setTimeout(() => {
          resetting = false;
        }, 0);
      };

      // Only one player on the page may be playing. The popup broadcasts the
      // same event when it opens, so opening a popup parks every inline card.
      const PLAY_EVENT = 'videoinline:play';
      document.addEventListener(PLAY_EVENT, (e) => {
        if (e.detail === player) return; // this is the one that just started
        if (player.getAttribute('data-videoinline-state') !== 'idle') resetToIdle();
      });

      video.addEventListener('play', () => {
        setState('playing');
        document.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: player }));
      });
      video.addEventListener('playing', () => {
        setLoading(false);
        setState('playing');
      });
      video.addEventListener('pause', () => {
        if (!video.ended && !resetting) setState('paused');
      });
      video.addEventListener('waiting', () => setLoading(true));
      video.addEventListener('canplay', () => setLoading(false));
      video.addEventListener('loadeddata', () => setLoading(false));
      video.addEventListener('ended', resetToIdle);

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
      video.addEventListener('durationchange', () => {
        if (posterTime && isFinite(video.duration) && video.duration > 0) {
          posterTime.textContent = formatTime(video.duration);
        }
      });

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
          player.setAttribute('data-videoinline-drag', 'true');
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
          player.setAttribute('data-videoinline-drag', 'false');
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
        player.setAttribute('data-videoinline-hover', 'active');
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(() => player.setAttribute('data-videoinline-hover', 'idle'), 3000);
      };
      player.addEventListener('pointerenter', warm);
      player.addEventListener('focusin', warm);
      player.addEventListener('pointermove', wake);
      player.addEventListener('pointerleave', () => {
        clearTimeout(hoverTimer);
        player.setAttribute('data-videoinline-hover', 'idle');
      });

      player._videoinlineReady = true;

      if (!inWebflowEditor) {
        setPoster();
        setState('idle');
        setLoading(false);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', init);

  // Re-scan after CMS/interaction driven DOM changes. Cards that were flagged
  // as initialised but never finished (attribute added late) are released.
  const refresh = () => {
    document.querySelectorAll('[data-videoinline-player]').forEach((player) => {
      if (player.dataset.scriptInitialized && !player._videoinlineReady) {
        delete player.dataset.scriptInitialized;
      }
    });
    init();
  };
  window.videoinlineRefresh = refresh;
  window.addEventListener('videoinline:refresh', refresh);
})();