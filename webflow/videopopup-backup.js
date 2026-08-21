document.addEventListener('DOMContentLoaded', function () {
    // Skip animation setup while editing in the Webflow Designer/Editor.
    const inWebflowEditor = document.documentElement.classList.contains('wf-design-mode') || document.documentElement.classList.contains('w-editor') || window.Webflow?.env?.('design') || window.Webflow?.env?.('editor');

    document.querySelectorAll('.videopop_wrap').forEach((component) => {
      if (component.dataset.scriptInitialized) return;
      component.dataset.scriptInitialized = 'true';

      const backdrop = component.querySelector('[data-videopop-backdrop]');
      const dialog = component.querySelector('.videopop_dialog');
      const player = component.querySelector('[data-videopop-player]');
      const video = component.querySelector('[data-videopop-video]');
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

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Warm the first frame when the user hovers an opener, so the player is
      // never blank. Set to false to only load on click.
      const WARM_ON_HOVER = true;

      // --- State helpers -------------------------------------------------
      const playIcons = component.querySelectorAll('.videopop_play_icon');
      const pauseIcons = component.querySelectorAll('.videopop_pause_icon');
      const playLabel = component.querySelector('.videopop_playpause_label');
      const bigBtnWrap = component.querySelector('.videopop_bigbtn_wrap');

      const setState = (s) => {
        player.setAttribute('data-videopop-state', s);
        const playing = s === 'playing';
        playIcons.forEach((el) => {
          el.style.display = playing ? 'none' : 'block';
        });
        pauseIcons.forEach((el) => {
          el.style.display = playing ? 'block' : 'none';
        });
        if (playLabel) playLabel.textContent = playing ? 'Pause' : 'Play';
        // Big center button only visible when not playing.
        if (bigBtnWrap) {
          bigBtnWrap.style.opacity = playing ? '0' : '1';
          bigBtnWrap.style.pointerEvents = playing ? 'none' : 'auto';
        }
      };
      const setHover = (s) => player.setAttribute('data-videopop-hover', s);
      const setLoading = (on) => {
        loading.style.opacity = on ? '1' : '0';
        loading.style.visibility = on ? 'visible' : 'hidden';
      };

      // --- Time formatting ----------------------------------------------
      const pad2 = (n) => (n < 10 ? '0' : '') + n;
      const formatTime = (sec) => {
        if (!isFinite(sec) || sec < 0) return '00:00';
        const s = Math.floor(sec);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const r = s % 60;
        return h > 0 ? `${h}:${pad2(m)}:${pad2(r)}` : `${pad2(m)}:${pad2(r)}`;
      };

      // --- Progress / time UI (declared early so reset can use them) ------
      const updateTimeText = () => {
        if (progressText) progressText.textContent = formatTime(video.currentTime);
        if (durationText) durationText.textContent = formatTime(video.duration);
      };
      const updateProgressVisuals = () => {
        if (!video.duration) return;
        const pct = (video.currentTime / video.duration) * 100;
        progressBar.style.transform = `translateX(${-100 + pct}%)`;
        handle.style.left = `${pct}%`;
      };

      // --- Source + poster + title ---------------------------------------
      // Tracks WHICH src is loaded rather than a boolean, so a different
      // opener can swap the video instead of being ignored.
      let loadedSrc = null;

      const loadSource = () => {
        const raw = player.getAttribute('data-videopop-src');
        if (!raw) return;
        if (loadedSrc === raw) return; // same video, already loaded
        loadedSrc = raw;

        // Optional real thumbnail image, if data-videopop-poster is supplied.
        const poster = player.getAttribute('data-videopop-poster');
        if (poster) video.poster = poster;
        else video.removeAttribute('poster');

        // The #t=0.1 media fragment forces the browser to range-request,
        // decode and PAINT that frame while paused. Without it a <video>
        // with preload="metadata" and no poster renders as an empty box.
        video.src = raw.indexOf('#') === -1 ? raw + '#t=0.1' : raw;
        video.load();
      };

      // Always show the player from the beginning.
      const resetToStart = () => {
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
        if (title && titleText) titleText.textContent = title;
      };

      // Copy per-instance data from an opener element onto the player.
      const applyOpener = (opener) => {
        if (!opener) return;
        if (opener.dataset.videopopSrc) player.setAttribute('data-videopop-src', opener.dataset.videopopSrc);
        if (opener.dataset.videopopTitle) player.setAttribute('data-videopop-title', opener.dataset.videopopTitle);
        if (opener.dataset.videopopPoster) player.setAttribute('data-videopop-poster', opener.dataset.videopopPoster);
        syncTitle();
      };

      syncTitle();
      setState('paused');

      // --- Play / pause --------------------------------------------------
      const safePlay = () => {
        const p = video.play();
        if (p && typeof p.then === 'function') p.catch(() => {});
      };
      const togglePlay = () => {
        loadSource();
        if (video.paused || video.ended) {
          // Only show the spinner if we actually have to wait for data,
          // otherwise it flashes over the already-visible first frame.
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
        resetToStart();
      });

      // --- Mute + volume -------------------------------------------------
      const syncMuteIcons = () => {
        const up = component.querySelector('.videopop_volume_up_icon');
        const mute = component.querySelector('.videopop_volume_mute_icon');
        const muted = video.muted || video.volume === 0;
        up.style.display = muted ? 'none' : 'block';
        mute.style.display = muted ? 'block' : 'none';
      };
      const syncVolumeFill = () => {
        const pct = video.muted ? 0 : video.volume * 100;
        volumeFill.style.transform = `scaleX(${pct / 100})`;
      };
      muteButton.addEventListener('click', () => {
        video.muted = !video.muted;
        syncMuteIcons();
        syncVolumeFill();
      });

      const setVolumeFromX = (clientX) => {
        const rect = volumeSlider.getBoundingClientRect();
        let f = (clientX - rect.left) / rect.width;
        f = Math.min(1, Math.max(0, f));
        video.volume = f;
        video.muted = f === 0;
        syncMuteIcons();
        syncVolumeFill();
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
      volumeSlider.addEventListener('pointerup', () => {
        volDragging = false;
      });
      syncMuteIcons();
      syncVolumeFill();

      // --- Fullscreen ----------------------------------------------------
      fullscreenButton.addEventListener('click', () => {
        const active = document.fullscreenElement || document.webkitFullscreenElement;
        if (active) {
          (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        } else {
          (player.requestFullscreen || player.webkitRequestFullscreen)?.call(player);
        }
      });

      // --- Time text + progress -----------------------------------------
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
        if (!video.duration || !video.buffered.length) return;
        const end = video.buffered.end(video.buffered.length - 1);
        bufferedBar.style.transform = `translateX(${-100 + (end / video.duration) * 100}%)`;
      };
      video.addEventListener('progress', updateBuffered);
      video.addEventListener('durationchange', updateBuffered);

      // --- Seeking (pointer) --------------------------------------------
      let dragging = false;
      let wasPlaying = false;
      const fractionFromX = (clientX) => {
        const rect = timeline.getBoundingClientRect();
        let f = (clientX - rect.left) / rect.width;
        return Math.min(1, Math.max(0, f));
      };
      const previewAt = (f) => {
        const pct = f * 100;
        progressBar.style.transform = `translateX(${-100 + pct}%)`;
        handle.style.left = `${pct}%`;
        if (progressText && video.duration) progressText.textContent = formatTime(f * video.duration);
      };
      timeline.addEventListener('pointerdown', (e) => {
        if (!video.duration) return;
        dragging = true;
        wasPlaying = !video.paused && !video.ended;
        if (wasPlaying) video.pause();
        player.setAttribute('data-videopop-drag', 'true');
        handle.style.transform = 'translate(-50%, -50%) scale(1)';
        timeline.setPointerCapture?.(e.pointerId);
        previewAt(fractionFromX(e.clientX));
      });
      timeline.addEventListener('pointermove', (e) => {
        if (dragging) previewAt(fractionFromX(e.clientX));
      });
      timeline.addEventListener('pointerup', (e) => {
        if (!dragging) return;
        dragging = false;
        player.setAttribute('data-videopop-drag', 'false');
        handle.style.transform = 'translate(-50%, -50%) scale(0)';
        video.currentTime = fractionFromX(e.clientX) * video.duration;
        if (wasPlaying) safePlay();
        else {
          updateProgressVisuals();
          updateTimeText();
        }
      });

      // --- Hover / idle controls ----------------------------------------
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

      // --- Open / close --------------------------------------------------
      let isOpen = false;
      let lastFocused = null;

      const openPopup = (opener) => {
        if (isOpen) return;
        isOpen = true;
        lastFocused = document.activeElement;

        // Per-instance source/title/poster passed from the opener element.
        applyOpener(opener);

        component.style.visibility = 'visible';
        component.style.pointerEvents = 'auto';

        loadSource();
        resetToStart(); // always open at 00:00
        setState('paused');
        setLoading(false);

        if (reduceMotion) {
          gsap.set(backdrop, { opacity: 1 });
          gsap.set(dialog, { opacity: 1, y: 0 });
        } else {
          gsap.timeline().to(backdrop, { opacity: 1, duration: 0.4, ease: 'power2.out' }).fromTo(dialog, { opacity: 0, y: '2rem' }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }, '<');
        }
        dialog.focus();
      };

      const closePopup = () => {
        if (!isOpen) return;
        isOpen = false;
        video.pause();

        const finish = () => {
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
          gsap.timeline({ onComplete: finish }).to(dialog, { opacity: 0, y: '2rem', duration: 0.4, ease: 'power3.in' }).to(backdrop, { opacity: 0, duration: 0.35, ease: 'power2.in' }, '<');
        }
      };

      closeButtons.forEach((btn) => btn.addEventListener('click', closePopup));
      backdrop.addEventListener('click', closePopup);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) closePopup();
      });

      // READ: close the video popup, then open the content popup.
      readButton.addEventListener('click', () => {
        closePopup();
        const contentPopup = document.querySelector('.popup_wrap');
        if (contentPopup && contentPopup._openPopup) {
          contentPopup._openPopup();
        } else {
          const contentOpener = document.querySelector('[data-popup-open]');
          if (contentOpener) contentOpener.click();
        }
      });

      // Openers elsewhere on the page.
      document.querySelectorAll('[data-videopop-open]').forEach((opener) => {
        opener.addEventListener('click', () => openPopup(opener));

        // Preload the first frame on hover so the popup never flashes blank.
        if (WARM_ON_HOVER) {
          const warm = () => {
            if (isOpen) return;
            applyOpener(opener);
            loadSource();
          };
          opener.addEventListener('pointerenter', warm, { once: false });
          opener.addEventListener('focus', warm);
        }
      });

      // Expose opener for programmatic use.
      component._openVideoPopup = openPopup;

      // Reset to hidden start state on the live site.
      if (!inWebflowEditor) {
        component.style.visibility = 'hidden';
        component.style.pointerEvents = 'none';
        gsap.set(backdrop, { opacity: 0 });
        gsap.set(dialog, { opacity: 0, y: '2rem' });
      }
    });
  });