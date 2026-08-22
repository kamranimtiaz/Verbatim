/**
 * "Emerging Images" reveal — variation 3 (uType == 2) from
 * https://github.com/akella/CodropsEmergingImages, ported to
 * dependency-free WebGL.
 *
 * A fixed transparent canvas overlays the page; every img[data-emerge]
 * gets a quad drawn over its bounding rect. When the image scrolls into
 * view its progress tweens 0 -> 1 (linear, 1.5s, same as the original
 * GSAP tween) and the shader dissolves it in as a top-down sweep of
 * random fill-coloured pixels that resolve into the photo. Scrolling
 * away reverses it, so the reveal replays on re-entry.
 */

const DURATION = 1.5;
const FALLBACK_FILL = '#f2f1e8';

const VERTEX_SHADER = /* glsl */ `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Fragment logic is a 1:1 port of the uType == 2 branch of
// EmergeMaterial.js (variation "3" in the demo nav), including its
// cover-fit UV mapping. The trailing pow(1/2.2) from the original is
// dropped: here the texture is sampled and displayed as-is, so the
// fully revealed frame matches the DOM <img> exactly. Output is
// premultiplied for canvas compositing.
const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform vec3 uFillColor;
uniform float uProgress;
uniform vec2 uTextureSize;
uniform vec2 uElementSize;
uniform sampler2D uTexture;
varying vec2 vUv;

float hashwithoutsine12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float map(float value, float min1, float max1, float min2, float max2) {
  float val = min2 + (value - min1) * (max2 - min2) / (max1 - min1);
  return clamp(val, min2, max2);
}

void main() {
  // texture cover
  vec2 uv = vUv - vec2(0.5);
  float aspect1 = uTextureSize.x / uTextureSize.y;
  float aspect2 = uElementSize.x / uElementSize.y;
  if (aspect1 > aspect2) { uv *= vec2(aspect2 / aspect1, 1.); }
  else { uv *= vec2(1., aspect1 / aspect2); }
  uv += vec2(0.5);
  float uAspect = uElementSize.x / uElementSize.y;

  vec4 defaultColor = texture2D(uTexture, uv);

  float s = 120.;
  vec2 gridSize = vec2(s, floor(s / uAspect));
  vec2 newUV = floor(vUv * gridSize);
  float pattern = hashwithoutsine12(newUV);

  float w = 0.5;
  float p0 = clamp(uProgress / 0.8, 0., 1.);
  float p1 = clamp((uProgress - 0.2) / 0.8, 0., 1.);

  p0 = map(p0, 0., 1., -w, 1.);
  p0 = smoothstep(p0, p0 + w, 1. - vUv.y);
  float p0_ = clamp(1. - 2. * p0 + pattern, 0., 1.);

  p1 = map(p1, 0., 1., -w, 1.);
  p1 = smoothstep(p1, p1 + w, 1. - vUv.y);
  float p1_ = clamp(1. - 2. * p1 + pattern, 0., 1.);

  vec3 finalColor = mix(uFillColor, defaultColor.rgb, p1_);
  gl_FragColor = vec4(finalColor * p0_, p0_);
}
`;

interface EmergeItem {
  img: HTMLImageElement;
  texture: WebGLTexture | null;
  textureSize: [number, number];
  fillColor: [number, number, number];
  progress: number;
  target: number;
}

interface Uniforms {
  fillColor: WebGLUniformLocation | null;
  progress: WebGLUniformLocation | null;
  textureSize: WebGLUniformLocation | null;
  elementSize: WebGLUniformLocation | null;
  texture: WebGLUniformLocation | null;
}

function parseHexColor(input: string): [number, number, number] {
  let hex = input.trim().replace(/^#/, '');
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const n = parseInt(hex, 16);
  if (hex.length !== 6 || Number.isNaN(n)) return parseHexColor(FALLBACK_FILL);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compileProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('emerge shader:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  };

  const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('emerge program:', gl.getProgramInfoLog(program));
    return null;
  }
  return program;
}

export function initEmergingImages(): void {
  if (document.querySelector('.emerge-canvas')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const images = [...document.querySelectorAll<HTMLImageElement>('img[data-emerge]')];
  if (images.length === 0) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'emerge-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
  if (!gl) return;

  const program = compileProgram(gl);
  if (!program) return;
  document.body.appendChild(canvas);

  gl.useProgram(program);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const positionLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  const uniforms: Uniforms = {
    fillColor: gl.getUniformLocation(program, 'uFillColor'),
    progress: gl.getUniformLocation(program, 'uProgress'),
    textureSize: gl.getUniformLocation(program, 'uTextureSize'),
    elementSize: gl.getUniformLocation(program, 'uElementSize'),
    texture: gl.getUniformLocation(program, 'uTexture'),
  };
  gl.clearColor(0, 0, 0, 0);

  const defaultFill =
    getComputedStyle(document.documentElement).getPropertyValue('--cream') || FALLBACK_FILL;

  // Images that repeat on the page (hero + card) share one texture.
  const textureCache = new Map<string, { texture: WebGLTexture; size: [number, number] }>();

  const uploadTexture = (item: EmergeItem) => {
    const { img } = item;
    const cached = textureCache.get(img.currentSrc || img.src);
    if (cached) {
      item.texture = cached.texture;
      item.textureSize = cached.size;
    } else {
      const texture = gl.createTexture();
      if (!texture) return;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      item.texture = texture;
      item.textureSize = [img.naturalWidth, img.naturalHeight];
      textureCache.set(img.currentSrc || img.src, { texture, size: item.textureSize });
    }
    // The DOM img keeps the layout (and stays as the no-JS/no-WebGL
    // fallback); once the texture is live the canvas takes over.
    img.classList.add('is-emerged');
  };

  const items: EmergeItem[] = images.map((img) => {
    const item: EmergeItem = {
      img,
      texture: null,
      textureSize: [1, 1],
      fillColor: parseHexColor(img.dataset.emergeColor || defaultFill),
      progress: 0,
      target: 0,
    };
    if (img.complete && img.naturalWidth > 0) {
      uploadTexture(item);
    } else {
      img.addEventListener('load', () => uploadTexture(item), { once: true });
    }
    return item;
  });

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const item = items.find((i) => i.img === entry.target);
      if (item) item.target = entry.isIntersecting ? 1 : 0;
    }
  });
  items.forEach((item) => observer.observe(item.img));

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  };
  resize();
  window.addEventListener('resize', resize);

  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (const item of items) {
      if (item.progress !== item.target) {
        const step = dt / DURATION;
        item.progress =
          item.target > item.progress
            ? Math.min(item.progress + step, item.target)
            : Math.max(item.progress - step, item.target);
      }
      if (!item.texture || item.progress <= 0) continue;

      const rect = item.img.getBoundingClientRect();
      if (
        rect.width === 0 ||
        rect.bottom < 0 ||
        rect.top > window.innerHeight ||
        rect.right < 0 ||
        rect.left > window.innerWidth
      ) {
        continue;
      }

      gl.viewport(
        Math.round(rect.left * dpr),
        Math.round(canvas.height - rect.bottom * dpr),
        Math.round(rect.width * dpr),
        Math.round(rect.height * dpr)
      );
      gl.bindTexture(gl.TEXTURE_2D, item.texture);
      gl.uniform1i(uniforms.texture, 0);
      gl.uniform1f(uniforms.progress, item.progress);
      gl.uniform3fv(uniforms.fillColor, item.fillColor);
      gl.uniform2f(uniforms.textureSize, item.textureSize[0], item.textureSize[1]);
      gl.uniform2f(uniforms.elementSize, rect.width, rect.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
