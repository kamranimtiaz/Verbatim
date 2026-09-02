
  //// CARD META — OPACITY HANDOFF //////
  // The scroll reveals fade .card_poster_meta up to full opacity. But on inline
  // video cards that same element is owned by videoinline.js, which drives
  // --videoinline--idle (1 while idle, 0 once playback starts) to hide the
  // WATCH button and duration on play. A tween finishing on a literal
  // opacity:1 would win over that variable and strand the meta visible.
  //
  // So once a reveal completes, swap the inline opacity from the tweened number
  // to the variable expression. Cards with no inline player have no such
  // variable, hence the `, 1` fallback — they simply stay at full opacity.
  function releaseMetaOpacity(meta) {
    if (!meta) return;
    gsap.set(meta, { clearProps: 'opacity' });
    meta.style.opacity = 'var(--videoinline--idle, 1)';
  }

  //// HERO INTRO — SCROLL LOCK + PRE-PAINT HIDE //////
  // Runs inline, not on DOMContentLoaded: the hero has to be hidden before the
  // first paint or it flashes at full opacity and then snaps back for the
  // intro. A stylesheet rule would be the cleaner home for this, but the hero
  // styles live in Webflow, so the initial state is set from here instead.
  (function () {
    // Scoped to .hero_wrap: the featured sections reuse .hero_title and
    // .hero_subheading, and those reveal on scroll, not on load.
    var HERO_SEL = '.hero_wrap .hero_title, .hero_wrap .hero_subheading, ' +
      '.hero_wrap .hero_media_wrap, .hero_wrap .hero_media_meta, ' +
      '.hero_wrap .hero_pill_wrap, .hero_wrap .hero_link_wrap';

    var style = document.createElement('style');
    style.setAttribute('data-hero-intro', '');
    style.textContent =
      'html.hero-intro-lock, html.hero-intro-lock body { overflow: hidden; }' +
      // touch-action stops iOS rubber-banding the locked page.
      'html.hero-intro-lock body { touch-action: none; }' +
      'html.hero-intro-armed ' + HERO_SEL.split(', ').join(', html.hero-intro-armed ') +
      ' { opacity: 0; }' +
      // Static popup pages (/about, /donate, a shared article link) have no
      // hero; the popup itself is the page content, and it plays the same
      // beat the hero would. Park it out of sight before the first paint,
      // same reasoning as above.
      'html.hero-intro-armed [data-popup-static] .popup_backdrop { opacity: 0; }' +
      // Opacity only, deliberately no transform: the browser resolves a
      // percentage translate to a pixel matrix, which GSAP then reads back as
      // `y` rather than `yPercent`, and the tween below fights it. The offset
      // is GSAP's to own — this rule only has to stop the flash before it.
      'html.hero-intro-armed [data-popup-static] .popup_dialog { opacity: 0; }';
    (document.head || document.documentElement).appendChild(style);

    document.documentElement.classList.add('hero-intro-lock', 'hero-intro-armed');

    // Safety net: if GSAP never loads or the timeline throws, the page must not
    // stay locked and blank. Cleared by the intro once it takes over.
    window.__heroIntroRelease = function () {
      document.documentElement.classList.remove('hero-intro-lock', 'hero-intro-armed');
    };
    window.__heroIntroFailsafe = setTimeout(window.__heroIntroRelease, 6000);
  })();

  document.addEventListener('DOMContentLoaded', () => {
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

const canvas = document.createElement('canvas');
Object.assign(canvas.style, {
  position: 'fixed',
  inset: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: '2000',
});
document.body.appendChild(canvas);
const ctx = canvas.getContext('2d');

const TILE = 250;
const COVERAGE = 0.47;      // matches the discrete threshold at ~0.51
const [R, G, B] = [167, 165, 165];
const ALPHA = 51;            // 0.2 * 255, baked into pixel data — no element opacity

const tile = document.createElement('canvas');
tile.width = tile.height = TILE;
const tctx = tile.getContext('2d');

function makeTile() {
  const img = tctx.createImageData(TILE, TILE);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (Math.random() < COVERAGE) {
      d[i] = R;
      d[i + 1] = G;
      d[i + 2] = B;
      d[i + 3] = ALPHA;
    }
  }
  tctx.putImageData(img, 0, 0);
}

function paint() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y += TILE) {
    for (let x = 0; x < canvas.width; x += TILE) {
      ctx.drawImage(tile, x, y);
    }
  }
}

function resize() {
  canvas.width = Math.ceil(innerWidth * DPR);
  canvas.height = Math.ceil(innerHeight * DPR);
  ctx.imageSmoothingEnabled = false;
  paint();
}

makeTile();
resize();
addEventListener('resize', resize);
  });

  //// BRAND SHUFFLE + FLIP TO NAV //////
  document.addEventListener('DOMContentLoaded', function () {
    // CSS holds .nav_brand_name at opacity 0, so every bail-out below has to
    // put the logo back or it stays invisible for good.
    function reveal() {
      var el = document.querySelector('.nav_brand_name');
      if (el) el.style.opacity = '1';
      // Every bail-out below lands here, and each one skips the hero timeline.
      // Unlock and unhide so a missing plugin costs the animation, not the page.
      clearTimeout(window.__heroIntroFailsafe);
      window.__heroIntroRelease();
    }

    if (typeof gsap === 'undefined' || typeof Flip === 'undefined' || typeof SplitText === 'undefined') {
      reveal();
      return;
    }
    gsap.registerPlugin(Flip, SplitText);

    // CustomEase is a separate plugin from the two required above. It only
    // shapes the hero reveal, so a missing one falls back to a stock ease
    // rather than costing the whole intro.
    var HERO_EASE = 'power2.out';
    if (typeof CustomEase !== 'undefined') {
      gsap.registerPlugin(CustomEase);
      CustomEase.create('relaxed', 'M0,0 C0.7,0 0.3,1 1,1');
      HERO_EASE = 'relaxed';
    }

    var BRAND = {
      iterations: 10,
      interval: 50,
      maxDelay: 1500,
      fade: 0.3,
      hold: 0.25,
      duration: 1.1,
      ease: 'power3.inOut',
      linkAt: 0.9,      // fires at 90% of the brand's move
      linkDuration: 0.6,
      linkStagger: 0.08,
    };

    var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>,0123456789';

    var brandText = document.querySelector('.nav_brand_text');
    var brandName = document.querySelector('.nav_brand_name');
    var navWrap = document.querySelector('.nav_wrap');
    var navLinks = gsap.utils.toArray('.nav_link_text');

    if (!brandText || !brandName) {
      reveal();
      return;
    }

    // .nav_brand_name is position:fixed during the intro, so it occupies no
    // space and the nav row lays out without it. Reserve its real height on the
    // parent now, otherwise the nav links jump down the moment it returns to
    // flow. Measured by briefly restoring flow before anything is painted.
    var brandWrap = brandName.parentElement;

    function reserveHeight() {
      if (!brandWrap) return;
      var pos = brandName.style.position;
      brandName.style.position = 'relative';
      var h = brandName.getBoundingClientRect().height;
      brandName.style.position = pos;
      if (h) brandWrap.style.minHeight = h + 'px';
    }

    reserveHeight();
    // Re-measure once the real face is in: a fallback font would have reserved
    // the wrong height.
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserveHeight);

    var split = new SplitText(brandText, { type: 'chars' });
    var chars = split.chars;
    if (!chars.length) {
      reveal();
      return;
    }

    var finals = chars.map(function (c) { return c.textContent; });

    // Per-char scramble as a single tween: each char gets a random start offset
    // and locks to its final glyph once its share of the run has elapsed.
    // Driven off one tweened value so it can sit on the master timeline and be
    // seeked, paused or reversed like any other tween.
    // Shared so each char's fade-in lands exactly when its scramble starts.
    var starts = chars.map(function () { return Math.random() * (BRAND.maxDelay / 1000); });

    function buildShuffle() {
      var run = (BRAND.iterations * BRAND.interval) / 1000;
      var total = Math.max.apply(null, starts) + run;
      var lastStep = -1;
      var state = { t: 0 };

      return gsap.to(state, {
        t: total,
        duration: total,
        ease: 'none',
        onStart: function () {
          gsap.set(chars, { opacity: 0 });
          gsap.set(brandName, { opacity: 1 });
        },
        onUpdate: function () {
          // Repaint on the glyph interval rather than every frame.
          var step = Math.floor(state.t / (BRAND.interval / 1000));
          if (step === lastStep) return;
          lastStep = step;

          for (var i = 0; i < chars.length; i++) {
            var elapsed = state.t - starts[i];
            if (elapsed < 0) continue;
            chars[i].textContent = elapsed >= run
              ? finals[i]
              : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          }
        },
        onComplete: function () {
          for (var i = 0; i < chars.length; i++) chars[i].textContent = finals[i];
        },
      });
    }

    // Each char fades in as its own scramble begins.
    function buildCharFades() {
      var tl = gsap.timeline();
      chars.forEach(function (char, i) {
        tl.to(char, { opacity: 1, duration: BRAND.fade, ease: 'none' }, starts[i]);
      });
      return tl;
    }

    // Flip has to measure when it runs, not when the timeline is built, so it
    // is kicked off from a callback. The empty tween beside it reserves the
    // same duration on the master so following steps line up behind the move.
    function buildFlip() {
      var tl = gsap.timeline();

      tl.call(function () {
        gsap.killTweensOf(chars);
        // Revert before measuring: SplitText's inline-block chars round
        // advances and drop kerning, so restoring plain text reflows the word.
        // Doing it here lets the move absorb the reflow.
        split.revert();

        var state = Flip.getState(brandName);

        brandName.style.position = 'relative';
        brandName.style.top = 'auto';
        brandName.style.left = 'auto';
        brandName.style.transform = 'none';

        Flip.from(state, {
          duration: BRAND.duration,
          ease: BRAND.ease,
          scale: true,
          // The nav sits above everything while the brand flies over the page.
          // Once it has landed in the bar, drop it back under the popups.
          onComplete: function () {
            if (navWrap) navWrap.style.zIndex = '1000';
          },
        });
      }, null, 0);

      tl.to({}, { duration: BRAND.duration }, 0);

      return tl;
    }

    var master = gsap.timeline();

    master
      .addLabel('shuffle')
      .add(buildShuffle(), 0)
      .add(buildCharFades(), 0)
      .addLabel('hold')
      .to({}, { duration: BRAND.hold })
      .addLabel('settle')
      .add(buildFlip());

    if (navWrap) {
      master.to(navWrap, {
        height: 'auto',
        duration: BRAND.duration,
        ease: BRAND.ease,
        onComplete: function () { navWrap.style.inset = 'auto'; },
      }, 'settle');
    }

    if (navLinks.length) {
      // The CSS parks these at translateY(100%), but getComputedStyle resolves
      // that to a pixel matrix, so GSAP records it as y, not yPercent. Tween y
      // to 0 to clear the value it actually parsed.
      master.addLabel('links', 'settle+=' + BRAND.duration * BRAND.linkAt);
      master.to(navLinks, {
        y: 0,
        duration: BRAND.linkDuration,
        stagger: BRAND.linkStagger,
        ease: 'power3.out',
      }, 'links');
    }

    //// HERO CONTENT REVEAL //////
    // Rides the tail of the brand/nav intro: heading, subheading, media (with
    // the meta row revealed a beat later), then the filter pills.
    var HERO = {
      fade: 0.84,
      rise: 24,          // px non-split elements lift as they fade in
      ease: HERO_EASE,
      titleAt: '-=0.42', // overlaps the nav links settling
      subLag: 0.216,
      lineStagger: 0.09, // between lines within one block
      lineFade: 0.9,     // masked lines ride up rather than fading, so slower
      mediaLag: 0.144,
      mediaFade: 1.08,
      metaDelay: 0.54,   // the "delayed reveal" inside the media block
      metaFade: 0.6,
      pillLag: 0.12,
      pillFade: 0.6,
      pillStagger: 0.108,
      linkLag: 0.06,     // social icons trail the last pill
      linkFade: 0.6,
      linkStagger: 0.09,
    };

    // Scope to the hero section; the featured sections reuse these classes.
    // Kept as its own variable: `heroRoot` falls back to `document` when there
    // is no hero, so a page without one can still match .hero_title etc. in
    // unrelated content. Only this tells you a hero is genuinely present.
    var heroWrap = document.querySelector('.hero_wrap');
    var heroRoot = heroWrap || document;
    var heroTitle = heroRoot.querySelector('.hero_title');
    var heroSub = heroRoot.querySelector('.hero_subheading');
    var heroSplits = [];

    var heroMedia = heroRoot.querySelector('.hero_media_wrap');
    var heroMeta = heroRoot.querySelector('.hero_media_meta');
    var heroPills = gsap.utils.toArray(heroRoot.querySelectorAll('.hero_pill_wrap'));
    var heroLinks = gsap.utils.toArray(heroRoot.querySelectorAll('.hero_link_wrap'));

    // Split into lines wrapped in overflow:hidden masks, so each line can be
    // driven up from below its own clip edge instead of just fading.
    function splitLines(el) {
      if (!el) return null;
      var split = new SplitText(el, {
        type: 'lines',
        linesClass: 'hero_line',
        // Without this the mask clips descenders (g, y, p) on the last line.
        reduceWhiteSpace: false,
      });
      if (!split.lines.length) return null;

      split.lines.forEach(function (line) {
        var mask = document.createElement('span');
        mask.className = 'hero_line_mask';
        mask.style.display = 'block';
        mask.style.overflow = 'hidden';
        line.parentNode.insertBefore(mask, line);
        mask.appendChild(line);
        line.style.display = 'block';
        line.style.willChange = 'transform';
      });

      heroSplits.push(split);
      return split.lines;
    }

    // Bail out entirely if the hero is not on this page. Both conditions
    // matter: no .hero_wrap means the .hero_* lookups above fell back to a
    // document-wide search and any match is incidental, not a real hero.
    var heroAll = [heroTitle, heroSub, heroMedia, heroMeta].filter(Boolean)
        .concat(heroPills, heroLinks);

    if (heroWrap && heroAll.length) {
      // Headings stay hidden by the armed class until the split runs, so the
      // un-split text never shows. Everything else can be set up now.
      gsap.set([heroMedia, heroMeta].filter(Boolean), { opacity: 0 });
      if (heroPills.length) gsap.set(heroPills, { opacity: 0, y: HERO.rise });
      if (heroLinks.length) gsap.set(heroLinks, { opacity: 0, y: HERO.rise });

      // The hero sits ~3s into the master timeline. Splitting now would measure
      // against whatever face is loaded at DOMContentLoaded and bake in line
      // breaks that a late webfont then invalidates, leaving text clipped
      // inside stale masks. So split at playback time and build the line tweens
      // right there, dropped onto a nested timeline that holds the hero slot.
      var heroLines = gsap.timeline();

      heroLines.call(function () {
        var titleLines = splitLines(heroTitle);
        var subLines = splitLines(heroSub);

        // Masks are in place and lines are parked below them; safe to unhide.
        if (titleLines) gsap.set(titleLines, { yPercent: 100 });
        if (subLines) gsap.set(subLines, { yPercent: 100 });
        gsap.set([heroTitle, heroSub].filter(Boolean), { opacity: 1 });
        document.documentElement.classList.remove('hero-intro-armed');

        var sub = heroTitle ? HERO.subLag : 0;

        if (titleLines) {
          gsap.to(titleLines, {
            yPercent: 0,
            duration: HERO.lineFade,
            stagger: HERO.lineStagger,
            ease: HERO.ease,
          });
        } else if (heroTitle) {
          gsap.fromTo(heroTitle, { y: HERO.rise }, {
            y: 0,
            duration: HERO.fade,
            ease: HERO.ease,
          });
        }

        if (subLines) {
          gsap.to(subLines, {
            yPercent: 0,
            duration: HERO.lineFade,
            stagger: HERO.lineStagger,
            delay: sub,
            ease: HERO.ease,
          });
        } else if (heroSub) {
          gsap.fromTo(heroSub, { y: HERO.rise }, {
            y: 0,
            duration: HERO.fade,
            delay: sub,
            ease: HERO.ease,
          });
        }
      }, null, 0);

      // Reserve the headings' real span on the master so the media and pills
      // still queue up behind them, the way the flip step does above.
      heroLines.to({}, { duration: HERO.lineFade + HERO.subLag }, 0);

      master.add(heroLines, HERO.titleAt);

      if (heroMedia) {
        // '>' is the end of heroLines, which spans both headings. A '<' here
        // would start the media at the title's first line instead.
        master.to(heroMedia, {
          opacity: 1,
          duration: HERO.mediaFade,
          ease: HERO.ease,
        }, '>-' + HERO.mediaLag);

        // Meta sits inside the media wrap, so its own opacity multiplies with
        // the parent's. Starting it after the wrap has landed keeps the label
        // row from ghosting in behind the poster.
        if (heroMeta) {
          master.to(heroMeta, {
            opacity: 1,
            duration: HERO.metaFade,
            ease: HERO.ease,
          }, '<' + HERO.metaDelay);
        }
      }

      if (heroPills.length) {
        master.to(heroPills, {
          opacity: 1,
          y: 0,
          duration: HERO.pillFade,
          stagger: HERO.pillStagger,
          ease: HERO.ease,
        }, '<' + HERO.pillLag);
      }

      // Social icons share the pills' row, so they read as one run: they pick
      // up where the pill stagger left off rather than starting their own
      // beat. '<' when there are no pills so they still ride the media tween.
      if (heroLinks.length) {
        master.to(heroLinks, {
          opacity: 1,
          y: 0,
          duration: HERO.linkFade,
          stagger: HERO.linkStagger,
          ease: HERO.ease,
        }, heroPills.length ? '<' + (heroPills.length * HERO.pillStagger + HERO.linkLag)
                            : '<' + HERO.pillLag);
      }
    }

    //// STATIC POPUP INTRO //////
    // Pages that ARE a popup (/about, /donate, a shared article link) carry
    // `data-popup-static` on the popup root. They have no hero, so the popup
    // takes the hero's slot on the master timeline and reveals on the same
    // beat: backdrop first, then the dialog rising into it.
    //
    // contentpopup.js deliberately leaves these alone — a static popup ships
    // already open, so it has no open animation of its own to conflict with.
    // The pre-paint rule at the top of this file parks both elements; the
    // tweens below are what actually put them back, so every bail-out path
    // must clear `hero-intro-armed` or the page stays blank.
    var STATIC_POP = {
      backdropFade: 0.5,
      dialogRise: 0.9,
      dialogLag: 0.25,   // dialog starts while the backdrop is still fading up
      startAt: '-=0.42', // same overlap with the nav links as HERO.titleAt
    };

    var staticPopup = document.querySelector('[data-popup-static]');
    var staticBackdrop = staticPopup && staticPopup.querySelector('.popup_backdrop');
    var staticDialog = staticPopup && staticPopup.querySelector('.popup_dialog');

    // Only when there is no hero: a page with both would be a layout we do not
    // ship, and racing two reveals for the same slot looks broken. Tested on
    // .hero_wrap, not heroAll — see the heroRoot note above; a static popup
    // page can match stray .hero_* classes inside its own content.
    if (!heroWrap && staticPopup && (staticBackdrop || staticDialog)) {
      // The armed class hides these via CSS. GSAP has to own the values before
      // it comes off, or they flash at full opacity for a frame in between.
      if (staticBackdrop) gsap.set(staticBackdrop, { opacity: 0 });
      // y: 0 alongside yPercent so GSAP owns both channels. Webflow may ship
      // its own transform on this element, and a pixel offset left in `y`
      // would survive a yPercent-only tween and strand the dialog off-screen.
      if (staticDialog) gsap.set(staticDialog, { opacity: 0, y: 0, yPercent: 100 });

      var popTl = gsap.timeline();

      popTl.call(function () {
        document.documentElement.classList.remove('hero-intro-armed');
      }, null, 0);

      if (staticBackdrop) {
        popTl.to(staticBackdrop, {
          opacity: 1,
          duration: STATIC_POP.backdropFade,
          ease: HERO.ease,
        }, 0);
      }

      if (staticDialog) {
        popTl.to(staticDialog, {
          opacity: 1,
          y: 0,
          yPercent: 0,
          duration: STATIC_POP.dialogRise,
          ease: HERO.ease,
        }, staticBackdrop ? STATIC_POP.dialogLag : 0);
      }

      master.add(popTl, STATIC_POP.startAt);
    }

    // Scroll comes back only once the whole intro has played out.
    master.eventCallback('onComplete', function () {
      clearTimeout(window.__heroIntroFailsafe);
      window.__heroIntroRelease();

      // Put the headings back to plain text once they have landed. The line
      // wrappers round advances and block normal reflow, so leaving them in
      // would make the hero re-wrap badly on resize.
      heroSplits.forEach(function (split) {
        var masks = [];
        split.lines.forEach(function (line) {
          var mask = line.parentNode;
          if (mask && mask.className === 'hero_line_mask') masks.push(mask);
          line.style.willChange = '';
        });
        split.revert();
        masks.forEach(function (mask) {
          if (mask.parentNode) mask.parentNode.removeChild(mask);
        });
      });
      heroSplits.length = 0;
    });
  });

  //// FEATURED SECTIONS — SAME REVEAL, ON SCROLL //////
  // Same masked-line + fade sequence as the hero, but each .featured_layout
  // runs its own timeline when it reaches 80% down the viewport.
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof gsap === 'undefined' || typeof SplitText === 'undefined' ||
        typeof ScrollTrigger === 'undefined') {
      return;
    }
    gsap.registerPlugin(SplitText, ScrollTrigger);

    var EASE = 'power2.out';
    if (typeof CustomEase !== 'undefined') {
      gsap.registerPlugin(CustomEase);
      // Reuse the hero's curve; create() is idempotent for the same name.
      CustomEase.create('relaxed', 'M0,0 C0.7,0 0.3,1 1,1');
      EASE = 'relaxed';
    }

    var FEAT = {
      lineFade: 0.9,
      lineStagger: 0.09,
      subLag: 0.216,
      mediaLag: 0.144,
      mediaFade: 1.08,
      metaDelay: 0.54,
      metaFade: 0.6,
      start: 'top 80%',
    };

    function splitLines(el, store) {
      if (!el) return null;
      var split = new SplitText(el, {
        type: 'lines',
        linesClass: 'featured_line',
        reduceWhiteSpace: false,
      });
      if (!split.lines.length) return null;

      split.lines.forEach(function (line) {
        var mask = document.createElement('span');
        mask.className = 'featured_line_mask';
        mask.style.display = 'block';
        mask.style.overflow = 'hidden';
        line.parentNode.insertBefore(mask, line);
        mask.appendChild(line);
        line.style.display = 'block';
        line.style.willChange = 'transform';
      });

      store.push(split);
      return split.lines;
    }

    function clearSplits(store) {
      store.forEach(function (split) {
        var masks = [];
        split.lines.forEach(function (line) {
          var mask = line.parentNode;
          if (mask && mask.className === 'featured_line_mask') masks.push(mask);
          line.style.willChange = '';
        });
        split.revert();
        masks.forEach(function (mask) {
          if (mask.parentNode) mask.parentNode.removeChild(mask);
        });
      });
      store.length = 0;
    }

    gsap.utils.toArray('.featured_layout').forEach(function (layout) {
      var title = layout.querySelector('.hero_title');
      var sub = layout.querySelector('.hero_subheading');
      var media = layout.querySelector('.featured_media_wrap');
      var meta = layout.querySelector('.featured_media_meta');

      if (!title && !sub && !media) return;

      var splits = [];

      // Hide up front so nothing shows before the trigger fires. Headings are
      // hidden as whole elements here and unhidden once their masks exist,
      // which avoids splitting every section on load.
      gsap.set([title, sub, media, meta].filter(Boolean), { opacity: 0 });

      ScrollTrigger.create({
        trigger: layout,
        start: FEAT.start,
        once: true,
        onEnter: function () {
          // Split at trigger time, so lines measure against the loaded font
          // and the current column width.
          var titleLines = splitLines(title, splits);
          var subLines = splitLines(sub, splits);

          if (titleLines) gsap.set(titleLines, { yPercent: 100 });
          if (subLines) gsap.set(subLines, { yPercent: 100 });
          gsap.set([title, sub].filter(Boolean), { opacity: 1 });

          var tl = gsap.timeline({
            onComplete: function () { clearSplits(splits); },
          });

          if (titleLines) {
            tl.to(titleLines, {
              yPercent: 0,
              duration: FEAT.lineFade,
              stagger: FEAT.lineStagger,
              ease: EASE,
            }, 0);
          }

          if (subLines) {
            tl.to(subLines, {
              yPercent: 0,
              duration: FEAT.lineFade,
              stagger: FEAT.lineStagger,
              ease: EASE,
            }, title ? FEAT.subLag : 0);
          }

          if (media) {
            // '>' is the end of whatever heading tweens landed above. With no
            // headings the timeline is empty and '>' resolves to 0, so the
            // media just starts immediately, which is what we want.
            tl.to(media, {
              opacity: 1,
              duration: FEAT.mediaFade,
              ease: EASE,
            }, (titleLines || subLines) ? '>-' + FEAT.mediaLag : 0);

            if (meta) {
              tl.to(meta, {
                opacity: 1,
                duration: FEAT.metaFade,
                ease: EASE,
              }, '<' + FEAT.metaDelay);
            }
          }
        },
      });
    });
  });

  //// FULL INVESTIGATION — HEADING + CARD GRID REVEAL //////
  // The heading uses the same masked-line lift as the hero and featured
  // sections. The cards fade up, and how they group depends on the layout:
  // side by side on desktop they share one trigger and stagger against each
  // other, stacked on mobile each card waits for its own scroll position.
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof gsap === 'undefined' || typeof SplitText === 'undefined' ||
        typeof ScrollTrigger === 'undefined') {
      return;
    }
    gsap.registerPlugin(SplitText, ScrollTrigger);

    var EASE = 'power2.out';
    if (typeof CustomEase !== 'undefined') {
      gsap.registerPlugin(CustomEase);
      // Same curve as the hero; create() is idempotent for a given name.
      CustomEase.create('relaxed', 'M0,0 C0.7,0 0.3,1 1,1');
      EASE = 'relaxed';
    }

    var INV = {
      rise: 28,
      headingFade: 0.9,
      headingStagger: 0.09,
      // Order within a card: player, then the WATCH/READ meta row, then the
      // title and date underneath it.
      playerFade: 0.9,
      metaLag: 0.22,
      metaFade: 0.6,
      infoLag: 0.14,
      infoFade: 0.6,
      infoStagger: 0.08,
      // Gap between cards when they animate as one group.
      cardStagger: 0.16,
      headingToCards: 0.24,
      start: 'top 80%',
      // Below this the grid is stacked, so cards get individual triggers.
      stackedBelow: 767,
    };

    var section = document.querySelector('.investigation_wrap');
    if (!section) return;

    var heading = section.querySelector('.investigation_title');
    var cards = gsap.utils.toArray(section.querySelectorAll('.card_wrap'));
    if (!heading && !cards.length) return;

    // Hidden up front so nothing shows before its trigger fires. The heading
    // is hidden as a whole element and unhidden once its masks exist, which
    // avoids splitting on load.
    var parts = cards.map(function (card) {
      var part = {
        card: card,
        player: card.querySelector('.card_player'),
        meta: card.querySelector('.card_poster_meta'),
        info: gsap.utils.toArray([
          card.querySelector('.card_title'),
          card.querySelector('.card_date'),
        ].filter(Boolean)),
      };
      var targets = [part.player, part.meta].filter(Boolean).concat(part.info);
      if (targets.length) gsap.set(targets, { opacity: 0, y: INV.rise });
      return part;
    }).filter(function (part) {
      return part.player || part.meta || part.info.length;
    });

    if (heading) gsap.set(heading, { opacity: 0 });

    var splits = [];

    function splitLines(el) {
      if (!el) return null;
      var split = new SplitText(el, {
        type: 'lines',
        linesClass: 'investigation_line',
        reduceWhiteSpace: false,
      });
      if (!split.lines.length) return null;

      split.lines.forEach(function (line) {
        var mask = document.createElement('span');
        mask.className = 'investigation_line_mask';
        mask.style.display = 'block';
        mask.style.overflow = 'hidden';
        line.parentNode.insertBefore(mask, line);
        mask.appendChild(line);
        line.style.display = 'block';
        line.style.willChange = 'transform';
      });

      splits.push(split);
      return split.lines;
    }

    function clearSplits() {
      splits.forEach(function (split) {
        var masks = [];
        split.lines.forEach(function (line) {
          var mask = line.parentNode;
          if (mask && mask.className === 'investigation_line_mask') masks.push(mask);
          line.style.willChange = '';
        });
        split.revert();
        masks.forEach(function (mask) {
          if (mask.parentNode) mask.parentNode.removeChild(mask);
        });
      });
      splits.length = 0;
    }

    // Lays one card's tween sequence onto `tl` starting at `at`.
    function addCard(tl, part, at) {
      if (part.player) {
        tl.to(part.player, {
          opacity: 1,
          y: 0,
          duration: INV.playerFade,
          ease: EASE,
        }, at);
      }

      if (part.meta) {
        tl.to(part.meta, {
          opacity: 1,
          y: 0,
          duration: INV.metaFade,
          ease: EASE,
          // Hand opacity back to the inline player once the reveal lands.
          // videoinline.js drives --videoinline--idle to fade the WATCH/time
          // meta out on play; a literal opacity:1 left here would override it.
          onComplete: function () {
            releaseMetaOpacity(part.meta);
          },
        }, part.player ? at + INV.metaLag : at);
      }

      if (part.info.length) {
        var infoAt = at;
        if (part.meta) infoAt += INV.metaLag + INV.infoLag;
        else if (part.player) infoAt += INV.infoLag;

        tl.to(part.info, {
          opacity: 1,
          y: 0,
          duration: INV.infoFade,
          stagger: INV.infoStagger,
          ease: EASE,
        }, infoAt);
      }
    }

    // Two layouts, two groupings. ScrollTrigger.matchMedia hands each branch
    // its own revert, so switching breakpoints rebuilds the right triggers.
    var queries = {};

    // Stacked: every card is its own trigger, heading included.
    queries['(max-width: ' + INV.stackedBelow + 'px)'] = function () {
      if (heading) {
        ScrollTrigger.create({
          trigger: heading,
          start: INV.start,
          once: true,
          onEnter: function () {
            var lines = splitLines(heading);
            gsap.set(heading, { opacity: 1 });
            if (!lines) return;
            gsap.set(lines, { yPercent: 100 });
            gsap.to(lines, {
              yPercent: 0,
              duration: INV.headingFade,
              stagger: INV.headingStagger,
              ease: EASE,
              onComplete: clearSplits,
            });
          },
        });
      }

      parts.forEach(function (part) {
        ScrollTrigger.create({
          trigger: part.card,
          start: INV.start,
          once: true,
          onEnter: function () {
            addCard(gsap.timeline(), part, 0);
          },
        });
      });
    };

    // Side by side: one trigger on the grid, cards staggered against it.
    queries['(min-width: ' + (INV.stackedBelow + 1) + 'px)'] = function () {
      ScrollTrigger.create({
        trigger: section,
        start: INV.start,
        once: true,
        onEnter: function () {
          // Split at trigger time so lines measure against the loaded font
          // and the current column width.
          var lines = heading ? splitLines(heading) : null;
          if (heading) gsap.set(heading, { opacity: 1 });
          if (lines) gsap.set(lines, { yPercent: 100 });

          var tl = gsap.timeline({ onComplete: clearSplits });
          var cardsAt = 0;

          if (lines) {
            tl.to(lines, {
              yPercent: 0,
              duration: INV.headingFade,
              stagger: INV.headingStagger,
              ease: EASE,
            }, 0);
            cardsAt = INV.headingToCards;
          }

          parts.forEach(function (part, i) {
            addCard(tl, part, cardsAt + i * INV.cardStagger);
          });
        },
      });
    };

    ScrollTrigger.matchMedia(queries);
  });

  //// ARTICLES — HEADING + ROW REVEAL //////
  // The heading gets the same masked-line lift as every other section. The
  // rows are single lines of text that already sit inside .articles_row_mask,
  // an overflow-hidden wrapper Webflow renders, so they need no SplitText —
  // the inner .articles_row_name / .articles_row_action lift straight out of
  // the mask they are already in.
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof gsap === 'undefined' || typeof SplitText === 'undefined' ||
        typeof ScrollTrigger === 'undefined') {
      return;
    }
    gsap.registerPlugin(SplitText, ScrollTrigger);

    var EASE = 'power2.out';
    if (typeof CustomEase !== 'undefined') {
      gsap.registerPlugin(CustomEase);
      // Same curve as the hero; create() is idempotent for a given name.
      CustomEase.create('relaxed', 'M0,0 C0.7,0 0.3,1 1,1');
      EASE = 'relaxed';
    }

    var ART = {
      headingFade: 0.9,
      headingStagger: 0.09,
      // A row lifts its name and its READ label together, the label trailing
      // slightly so the eye lands on the headline first.
      rowFade: 0.9,
      actionLag: 0.08,
      // The hairline background scales in under the row it belongs to.
      bgFade: 0.6,
      bgLag: 0.12,
      // Gap between rows when the list animates as one group.
      rowStagger: 0.12,
      headingToRows: 0.24,
      start: 'top 80%',
      // Below this the list is tall enough that rows earn their own trigger.
      stackedBelow: 767,
    };

    var section = document.querySelector('.articles_wrap');
    if (!section) return;

    var heading = section.querySelector('.articles_title');
    var rows = gsap.utils.toArray(section.querySelectorAll('.articles_row_wrap'));
    if (!heading && !rows.length) return;

    // Hidden up front so nothing shows before its trigger fires. The heading
    // is hidden as a whole element and unhidden once its masks exist, which
    // avoids splitting on load.
    var parts = rows.map(function (row) {
      var part = {
        row: row,
        bg: row.querySelector('.articles_row_bg'),
        name: row.querySelector('.articles_row_name'),
        action: row.querySelector('.articles_row_action'),
      };
      var lifts = [part.name, part.action].filter(Boolean);
      if (lifts.length) gsap.set(lifts, { yPercent: 100 });
      if (part.bg) gsap.set(part.bg, { opacity: 0 });
      return part;
    }).filter(function (part) {
      return part.bg || part.name || part.action;
    });

    if (heading) gsap.set(heading, { opacity: 0 });

    var splits = [];

    function splitLines(el) {
      if (!el) return null;
      var split = new SplitText(el, {
        type: 'lines',
        linesClass: 'articles_line',
        reduceWhiteSpace: false,
      });
      if (!split.lines.length) return null;

      split.lines.forEach(function (line) {
        var mask = document.createElement('span');
        mask.className = 'articles_line_mask';
        mask.style.display = 'block';
        mask.style.overflow = 'hidden';
        line.parentNode.insertBefore(mask, line);
        mask.appendChild(line);
        line.style.display = 'block';
        line.style.willChange = 'transform';
      });

      splits.push(split);
      return split.lines;
    }

    function clearSplits() {
      splits.forEach(function (split) {
        var masks = [];
        split.lines.forEach(function (line) {
          var mask = line.parentNode;
          if (mask && mask.className === 'articles_line_mask') masks.push(mask);
          line.style.willChange = '';
        });
        split.revert();
        masks.forEach(function (mask) {
          if (mask.parentNode) mask.parentNode.removeChild(mask);
        });
      });
      splits.length = 0;
    }

    // Lays one row's tween sequence onto `tl` starting at `at`.
    function addRow(tl, part, at) {
      if (part.name) {
        tl.to(part.name, {
          yPercent: 0,
          duration: ART.rowFade,
          ease: EASE,
        }, at);
      }

      if (part.action) {
        tl.to(part.action, {
          yPercent: 0,
          duration: ART.rowFade,
          ease: EASE,
        }, part.name ? at + ART.actionLag : at);
      }

      if (part.bg) {
        tl.to(part.bg, {
          opacity: 1,
          duration: ART.bgFade,
          ease: EASE,
        }, (part.name || part.action) ? at + ART.bgLag : at);
      }
    }

    // Two layouts, two groupings. ScrollTrigger.matchMedia hands each branch
    // its own revert, so switching breakpoints rebuilds the right triggers.
    var queries = {};

    // Stacked: every row is its own trigger, heading included.
    queries['(max-width: ' + ART.stackedBelow + 'px)'] = function () {
      if (heading) {
        ScrollTrigger.create({
          trigger: heading,
          start: ART.start,
          once: true,
          onEnter: function () {
            var lines = splitLines(heading);
            gsap.set(heading, { opacity: 1 });
            if (!lines) return;
            gsap.set(lines, { yPercent: 100 });
            gsap.to(lines, {
              yPercent: 0,
              duration: ART.headingFade,
              stagger: ART.headingStagger,
              ease: EASE,
              onComplete: clearSplits,
            });
          },
        });
      }

      parts.forEach(function (part) {
        ScrollTrigger.create({
          trigger: part.row,
          start: ART.start,
          once: true,
          onEnter: function () {
            addRow(gsap.timeline(), part, 0);
          },
        });
      });
    };

    // Full list in view: one trigger on the section, rows staggered down it.
    queries['(min-width: ' + (ART.stackedBelow + 1) + 'px)'] = function () {
      ScrollTrigger.create({
        trigger: section,
        start: ART.start,
        once: true,
        onEnter: function () {
          // Split at trigger time so lines measure against the loaded font
          // and the current column width.
          var lines = heading ? splitLines(heading) : null;
          if (heading) gsap.set(heading, { opacity: 1 });
          if (lines) gsap.set(lines, { yPercent: 100 });

          var tl = gsap.timeline({ onComplete: clearSplits });
          var rowsAt = 0;

          if (lines) {
            tl.to(lines, {
              yPercent: 0,
              duration: ART.headingFade,
              stagger: ART.headingStagger,
              ease: EASE,
            }, 0);
            rowsAt = ART.headingToRows;
          }

          parts.forEach(function (part, i) {
            addRow(tl, part, rowsAt + i * ART.rowStagger);
          });
        },
      });
    };

    ScrollTrigger.matchMedia(queries);
  });

  //// VIDEOS — HEADING + CARD GRID REVEAL //////
  // Same card component as the full investigation section, so the same
  // sequence per card: player, then the WATCH meta row, then title and date.
  // The difference is the grid: this one runs to several rows, so cards
  // stagger by their row rather than all at once off a single section
  // trigger — otherwise the bottom row plays long before it is on screen.
  document.addEventListener('DOMContentLoaded', function () {
    if (typeof gsap === 'undefined' || typeof SplitText === 'undefined' ||
        typeof ScrollTrigger === 'undefined') {
      return;
    }
    gsap.registerPlugin(SplitText, ScrollTrigger);

    var EASE = 'power2.out';
    if (typeof CustomEase !== 'undefined') {
      gsap.registerPlugin(CustomEase);
      // Same curve as the hero; create() is idempotent for a given name.
      CustomEase.create('relaxed', 'M0,0 C0.7,0 0.3,1 1,1');
      EASE = 'relaxed';
    }

    var VID = {
      rise: 28,
      headingFade: 0.9,
      headingStagger: 0.09,
      // Order within a card matches the investigation section.
      playerFade: 0.9,
      metaLag: 0.22,
      metaFade: 0.6,
      infoLag: 0.14,
      infoFade: 0.6,
      infoStagger: 0.08,
      // Gap between cards inside one row.
      cardStagger: 0.16,
      headingToCards: 0.24,
      start: 'top 80%',
      // Below this the grid is one column, so each card triggers alone.
      stackedBelow: 767,
    };

    var section = document.querySelector('.videos_wrap');
    if (!section) return;

    var heading = section.querySelector('.videos_title');
    var cards = gsap.utils.toArray(section.querySelectorAll('.card_wrap'));
    if (!heading && !cards.length) return;

    // Hidden up front so nothing shows before its trigger fires. The heading
    // is hidden as a whole element and unhidden once its masks exist, which
    // avoids splitting on load.
    var parts = cards.map(function (card) {
      var part = {
        card: card,
        player: card.querySelector('.card_player'),
        meta: card.querySelector('.card_poster_meta'),
        info: gsap.utils.toArray([
          card.querySelector('.card_title'),
          card.querySelector('.card_date'),
        ].filter(Boolean)),
      };
      var targets = [part.player, part.meta].filter(Boolean).concat(part.info);
      if (targets.length) gsap.set(targets, { opacity: 0, y: VID.rise });
      return part;
    }).filter(function (part) {
      return part.player || part.meta || part.info.length;
    });

    if (heading) gsap.set(heading, { opacity: 0 });

    var splits = [];

    function splitLines(el) {
      if (!el) return null;
      var split = new SplitText(el, {
        type: 'lines',
        linesClass: 'videos_line',
        reduceWhiteSpace: false,
      });
      if (!split.lines.length) return null;

      split.lines.forEach(function (line) {
        var mask = document.createElement('span');
        mask.className = 'videos_line_mask';
        mask.style.display = 'block';
        mask.style.overflow = 'hidden';
        line.parentNode.insertBefore(mask, line);
        mask.appendChild(line);
        line.style.display = 'block';
        line.style.willChange = 'transform';
      });

      splits.push(split);
      return split.lines;
    }

    function clearSplits() {
      splits.forEach(function (split) {
        var masks = [];
        split.lines.forEach(function (line) {
          var mask = line.parentNode;
          if (mask && mask.className === 'videos_line_mask') masks.push(mask);
          line.style.willChange = '';
        });
        split.revert();
        masks.forEach(function (mask) {
          if (mask.parentNode) mask.parentNode.removeChild(mask);
        });
      });
      splits.length = 0;
    }

    // Lays one card's tween sequence onto `tl` starting at `at`.
    function addCard(tl, part, at) {
      if (part.player) {
        tl.to(part.player, {
          opacity: 1,
          y: 0,
          duration: VID.playerFade,
          ease: EASE,
        }, at);
      }

      if (part.meta) {
        tl.to(part.meta, {
          opacity: 1,
          y: 0,
          duration: VID.metaFade,
          ease: EASE,
          // Hand opacity back to the inline player once the reveal lands.
          // videoinline.js drives --videoinline--idle to fade the WATCH/time
          // meta out on play; a literal opacity:1 left here would override it.
          onComplete: function () {
            releaseMetaOpacity(part.meta);
          },
        }, part.player ? at + VID.metaLag : at);
      }

      if (part.info.length) {
        var infoAt = at;
        if (part.meta) infoAt += VID.metaLag + VID.infoLag;
        else if (part.player) infoAt += VID.infoLag;

        tl.to(part.info, {
          opacity: 1,
          y: 0,
          duration: VID.infoFade,
          stagger: VID.infoStagger,
          ease: EASE,
        }, infoAt);
      }
    }

    // Groups cards by their laid-out top edge, so a wrapping grid animates a
    // row at a time. Measured at trigger-build time, which is after the CMS
    // list has rendered. Rounded to absorb sub-pixel differences between
    // cards that are meant to sit on the same line.
    function groupByRow(list) {
      var rows = [];
      var index = {};
      list.forEach(function (part) {
        var key = Math.round(part.card.getBoundingClientRect().top / 8);
        if (index[key] === undefined) {
          index[key] = rows.length;
          rows.push([]);
        }
        rows[index[key]].push(part);
      });
      return rows;
    }

    // Two layouts, two groupings. ScrollTrigger.matchMedia hands each branch
    // its own revert, so switching breakpoints rebuilds the right triggers.
    var queries = {};

    // Stacked: every card is its own trigger, heading included.
    queries['(max-width: ' + VID.stackedBelow + 'px)'] = function () {
      if (heading) {
        ScrollTrigger.create({
          trigger: heading,
          start: VID.start,
          once: true,
          onEnter: function () {
            var lines = splitLines(heading);
            gsap.set(heading, { opacity: 1 });
            if (!lines) return;
            gsap.set(lines, { yPercent: 100 });
            gsap.to(lines, {
              yPercent: 0,
              duration: VID.headingFade,
              stagger: VID.headingStagger,
              ease: EASE,
              onComplete: clearSplits,
            });
          },
        });
      }

      parts.forEach(function (part) {
        ScrollTrigger.create({
          trigger: part.card,
          start: VID.start,
          once: true,
          onEnter: function () {
            addCard(gsap.timeline(), part, 0);
          },
        });
      });
    };

    // Side by side: one trigger per grid row, cards staggered across it. The
    // heading rides along with the first row so the two read as one move.
    queries['(min-width: ' + (VID.stackedBelow + 1) + 'px)'] = function () {
      var rows = groupByRow(parts);

      rows.forEach(function (row, rowIndex) {
        var withHeading = heading && rowIndex === 0;

        ScrollTrigger.create({
          // The first row triggers off the section so the heading is counted
          // in; later rows trigger off their own leading card.
          trigger: withHeading ? section : row[0].card,
          start: VID.start,
          once: true,
          onEnter: function () {
            // Split at trigger time so lines measure against the loaded font
            // and the current column width.
            var lines = withHeading ? splitLines(heading) : null;
            if (withHeading) gsap.set(heading, { opacity: 1 });
            if (lines) gsap.set(lines, { yPercent: 100 });

            var tl = gsap.timeline(
              withHeading ? { onComplete: clearSplits } : undefined
            );
            var cardsAt = 0;

            if (lines) {
              tl.to(lines, {
                yPercent: 0,
                duration: VID.headingFade,
                stagger: VID.headingStagger,
                ease: EASE,
              }, 0);
              cardsAt = VID.headingToCards;
            }

            row.forEach(function (part, i) {
              addCard(tl, part, cardsAt + i * VID.cardStagger);
            });
          },
        });
      });
    };

    ScrollTrigger.matchMedia(queries);
  });
