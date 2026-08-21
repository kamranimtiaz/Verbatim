document.addEventListener("DOMContentLoaded", function () {
  // Skip all JS while editing in the Webflow Designer/Editor so the popup
  // stays visible and elements remain editable.
  const inWebflowEditor =
    document.documentElement.classList.contains("wf-design-mode") ||
    document.documentElement.classList.contains("w-editor") ||
    window.Webflow?.env?.("design") ||
    window.Webflow?.env?.("editor");
  if (inWebflowEditor) return;

  // Parsed pages keyed by href, so re-opening the same card is instant.
  const contentCache = new Map();

  const SKELETON_HTML = `
    <div data-popup-skeleton class="popup_skeleton">
      <div class="popup_skeleton_line" style="width:92%"></div>
      <div class="popup_skeleton_line" style="width:97%"></div>
      <div class="popup_skeleton_line" style="width:85%"></div>
      <div class="popup_skeleton_line" style="width:94%"></div>
      <div class="popup_skeleton_line" style="width:60%"></div>
      <div class="popup_skeleton_line popup_skeleton_gap" style="width:96%"></div>
      <div class="popup_skeleton_line" style="width:89%"></div>
      <div class="popup_skeleton_line" style="width:93%"></div>
      <div class="popup_skeleton_line" style="width:48%"></div>
    </div>`;

  // Injected once — Webflow has no class for these, and they only ever render
  // while a fetch is in flight.
  const injectSkeletonStyles = () => {
    if (document.getElementById("popup-skeleton-styles")) return;
    const style = document.createElement("style");
    style.id = "popup-skeleton-styles";
    style.textContent = `
      .popup_skeleton {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 2rem;
      }
      .popup_skeleton_line {
        height: 0.85rem;
        border-radius: 0.25rem;
        background: linear-gradient(90deg,
          rgba(26, 41, 6, 0.07) 25%,
          rgba(26, 41, 6, 0.14) 37%,
          rgba(26, 41, 6, 0.07) 63%);
        background-size: 400% 100%;
        animation: popup-skeleton-shimmer 1.4s ease-in-out infinite;
      }
      .popup_skeleton_gap { margin-top: 1.25rem; }
      @keyframes popup-skeleton-shimmer {
        0% { background-position: 100% 50%; }
        100% { background-position: 0 50%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .popup_skeleton_line { animation: none; }
      }`;
    document.head.appendChild(style);
  };

  // innerHTML never executes <script> tags, so any script that shipped with the
  // fetched content is inert. Re-create each one to make the browser run it.
  // External srcs are de-duped: a library already on the page must not load twice.
  // Built lazily on first use, not at parse time: this file can run before the
  // rest of the page's <script> tags have been parsed, and a set captured then
  // would miss them and re-load libraries that are already present.
  // Maps an absolute script URL to a promise that settles once it has loaded.
  // A Map of promises rather than a Set of URLs, because the same library is
  // often referenced several times in one article: the duplicates must WAIT for
  // the pending load, not resolve immediately, or the inline init that follows
  // them runs while the library is still downloading.
  //
  // Seeded eagerly, at file scope, from the scripts the page itself shipped
  // with. It must NOT be built lazily on first use: by then the fetched article
  // is already in the DOM, so its own <script src> tags would be seeded as
  // "already loaded" and then skipped — the library would never load at all.
  // Upper bound on waiting for one external script before moving on.
  const SCRIPT_TIMEOUT_MS = 10000;

  const loadedSrcs = new Map();
  const seedLoadedSrcs = () => {
    document.querySelectorAll("script[src]").forEach((el) => {
      if (!loadedSrcs.has(el.src)) loadedSrcs.set(el.src, Promise.resolve());
    });
  };
  // Once now (this file may sit above other tags) and once when parsing is
  // done, so the snapshot covers the whole page — but always before any
  // article has been injected.
  seedLoadedSrcs();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", seedLoadedSrcs);
  }
  const getLoadedSrcs = () => loadedSrcs;

  const runScripts = (container) => {
    const seen = getLoadedSrcs();
    // Skip Webflow's CMS templates — inert data, not executable code.
    const scripts = [...container.querySelectorAll("script")].filter(
      (el) => !(el.getAttribute("type") || "").includes("x-wf-template")
    );

    // Sequential so a library finishes loading before the inline script that
    // depends on it runs.
    return scripts.reduce(
      (chain, old) =>
        chain.then(
          () =>
            new Promise((resolve) => {
              const src = old.getAttribute("src");
              // Settles this URL's entry in `seen` once the load finishes.
              let pendingDone = null;

              if (src) {
                const absolute = new URL(src, window.location.href).href;
                // Already loading or loaded — drop the duplicate tag, but wait
                // for the original before letting the chain continue.
                if (seen.has(absolute)) {
                  old.remove();
                  return seen.get(absolute).then(resolve, resolve);
                }
                seen.set(
                  absolute,
                  new Promise((done) => {
                    pendingDone = done;
                  })
                );
              }

              const script = document.createElement("script");
              for (const { name, value } of old.attributes) {
                script.setAttribute(name, value);
              }

              if (src) {
                // Never let one bad script stall the rest of the chain.
                let settled = false;
                const finish = () => {
                  if (settled) return;
                  settled = true;
                  clearTimeout(timer);
                  if (pendingDone) pendingDone();
                  resolve();
                };
                // A CDN that hangs must not block the rest of rehydration —
                // players and link binding still need to run.
                const timer = setTimeout(() => {
                  console.warn("[popup] script load timed out:", src);
                  finish();
                }, SCRIPT_TIMEOUT_MS);
                script.onload = finish;
                script.onerror = () => {
                  console.warn("[popup] script failed to load:", src);
                  finish();
                };
                old.replaceWith(script);
                return;
              }

              // --- Inline script ---------------------------------------
              // Two things break a Webflow component script when it is
              // re-run this late, and both are patched by wrapping the
              // source rather than editing the article's markup:
              //
              // 1. document.currentScript is null for any script created
              //    via createElement, so component scripts that walk up
              //    from it (`document.currentScript.parentElement`) throw
              //    before they reach their init code.
              // 2. DOMContentLoaded has long since fired, so anything
              //    registered inside a listener for it never runs.
              //
              // The wrapper shadows `document` with a proxy that returns
              // the real script node for currentScript and runs a
              // DOMContentLoaded callback immediately.
              // __el is captured in an outer scope: inside the inner
              // function `var document` hoists, so reading currentScript
              // there would hit the shadowed (undefined) binding.
              script.textContent = `(function(){
var __el = window.document.currentScript;
return (function(){
var document = new Proxy(window.document, {
  get: function(target, prop) {
    if (prop === "currentScript") return __el;
    if (prop === "addEventListener") {
      return function(type, listener, options) {
        if (type === "DOMContentLoaded" || type === "readystatechange") {
          try { listener.call(window.document, new Event(type)); }
          catch (e) { console.warn("[popup] injected init failed:", e); }
          return;
        }
        return target.addEventListener(type, listener, options);
      };
    }
    var v = target[prop];
    return typeof v === "function" ? v.bind(target) : v;
  },
  set: function(target, prop, value) { target[prop] = value; return true; }
});
try {
${old.textContent}
} catch (e) { console.warn("[popup] injected script error:", e); }
})();
})();`;

              // Placed where the original sat, so scripts that walk the DOM
              // from their own position still resolve the right component.
              old.replaceWith(script);
              resolve();
            })
        ),
      Promise.resolve()
    );
  };

  // Tell every component on the page to pick up the newly injected DOM.
  const rehydrate = async (container) => {
    await runScripts(container);

    // Webflow's own modules. This project uses Swiper for sliders and has no
    // ix2 interactions, so this only covers stray lightboxes/tabs/dropdowns
    // that CMS content might bring along; it is a no-op when none are present.
    //
    // Deliberately NOT calling Webflow.destroy() + Webflow.ready(): that pair
    // is a page-wide teardown and rebuild, which would tear down the video
    // popup and nav along with everything else.
    try {
      const wf = window.Webflow;
      if (wf?.require) {
        ["lightbox", "tabs", "dropdown"].forEach((name) => {
          try {
            const mod = wf.require(name);
            // ready() rescans the DOM for new instances; redraw() only
            // recalculates existing ones.
            if (typeof mod?.ready === "function") mod.ready();
            else if (typeof mod?.redraw === "function") mod.redraw();
          } catch (error) {
            console.warn(`[popup] Webflow "${name}" re-init failed:`, error);
          }
        });
      }
    } catch (error) {
      console.warn("[popup] Webflow re-init failed:", error);
    }

    // This project's own components expose refresh hooks.
    window.videoinlineRefresh?.();
    window.videopopupRefresh?.();

    // Anything else can listen for this to bind its own late-added DOM.
    document.dispatchEvent(
      new CustomEvent("popup:content-loaded", { detail: { container } })
    );

    // Late-loading media/fonts shift layout; ScrollTrigger needs the new heights.
    window.ScrollTrigger?.refresh?.();
  };

  // Fetch a page and hand back its [data-content] node, cloned so the cached
  // copy is never mutated by the DOM it gets injected into.
  const fetchContent = async (href) => {
    if (contentCache.has(href)) return contentCache.get(href).cloneNode(true);

    const response = await fetch(href, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);

    const doc = new DOMParser().parseFromString(await response.text(), "text/html");
    const content = doc.querySelector("[data-content]");
    if (!content) throw new Error("No [data-content] found on " + href);

    contentCache.set(href, content);
    return content.cloneNode(true);
  };

  document.querySelectorAll("[data-popup]").forEach((component) => {
    if (component.dataset.scriptInitialized) return;
    component.dataset.scriptInitialized = "true";

    injectSkeletonStyles();

    const backdrop = component.querySelector("[data-popup-backdrop]");
    const dialog = component.querySelector("[data-popup-dialog]");
    const closeButtons = component.querySelectorAll("[data-popup-close]");
    const slot = component.querySelector("[data-content-slot]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Bail loudly rather than throwing. Without a dialog every open/close path
    // dereferences null and the whole component dies silently.
    if (!dialog) {
      console.warn("[popup] no [data-popup-dialog] found", component);
      return;
    }
    if (!slot) {
      console.warn("[popup] no [data-content-slot] found", component);
      return;
    }
    // Animated in several places, so it is required rather than optional —
    // guarding each gsap call individually would be noise.
    if (!backdrop) {
      console.warn("[popup] no [data-popup-backdrop] found", component);
      return;
    }

    let isOpen = false;
    let lastFocused = null;
    // Bumped on every open; a resolved fetch whose token is stale gets dropped
    // so a slow first click can't overwrite a fast second one.
    let requestToken = 0;

    // Stagger targets are re-queried per open, since injected content can
    // bring its own.
    const getStaggerItems = () => component.querySelectorAll("[data-popup-stagger]");

    // CSS defaults are visible (for Designer editing). On the live site,
    // reset to the hidden start state before any open animation runs.
    component.style.visibility = "hidden";
    component.style.pointerEvents = "none";
    gsap.set(backdrop, { opacity: 0 });
    gsap.set(dialog, { yPercent: 100 });
    gsap.set(getStaggerItems(), { opacity: 0, y: "2rem" });

    const openPopup = () => {
      if (isOpen) return;
      isOpen = true;
      lastFocused = document.activeElement;

      component.style.visibility = "visible";
      component.style.pointerEvents = "auto";

      const staggerItems = getStaggerItems();

      if (reduceMotion) {
        gsap.set(backdrop, { opacity: 1 });
        gsap.set(dialog, { yPercent: 0 });
        gsap.set(staggerItems, { opacity: 1, y: 0 });
      } else {
        const tl = gsap.timeline();
        tl.to(backdrop, { opacity: 1, duration: 0.4, ease: "power2.out" })
          .fromTo(
            dialog,
            { yPercent: 100 },
            { yPercent: 0, duration: 0.6, ease: "power3.out" },
            "<"
          )
          .fromTo(
            staggerItems,
            { opacity: 0, y: "2rem" },
            { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" },
            "-=0.3"
          );
      }

      dialog.focus();
    };

    // Open immediately with a skeleton, then swap in the real content when the
    // fetch lands — the button never feels unresponsive.
    const openPopupWithContent = async (href, title) => {
      const token = ++requestToken;

      if (slot) slot.innerHTML = SKELETON_HTML;
      // Title comes in with the fetched content; kept for optional headings.
      if (title) component.setAttribute("aria-label", title);

      openPopup();

      try {
        const content = await fetchContent(href);
        if (token !== requestToken || !isOpen) return;

        if (slot) {
          slot.innerHTML = "";
          slot.appendChild(content);

          // Scripts, sliders and players inside the injected markup are inert
          // until this runs.
          rehydrate(slot)
            // Related-article links arrive with the injected content, so they
            // still need binding to swap content in place.
            .then(() => bindOpeners())
            .catch((error) => console.warn("[popup] rehydrate failed:", error));

          if (reduceMotion) {
            gsap.set(content, { opacity: 1, y: 0 });
          } else {
            gsap.fromTo(
              content,
              { opacity: 0, y: "1rem" },
              { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
            );
          }
        }
      } catch (error) {
        if (token !== requestToken) return;
        console.error("[popup] content load failed:", error);
        // Never strand the user in an empty popup — fall back to the real page.
        window.location.href = href;
      }
    };

    const closePopup = () => {
      if (!isOpen) return;
      isOpen = false;
      // Invalidate any in-flight fetch so it can't paint into a closed popup.
      requestToken++;

      const finish = () => {
        component.style.visibility = "hidden";
        component.style.pointerEvents = "none";
        if (lastFocused) lastFocused.focus();
      };

      if (reduceMotion) {
        gsap.set(dialog, { yPercent: 100 });
        gsap.set(backdrop, { opacity: 0 });
        finish();
      } else {
        const tl = gsap.timeline({ onComplete: finish });
        tl.to(dialog, { yPercent: 100, duration: 0.45, ease: "power3.in" })
          .to(backdrop, { opacity: 0, duration: 0.35, ease: "power2.in" }, "<");
      }
    };

    closeButtons.forEach((btn) => btn.addEventListener("click", closePopup));
    backdrop.addEventListener("click", closePopup);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) closePopup();
    });

    // --- Openers -----------------------------------------------------------
    const bindOpeners = () => {
      // One attribute for every opener, including "Related articles" rows
      // inside injected content — clicking one swaps the popup's content
      // instead of navigating.
      document.querySelectorAll("[data-popup-open]").forEach((opener) => {
        if (opener.dataset.popupBound) return;
        opener.dataset.popupBound = "true";

        opener.addEventListener("click", (e) => {
          // Leave new-tab and middle-click intents alone; it's still a real link.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

          const href = opener.getAttribute("href");
          if (!href || href === "#") {
            e.preventDefault();
            // A placeholder link inside an open popup would otherwise wipe the
            // content that is already showing; leave it as it is.
            if (!isOpen) openPopup();
            return;
          }

          e.preventDefault();
          const card = opener.closest("[data-card]") || opener;
          const title =
            opener.getAttribute("data-popup-title") ||
            card.querySelector("[data-card-title]")?.textContent.trim();

          openPopupWithContent(href, title);
        });

        // Warm the cache on hover so most clicks resolve instantly.
        const warm = () => {
          const href = opener.getAttribute("href");
          if (href && href !== "#" && !contentCache.has(href)) {
            fetchContent(href).catch(() => {});
          }
        };
        opener.addEventListener("pointerenter", warm);
        opener.addEventListener("focus", warm);
      });
    };

    // Exposed for videopopup.js's "Read" handoff and for CMS-loaded cards.
    component._openPopup = openPopup;
    component._openPopupWithContent = openPopupWithContent;
    component._bindOpeners = bindOpeners;

    bindOpeners();
  });
});
