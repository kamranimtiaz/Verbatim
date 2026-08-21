
  document.addEventListener('DOMContentLoaded', () => {
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

const canvas = document.createElement('canvas');
Object.assign(canvas.style, {
  position: 'fixed',
  inset: '0',
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: '1000',
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
  
  //// IMAGE REVEAL ANIMATION //////
  /**
  document.addEventListener("DOMContentLoaded", ()=> {

    gsap.registerPlugin(ScrollTrigger, SplitText);

    var CONFIG = {
      selector: '.hero_media_img, .feature_media_img, .investigation_card_img, .videos_card_img',
      fillColor: '#1a2906',
      duration: 1.5,
      once: true,
      zIndex: 2,
    };

    var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var VERTEX_SHADER = ['attribute vec2 position;', 'varying vec2 vUv;', 'void main() {', '  vUv = position;', '  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);', '}'].join('\n');

    var FRAGMENT_SHADER = ['#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif', 'uniform vec3 uFillColor;', 'uniform float uProgress;', 'uniform vec2 uTextureSize;', 'uniform vec2 uElementSize;', 'uniform sampler2D uTexture;', 'varying vec2 vUv;', 'float hashwithoutsine12(vec2 p) {', '  vec3 p3 = fract(vec3(p.xyx) * .1031);', '  p3 += dot(p3, p3.yzx + 33.33);', '  return fract((p3.x + p3.y) * p3.z);', '}', 'float map(float value, float min1, float max1, float min2, float max2) {', '  float val = min2 + (value - min1) * (max2 - min2) / (max1 - min1);', '  return clamp(val, min2, max2);', '}', 'void main() {', '  vec2 uv = vUv - vec2(0.5);', '  float aspect1 = uTextureSize.x / uTextureSize.y;', '  float aspect2 = uElementSize.x / uElementSize.y;', '  if (aspect1 > aspect2) { uv *= vec2(aspect2 / aspect1, 1.); }', '  else { uv *= vec2(1., aspect1 / aspect2); }', '  uv += vec2(0.5);', '  float uAspect = uElementSize.x / uElementSize.y;', '  vec4 defaultColor = texture2D(uTexture, uv);', '  float s = 120.;', '  vec2 gridSize = vec2(s, floor(s / uAspect));', '  vec2 newUV = floor(vUv * gridSize);', '  float pattern = hashwithoutsine12(newUV);', '  float w = 0.5;', '  float p0 = clamp(uProgress / 0.8, 0., 1.);', '  float p1 = clamp((uProgress - 0.2) / 0.8, 0., 1.);', '  p0 = map(p0, 0., 1., -w, 1.);', '  p0 = smoothstep(p0, p0 + w, 1. - vUv.y);', '  float p0_ = clamp(1. - 2. * p0 + pattern, 0., 1.);', '  p1 = map(p1, 0., 1., -w, 1.);', '  p1 = smoothstep(p1, p1 + w, 1. - vUv.y);', '  float p1_ = clamp(1. - 2. * p1 + pattern, 0., 1.);', '  vec3 finalColor = mix(uFillColor, defaultColor.rgb, p1_);', '  gl_FragColor = vec4(finalColor * p0_, p0_);', '}'].join('\n');

    function parseHexColor(input) {
      var hex = String(input || '')
        .trim()
        .replace(/^#/, '');
      if (hex.length === 3) {
        hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
      }
      var n = parseInt(hex, 16);
      if (hex.length !== 6 || isNaN(n)) return [0.25, 0.25, 0.72];
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }

    function compileProgram(gl) {
      function compile(type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          console.error('emerging-images shader:', gl.getShaderInfoLog(shader));
          return null;
        }
        return shader;
      }
      var vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      var fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (!vs || !fs) return null;
      var program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('emerging-images program:', gl.getProgramInfoLog(program));
        return null;
      }
      return program;
    }

    function EmergeItem(img) {
      this.img = img;
      this.parent = img.parentNode; // the wrapper (overflow:hidden)
      this.progress = 0;
      this.target = 0;
      this.lastDrawn = -1;
      this.texture = null;
      this.textureSize = [1, 1];
      this.fillColor = parseHexColor(img.getAttribute('data-emerge-color') || CONFIG.fillColor);
      this.ready = false;
      this.dead = false;
      this.build();
    }

    EmergeItem.prototype.build = function () {
      var pos = window.getComputedStyle(this.parent).position;
      if (pos === 'static') this.parent.style.position = 'relative';

      var canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        zIndex: String(CONFIG.zIndex),
        pointerEvents: 'none',
      });
      this.canvas = canvas;

      var gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true });
      if (!gl) {
        this.dead = true;
        return;
      }
      this.gl = gl;
      var program = compileProgram(gl);
      if (!program) {
        this.dead = true;
        return;
      }
      this.program = program;

      gl.useProgram(program);
      var quad = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      this.u = {
        fillColor: gl.getUniformLocation(program, 'uFillColor'),
        progress: gl.getUniformLocation(program, 'uProgress'),
        textureSize: gl.getUniformLocation(program, 'uTextureSize'),
        elementSize: gl.getUniformLocation(program, 'uElementSize'),
        texture: gl.getUniformLocation(program, 'uTexture'),
      };
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied compositing

      this.parent.appendChild(canvas);

      var self = this;
      var start = function () {
        self.uploadTexture(self.img.currentSrc || self.img.src);
      };
      if (this.img.complete && this.img.naturalWidth > 0) start();
      else this.img.addEventListener('load', start, { once: true });
    };

    EmergeItem.prototype.uploadTexture = function (url) {
      var self = this;
      var gl = this.gl;
      var copy = new Image();
      copy.crossOrigin = 'anonymous';
      copy.onload = function () {
        var texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, copy);
        } catch (e) {
          return;
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        self.texture = texture;
        self.textureSize = [copy.naturalWidth, copy.naturalHeight];
        self.ready = true;
        self.img.style.opacity = '0';
      };
      copy.src = url;
    };

    EmergeItem.prototype.render = function (dt) {
      if (this.dead || !this.ready) return;

      var wasAnimating = this.progress !== this.target;
      if (wasAnimating) {
        var step = dt / CONFIG.duration;
        this.progress = this.target > this.progress ? Math.min(this.progress + step, this.target) : Math.max(this.progress - step, this.target);
      }

      // nothing changed and already drawn at this state -> skip GPU work
      if (!wasAnimating && this.progress === this.lastDrawn) return;

      var gl = this.gl;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = this.parent.clientWidth;
      var h = this.parent.clientHeight;
      if (w === 0 || h === 0) return;

      var pxW = Math.round(w * dpr);
      var pxH = Math.round(h * dpr);
      if (this.canvas.width !== pxW || this.canvas.height !== pxH) {
        this.canvas.width = pxW;
        this.canvas.height = pxH;
        this.lastDrawn = -1; // force redraw after resize
      }

      gl.viewport(0, 0, pxW, pxH);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.lastDrawn = this.progress;

      if (this.progress <= 0) return;

      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.uniform1i(this.u.texture, 0);
      gl.uniform1f(this.u.progress, this.progress);
      gl.uniform3fv(this.u.fillColor, this.fillColor);
      gl.uniform2f(this.u.textureSize, this.textureSize[0], this.textureSize[1]);
      gl.uniform2f(this.u.elementSize, w, h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // Registry of live emerge items, keyed by their <img>. Animation code looks
    // items up here instead of each item deciding for itself when to reveal.
    var emergeItems = [];

    function emergeItemFor(img) {
      for (var i = 0; i < emergeItems.length; i++) {
        if (emergeItems[i].img === img) return emergeItems[i];
      }
      return null;
    }

    function initEmergingImages() {
      if (REDUCED_MOTION) return;

      var imgs = Array.prototype.filter.call(document.querySelectorAll(CONFIG.selector), function (img) {
        return img.tagName === 'IMG' && !img.dataset.emergeInit;
      });
      if (imgs.length === 0) return;

      imgs.forEach(function (img) {
        img.dataset.emergeInit = '1';
        var item = new EmergeItem(img);
        if (!item.dead) emergeItems.push(item);
      });
      if (emergeItems.length === 0) return;

      var last = performance.now();
      function frame(now) {
        var dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        for (var i = 0; i < emergeItems.length; i++) emergeItems[i].render(dt);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    // Drives one image's emerge reveal from a GSAP timeline. The shader reads
    // item.target and eases toward it over CONFIG.duration, so the tween here
    // only has to hold the playhead for that long and set the target once.
    function emergeReveal(img) {
      var tl = gsap.timeline();
      var item = img ? emergeItemFor(img) : null;

      if (!item) {
        // No WebGL item (reduced motion, context failure, selector miss) --
        // fall back to revealing the underlying <img> directly.
        if (img) tl.to(img, { opacity: 1, duration: 0.6, ease: 'power2.out' });
        return tl;
      }

      tl.to({}, {
        duration: CONFIG.duration,
        onStart: function () { item.target = 1; },
      });
      return tl;
    }

    initEmergingImages();

  

    var TEXT_SELECTOR = '[data-split-text]';

    var TEXT_REVEAL = {
      duration: 0.8,
      yPercent: 110,
      stagger: 0.1,
      ease: 'expo.out',
    };

    function debounce(fn, wait) {
      var timer;
      return function () {
        var ctx = this;
        var args = arguments;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
      };
    }

    // Revert splits so a resize can re-measure line breaks from clean text.
    function cleanupText(root) {
      var scope = root || document;
      scope.querySelectorAll(TEXT_SELECTOR).forEach(function (target) {
        if (target.splitInstance) {
          target.splitInstance.revert();
          delete target.splitInstance;
        }
      });
    }

    // Webflow rich-text wrappers (.hero_text, .feature_text) hold a <p> rather
    // than text nodes. Splitting the wrapper measures lines against a box whose
    // block children still own their own margins, which produces mismatched
    // line widths -- so split the elements that actually carry the text.
    function splitTargetsWithin(target) {
      var blocks = target.querySelectorAll('p, h1, h2, h3, h4, h5, h6');
      return blocks.length ? Array.prototype.slice.call(blocks) : [target];
    }

    // Paused timeline that slides each line up from behind its mask.
    //
    // The split runs once here rather than through autoSplit's onSplit hook:
    // onSplit fires again on every re-split and would build a second, detached
    // tween that the section timeline has no handle on. Re-splitting is
    // handled by the resize path, which reverts and rebuilds everything.
    function createTextTimeline(target) {
      var splitInstance = SplitText.create(splitTargetsWithin(target), {
        type: 'lines',
        mask: 'lines',
      });

      target.splitInstance = splitInstance;

      // Park the lines below their mask straight away. A paused .from() would
      // otherwise leave them visible until its trigger fires, then snap them
      // down before sliding up.
      gsap.set(splitInstance.lines, { yPercent: TEXT_REVEAL.yPercent });

      var tl = gsap.timeline({ paused: true });

      tl.to(splitInstance.lines, {
        duration: TEXT_REVEAL.duration,
        yPercent: 0,
        stagger: TEXT_REVEAL.stagger,
        ease: TEXT_REVEAL.ease,
      });

      return tl;
    }

   

    var SECTIONS = [
      {
        root: '.hero_wrap',
        heading: '.hero_title',
        paragraph: '.hero_text',
        image: '.hero_media_img',
        meta: '.hero_media_meta',
        stagger: '.hero_pill_wrap',
        trigger: 'load',
      },
      {
        root: '.feature_wrap',
        heading: '.feature_title',
        paragraph: '.feature_text',
        image: '.feature_media_img',
        meta: '.feature_media_meta',
        stagger: null,
        trigger: 'scroll',
      },
      {
        kind: 'cards',
        root: '.investigation_wrap',
        heading: '.investigation_title',
        card: '.investigation_card_wrap',
        cardImage: '.investigation_card_img',
        cardMeta: '.investigation_card_meta',
        cardTitle: '.investigation_card_name',
        cardDate: '.investigation_card_date',
        trigger: 'scroll',
      },
      {
        kind: 'cards',
        root: '.videos_wrap',
        heading: '.videos_title',
        card: '.videos_card_wrap',
        cardImage: '.videos_card_img',
        cardMeta: '.videos_card_meta',
        cardTitle: '.videos_card_name',
        cardDate: '.videos_card_date',
        trigger: 'scroll',
      },
    ];

    // One card: image -> meta -> title -> date. The title gets the line
    // reveal; meta and date are simple fades, since one-line labels have
    // nothing to stagger.
    function buildCardTimeline(card, config) {
      var image = config.cardImage ? card.querySelector(config.cardImage) : null;
      var meta = config.cardMeta ? card.querySelector(config.cardMeta) : null;
      var title = config.cardTitle ? card.querySelector(config.cardTitle) : null;
      var date = config.cardDate ? card.querySelector(config.cardDate) : null;

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });

      if (meta) gsap.set(meta, { autoAlpha: 0 });
      if (date) gsap.set(date, { autoAlpha: 0, y: 8 });

      if (image) tl.add(emergeReveal(image), 0);

      if (meta) tl.to(meta, { autoAlpha: 1, duration: 0.5 }, '-=0.75');

      if (title) tl.add(createTextTimeline(title).play(), '-=0.35');

      if (date) tl.to(date, { autoAlpha: 1, y: 0, duration: 0.45 }, '-=0.5');

      return tl;
    }

    function revealCardInstantly(card, config) {
      var els = [config.cardImage, config.cardMeta, config.cardTitle, config.cardDate]
        .filter(Boolean)
        .map(function (sel) { return card.querySelector(sel); })
        .filter(Boolean);

      if (els.length) gsap.set(els, { autoAlpha: 1, y: 0 });

      var image = config.cardImage ? card.querySelector(config.cardImage) : null;
      if (image) gsap.set(image, { opacity: 1 });
    }

    // Heading plays on the section; every card then triggers independently so
    // a card that is already past the fold on a small screen still reveals.
    function initCardsSection(root, config) {
      var heading = config.heading ? root.querySelector(config.heading) : null;
      var cards = config.card ? root.querySelectorAll(config.card) : [];

      if (REDUCED_MOTION) {
        if (heading) gsap.set(heading, { autoAlpha: 1 });
        cards.forEach(function (card) { revealCardInstantly(card, config); });
        return;
      }

      if (heading) {
        var headingTl = createTextTimeline(heading);
        ScrollTrigger.create({
          trigger: heading,
          start: 'top 85%',
          once: true,
          onEnter: function () { headingTl.play(); },
        });
      }

      // Cards entering the viewport in the same frame are staggered against
      // each other; a card scrolled to on its own plays immediately rather
      // than waiting behind a delay computed from its index in the grid.
      var pending = [];
      var flushing = null;

      function flush() {
        pending.forEach(function (tl, i) {
          gsap.delayedCall(i * 0.12, function () { tl.play(); });
        });
        pending = [];
        flushing = null;
      }

      cards.forEach(function (card) {
        var tl = buildCardTimeline(card, config);
        ScrollTrigger.create({
          trigger: card,
          start: 'top 85%',
          once: true,
          onEnter: function () {
            pending.push(tl);
            if (!flushing) flushing = requestAnimationFrame(flush);
          },
        });
      });
    }

    function buildSectionTimeline(root, config) {
      var heading = config.heading ? root.querySelector(config.heading) : null;
      var paragraph = config.paragraph ? root.querySelector(config.paragraph) : null;
      var image = config.image ? root.querySelector(config.image) : null;
      var meta = config.meta ? root.querySelector(config.meta) : null;
      var stagger = config.stagger ? root.querySelectorAll(config.stagger) : [];

      var tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });

      if (meta) gsap.set(meta, { autoAlpha: 0 });
      if (stagger.length) gsap.set(stagger, { autoAlpha: 0, y: 12 });

      if (heading) tl.add(createTextTimeline(heading).play(), 0);
      if (paragraph) tl.add(createTextTimeline(paragraph).play(), 0.25);

      // Image starts before the paragraph has fully settled.
      if (image) tl.add(emergeReveal(image), '-=0.35');

      if (meta) tl.to(meta, { autoAlpha: 1, duration: 0.5 }, '-=0.8');

      if (stagger.length) {
        tl.to(stagger, {
          autoAlpha: 1,
          y: 0,
          duration: 0.5,
          stagger: 0.08,
        }, '-=0.5');
      }

      return tl;
    }

    function revealSectionInstantly(root, config) {
      var els = [config.heading, config.paragraph, config.meta]
        .filter(Boolean)
        .map(function (sel) { return root.querySelector(sel); })
        .filter(Boolean);

      if (els.length) gsap.set(els, { autoAlpha: 1 });

      var image = config.image ? root.querySelector(config.image) : null;
      if (image) gsap.set(image, { opacity: 1 });

      var stagger = config.stagger ? root.querySelectorAll(config.stagger) : [];
      if (stagger.length) gsap.set(stagger, { autoAlpha: 1, y: 0 });
    }

    function initSections() {
      SECTIONS.forEach(function (config) {
        var root = document.querySelector(config.root);
        if (!root) return;

        if (config.kind === 'cards') {
          initCardsSection(root, config);
          return;
        }

        if (REDUCED_MOTION) {
          revealSectionInstantly(root, config);
          return;
        }

        var tl = buildSectionTimeline(root, config);

        if (config.trigger === 'scroll') {
          ScrollTrigger.create({
            trigger: root,
            start: 'top 70%',
            once: true,
            onEnter: function () { tl.play(); },
          });
        } else {
          tl.play();
        }
      });
    }


    function sectionRoots() {
      return SECTIONS
        .map(function (c) { return document.querySelector(c.root); })
        .filter(Boolean);
    }

    function tagSplitTargets() {
      SECTIONS.forEach(function (config) {
        var root = document.querySelector(config.root);
        if (!root) return;

        [config.heading, config.paragraph].forEach(function (sel) {
          if (!sel) return;
          var el = root.querySelector(sel);
          if (el) el.setAttribute('data-split-text', '');
        });

        if (config.card && config.cardTitle) {
          root.querySelectorAll(config.card).forEach(function (card) {
            var title = card.querySelector(config.cardTitle);
            if (title) title.setAttribute('data-split-text', '');
          });
        }
      });
    }

    function initStrayText() {
      if (REDUCED_MOTION) return;

      var roots = sectionRoots();

      document.querySelectorAll(TEXT_SELECTOR).forEach(function (target) {
        var owned = roots.some(function (root) { return root.contains(target); });
        if (owned) return; // driven by its section timeline

        var tl = createTextTimeline(target);
        ScrollTrigger.create({
          trigger: target,
          start: 'top 90%',
          once: true,
          onEnter: function () { tl.play(); },
        });
      });
    }

    function initTextEffects() {
      initSections();
      initStrayText();
    }

    // Kill only the triggers this file created: section roots, cards, and
    // split-text targets. Anything else on the page is left alone.
    function killOwnScrollTriggers() {
      var roots = sectionRoots();

      ScrollTrigger.getAll().forEach(function (trigger) {
        var t = trigger.vars && trigger.vars.trigger;
        if (!t || !t.closest) return;

        var isSectionRoot = roots.indexOf(t) !== -1;
        var isSplitText = !!t.closest(TEXT_SELECTOR);
        var isOwnedChild = roots.some(function (root) { return root.contains(t); });
        if (isSectionRoot || isSplitText || isOwnedChild) trigger.kill();
      });
    }

    var prevWidth = window.innerWidth;

    // Only rebuild on a genuine width change -- mobile browsers fire resize on
    // scroll as the URL bar collapses, and re-splitting there would replay
    // everything mid-scroll.
    window.addEventListener('resize', debounce(function () {
      var currentWidth = window.innerWidth;
      if (currentWidth === prevWidth) return;
      prevWidth = currentWidth;

      killOwnScrollTriggers();
      cleanupText();
      // A new breakpoint can select a different face, so re-check fonts
      // before re-measuring line breaks.
      fontsSettled().then(initTextEffects);
    }, 250));

    // Line breaks depend on font metrics, so nothing may split until the web
    // fonts are in. document.fonts.ready only covers faces the browser has
    // already begun fetching -- Webflow declares @font-face lazily, so a face
    // no laid-out text has requested yet is not counted. load() forces the
    // faces used by split copy to be requested first.
    function fontsSettled() {
      if (!document.fonts) return Promise.resolve();

      var faces = [];
      document.querySelectorAll(TEXT_SELECTOR).forEach(function (target) {
        // Measure the elements that will actually be split -- on a rich-text
        // wrapper the font lives on the inner <p>, not the wrapper itself.
        splitTargetsWithin(target).forEach(function (el) {
          var cs = window.getComputedStyle(el);
          // load() wants a font shorthand; size and family are the parts that
          // decide which face resolves.
          var shorthand = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
          try {
            faces.push(document.fonts.load(shorthand));
          } catch (e) {
            // Malformed shorthand -- fall through to fonts.ready alone.
          }
        });
      });

      return Promise.all(faces)
        .catch(function () { // a missing face must not block the reveal  })
        .then(function () { return document.fonts.ready; });
    }

    // Tag split targets before the font check so it can inspect them.
    tagSplitTargets();

    fontsSettled().then(initTextEffects);

});

  **/