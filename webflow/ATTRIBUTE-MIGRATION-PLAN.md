# Attribute Migration Plan — removing class dependence

> ## ✅ MIGRATION COMPLETE — 2026-08-21
>
> All attributes authored in Webflow; all three scripts switched to
> attribute-only selectors. **No dual-selector phase was needed** — the markup
> was complete, so class fallbacks were removed outright (Steps 1–5 collapsed
> into one pass). The crash guards in `contentpopup.js` are in.
>
> Verified: 25/25 selector targets present in [`components.html`](components.html);
> all three files pass `node --check`; zero class selectors remain in JS.
>
> **One item left, and it is yours:** the CSS embed still keys off
> `.card_player` — see [Part 1E](#1e--css-custom-property-contract).
>
> Pre-migration copies of the scripts are in [`archive/`](archive/)
> (`*.pre-attr.js`). The document below is retained as the reference map of
> which attribute lives on which element.

> **Rewritten 2026-08-21** against the real markup in
> [`components.html`](components.html). The previous version described a
> hypothetical flat card (`data-card-player` on `.card_wrap`) that does not
> exist in your build — it is kept at
> [`archive/ATTRIBUTE-MIGRATION-PLAN.prev.md`](archive/ATTRIBUTE-MIGRATION-PLAN.prev.md).
> Every table below is a **1:1 element map**: one row = one element in your
> exported markup, with the exact attribute that goes on it.

## Goal

Every element the JS needs is found by **attribute**. Classes become purely
visual, so you can restyle, rename, or rebuild the component with any class
system and the behaviour follows the attributes.

## Where you actually stand

Far better than the old plan implied. Counting real class selectors in the live
scripts:

| File | Class-dependent selectors | Status |
|---|---|---|
| `videoinline.js` | 1 functional (`.card_watch`) + 12 icon classes | Nearly clean |
| `videopopup.js` | 7 functional + 12 icon classes | The bulk of the work |
| `contentpopup.js` | 6 functional | Small, but 2 are crash paths |

Your markup **already carries** almost every attribute the video-popup dialog
and the inline player need. The gaps are concentrated in five places:

1. **Component roots** — `.videopop_wrap`, `.popup_wrap` (found by class)
2. **Dialogs** — `.videopop_dialog`, `.popup_dialog` (found by class)
3. **The WATCH button** — `.card_watch` (found by class, in two scripts)
4. **Icon show/hide pairs** — 12 classes across both video scripts
5. **A handful of card-level handles** — `.card_wrap`, `.card_read`, `.card_title`,
   `.popup_inner`, `.videopop_playpause_label`, `.videopop_bigbtn_wrap`

---

# Part 0 — Reading your markup

Two facts about your real structure that the old plan got wrong, and that drive
everything below.

### The card is two levels, not one

```
.card_wrap                 ← outer, carries the Webflow variant attribute
  └ .card_layout
      └ .card_player       ← THIS is the JS root. Carries data-player.
          ├ .card_poster / .card_preview / .card_fade
          ├ .card_poster_meta  → .card_watch, .card_read, poster time
          └ (inline only) <video>, .card_interface, .card_bigbtn
      └ .card_info         → .card_title, .card_date
```

`data-player` sits on **`.card_player`**, not on `.card_wrap`. Scripts scope
everything from there. `.card_wrap` is only used as a *lookup scope* for the
Read-handoff (`closest('[data-card], .card_wrap')`), which is why it needs its
own attribute.

The old plan's "complete markup" block put every attribute on one flat `div`.
Ignore it — Part 2 below matches your real nesting.

### `data-trigger` is not yours

`data-trigger="hover focus"` appears throughout your export. **No script reads
it** — verified by grep across all four JS files. It is a Webflow
interactions/component attribute. Leave it alone; it is not part of this system
and needs no migration.

### Mode switch: presence of `data-videoinline-player`

```js
const CARD        = '[data-player]';                    // videopopup.js:35
const INLINE_FLAG = '[data-videoinline-player]';        // :36
const POPUP_CARD  = `${CARD}:not(${INLINE_FLAG})`;      // :38
```

- **Popup card** (your 3-2-landscape example): has `data-player`, **no**
  `data-videoinline-player`, no `<video>`. `videopopup.js` claims it.
- **Inline card** (your 16-9-landscape example): has both, plus
  `<video data-videoinline-video>`. `videoinline.js` claims it; `videopopup.js`
  skips it.

That single attribute is the entire difference. Both of your exported cards are
correct as authored.

---

# Part 1 — Element-by-element attribute map

Legend: **Now** = how the JS finds it today · **Add** = attribute to author ·
🟢 already attribute-driven, nothing to do · 🟡 add attribute · 🔴 add attribute
*and* it currently crashes/warns if missing.

## 1A — Video popup component (`videopopup.js`)

Root: `<section data-videopop class="videopop_wrap u-section">`

| # | Element in your markup | Now | Add | | Notes |
|---|---|---|---|---|---|
| 1 | `section.videopop_wrap` | `.videopop_wrap` class | `data-videopop` | 🟡 | **Root.** Already in your markup — JS just doesn't look for it yet. Required. |
| 2 | `div.videopop_backdrop` | `[data-videopop-backdrop]` | — | 🟢 | |
| 3 | `div.videopop_dialog` | `.videopop_dialog` class | `data-videopop-dialog` | 🟡 | **Already in your markup.** Required. |
| 4 | `button.videopop_close_wrap` | `[data-videopop-close]` | — | 🟢 | |
| 5 | `div.videopop_player` | `[data-videopop-player]` | — | 🟢 | Required. Also carries `-state`, `-src`, `-title`, `-hover` (written by JS). |
| 6 | `video.videopop_video` | `[data-videopop-video]` | — | 🟢 | Required. |
| 7 | `div.videopop_loading` | `[data-videopop-loading]` | — | 🟢 | |
| 8 | `div.videopop_bigbtn_wrap` | `.videopop_bigbtn_wrap, .card_bigbtn_wrap` | `data-videopop-bigbtn` | 🟡 | Centre overlay. Also already has `[data-videopop-playpause]`, so clicking still works without this — only the show/hide styling hook is class-bound. |
| 9 | `div.videopop_interface` | `[data-videopop-interface]` | — | 🟢 | |
| 10 | `div.videopop_title` | `[data-videopop-title-text]` | — | 🟢 | |
| 11 | `button.videopop_read_wrap` | `[data-videopop-read]` | — | 🟢 | |
| 12 | `div.videopop_timeline_wrap` | `[data-videopop-timeline]` | — | 🟢 | |
| 13 | `div.videopop_timeline_buffered` | `[data-videopop-buffered]` | — | 🟢 | |
| 14 | `div.videopop_timeline_progress` | `[data-videopop-progress]` | — | 🟢 | |
| 15 | `div.videopop_timeline_handle` | `[data-videopop-handle]` | — | 🟢 | |
| 16 | `button.videopop_playpause_wrap` | `[data-videopop-playpause]` | — | 🟢 | |
| 17 | `div.videopop_playpause_label` | `.videopop_playpause_label` class | `data-videopop-playpause-label` | 🟡 | Text swapped Play/Pause. Optional. |
| 18 | `p.videopop_time_progress` | `[data-videopop-progress-text]` | — | 🟢 | |
| 19 | `p.videopop_time_duration` | `[data-videopop-duration-text]` | — | 🟢 | |
| 20 | `button.videopop_mute_wrap` | `[data-videopop-mute]` | — | 🟢 | |
| 21 | `div.videopop_slider_wrap` | `[data-videopop-volume]` | — | 🟢 | |
| 22 | `div.videopop_slider_fill` | `[data-videopop-volume-fill]` | — | 🟢 | |
| 23 | `button.videopop_fullscreen_wrap` | `[data-videopop-fullscreen]` | — | 🟢 | |

**Score: 19 of 23 already clean.** Only rows 1, 3, 8, 17 need authoring — and
rows 1 and 3 already have the attribute in your export, so those are pure JS
edits with **zero Webflow work**.

## 1B — Icons inside the video popup

Your dialog carries these paired SVGs. Each pair is toggled by class today.

| Element | Current class | Add |
|---|---|---|
| `svg.videopop_bigbtn_svg.videopop_play_icon` | `.videopop_play_icon` | `data-videopop-icon="play"` |
| `svg.videopop_bigbtn_svg.videopop_pause_icon` | `.videopop_pause_icon` | `data-videopop-icon="pause"` |
| `svg.videopop_playpause_svg.videopop_play_icon` | `.videopop_play_icon` | `data-videopop-icon="play"` |
| `svg.videopop_playpause_svg.videopop_pause_icon` | `.videopop_pause_icon` | `data-videopop-icon="pause"` |
| `svg.videopop_mute_svg.videopop_volume_up_icon` | `.videopop_volume_up_icon` | `data-videopop-icon="volume-up"` |
| `svg.videopop_mute_svg.videopop_volume_mute_icon` | `.videopop_volume_mute_icon` | `data-videopop-icon="volume-mute"` |
| `svg.videopop_fullscreen_maximise` | `.videopop_fullscreen_maximise` | `data-videopop-icon="maximise"` |
| `svg.videopop_fullscreen_minimise` | `.videopop_fullscreen_minimise` | `data-videopop-icon="minimise"` |

> **Note the play/pause pair appears twice** (big button + control bar) and the
> script queries **all** matches, toggling both together. Attributes must go on
> all four, exactly as the classes are on all four today.

> ⚠️ **Icon display is read from the stylesheet at init**
> ([videopopup.js:28-31](videopopup.js#L28-L31)) — the script borrows the
> `display` value from a visible sibling so flex-centred icons keep centring.
> **Keep the icon classes carrying their CSS.** Only the *lookup* moves to
> attributes. This is the one place where a class is not purely cosmetic, and
> it is unavoidable without inline styles.

## 1C — Content popup (`contentpopup.js`)

Root: `<section class="popup_wrap u-section">` — **no attribute yet.**

| # | Element in your markup | Now | Add | | Notes |
|---|---|---|---|---|---|
| 1 | `section.popup_wrap` | `.popup_wrap` class | `data-popup` | 🟡 | **Root.** Not in your markup — must be authored. Also the handle `videopopup.js` uses for the Read handoff, so both scripts depend on it. |
| 2 | `div.popup_backdrop` | `[data-popup-backdrop]` | — | 🔴 | Present, but **unguarded** at [contentpopup.js:388](contentpopup.js#L388) — absent = uncaught throw. Add a guard (Step 2). |
| 3 | `div.popup_dialog` | `.popup_dialog` class | `data-popup-dialog` | 🔴 | Not in your markup. Used unguarded throughout — absent = component dies. Add attribute **and** guard. |
| 4 | `button.popup_close_wrap` | `[data-popup-close]` | — | 🟢 | |
| 5 | `div.popup_inner` | `[data-content-slot]` ✓ then `.popup_inner` | — | 🟢 | Attribute already primary in JS **and** present in your markup. The class fallback can be deleted outright. |
| 6 | — (fetched article page) | `[data-content]` | — | 🟢 | Lives on the **article page**, not the popup. Required. |
| 7 | Openers, page-wide | `.card_read, [data-popup-open], .r_articles_row_wrap` | `data-popup-open` | 🟡 | See 1D row 9. |
| 8 | `.card_wrap` (opener scope) | `[data-card], .card_wrap` | `data-card` | 🟡 | See 1D row 1. |
| 9 | `.card_title` | `[data-card-title], .card_title` | `data-card-title` | 🟡 | See 1D row 11. |

## 1D — The card (both modes)

This is your `.card_wrap` block. Rows marked **(inline only)** appear only in
the 16-9 variant.

| # | Element in your markup | Now | Add | | Notes |
|---|---|---|---|---|---|
| 1 | `div.card_wrap` | `[data-card], .card_wrap` | `data-card` | 🟡 | Lookup scope for the Read handoff (`closest()`). Not the JS root. |
| 2 | `div.card_layout` | — | — | — | Purely visual. No attribute. |
| 3 | `div.card_player` | `[data-player]` | — | 🟢 | **The JS root.** Both scripts scope from here. Carries `data-video-id`, `data-video-title`, and JS-written `-state` / `-hover`. |
| 4 | `div.card_player` (inline) | `[data-videoinline-player]` | — | 🟢 | **Mode switch.** Present = inline. Absent = popup. |
| 5 | `img.card_poster` | `[data-videoinline-poster-img]` | — | 🟢 | Note the popup-mode script also writes this one via `hydrateCard()`. |
| 6 | `img.card_preview` | `[data-videoinline-preview]` | — | 🟢 | Leave `src` empty in Webflow — filled lazily on first hover. |
| 7 | `div.card_fade` | — | — | — | Purely visual. |
| 8 | `button.card_watch` | **`.card_watch` class** | `data-card-watch` | 🔴 | **The one genuinely load-bearing class left.** `videopopup.js` warns and **bails on the whole card** if absent ([L189-193](videopopup.js#L189-L193)); `videoinline.js` matches it via `PLAY_TRIGGERS`. Highest-priority row in this document. |
| 9 | `a.card_read` | `.card_read` class | `data-popup-open` | 🟡 | Opens the content popup; its `href` also feeds the video→article handoff at [videopopup.js:807](videopopup.js#L807). |
| 10 | `div.card_poster_time` | `[data-videoinline-poster-time]` | — | 🟢 | |
| 11 | `div.card_title` | `[data-card-title], .card_title` | `data-card-title` | 🟡 | Supplies the popup aria-label. |
| 12 | `div.card_date` | — | — | — | Purely visual. |
| 13 | `div.card_poster_meta` | `[data-videoinline-poster-meta]` | — | 🟢 | |
| 14 | `video.card_video` **(inline only)** | `[data-videoinline-video]` | — | 🟢 | |
| 15 | `div.card_loading` **(inline only)** | `[data-videoinline-loading]` | — | 🟢 | |
| 16 | `button.card_bigbtn` **(inline only)** | `[data-videoinline-playpause]` | — | 🟢 | |
| 17 | `div.card_interface` **(inline only)** | `[data-videoinline-interface]` | — | 🟢 | |
| 18 | `div.card_timeline_wrap` **(inline only)** | `[data-videoinline-timeline]` | — | 🟢 | |
| 19 | `div.card_timeline_buffered` **(inline only)** | `[data-videoinline-buffered]` | — | 🟢 | |
| 20 | `div.card_timeline_progress` **(inline only)** | `[data-videoinline-progress]` | — | 🟢 | |
| 21 | `div.card_timeline_handle` **(inline only)** | `[data-videoinline-handle]` | — | 🟢 | |
| 22 | `button.card_playpause_wrap` **(inline only)** | `[data-videoinline-playpause]` | — | 🟢 | |
| 23 | `p.videoinline_time_progress` **(inline only)** | `[data-videoinline-progress-text]` | — | 🟢 | |
| 24 | `p.videoinline_time_duration` **(inline only)** | `[data-videoinline-duration-text]` | — | 🟢 | |
| 25 | `button.card_mute_wrap` **(inline only)** | `[data-videoinline-mute]` | — | 🟢 | |
| 26 | `div.card_slider_wrap` **(inline only)** | `[data-videoinline-volume]` | — | 🟢 | |
| 27 | `div.card_slider_fill` **(inline only)** | `[data-videoinline-volume-fill]` | — | 🟢 | |
| 28 | `button.card_fullscreen_wrap` **(inline only)** | `[data-videoinline-fullscreen]` | — | 🟢 | |

**Score: 23 of 28 already clean.** Five rows to author: 1, 8, 9, 11, plus the
icon pairs below.

### Card icons (inline variant)

Same treatment as 1B, different namespace — `videoinline.js` has its own ICON
map at [L34-41](videoinline.js#L34-L41):

| Element | Current class | Add |
|---|---|---|
| `svg.card_bigbtn_svg.card_play_icon` | `.card_play_icon` | `data-videoinline-icon="play"` |
| `svg.card_bigbtn_svg.card_pause_icon` | `.card_pause_icon` | `data-videoinline-icon="pause"` |
| `svg.card_playpause_svg.card_play_icon` | `.card_play_icon` | `data-videoinline-icon="play"` |
| `svg.card_playpause_svg.card_pause_icon` | `.card_pause_icon` | `data-videoinline-icon="pause"` |
| `svg.videoinline_volume_up_icon` | `.videoinline_volume_up_icon` | `data-videoinline-icon="volume-up"` |
| `svg.videoinline_volume_mute_icon` | `.videoinline_volume_mute_icon` | `data-videoinline-icon="volume-mute"` |
| `svg.card_fullscreen_maximise` | `.card_fullscreen_maximise` | `data-videoinline-icon="maximise"` |
| `svg.card_fullscreen_minimise` | `.card_fullscreen_minimise` | `data-videoinline-icon="minimise"` |

> Your markup is **inconsistent here** — the mute icons use the
> `videoinline_*` prefix while play/pause and fullscreen use `card_*`. Both
> scripts' ICON maps list both prefixes, so it works today. Attributes make the
> inconsistency irrelevant, which is a good reason to do this pair.

## 1E — CSS custom-property contract

Your inline card drives its own visibility through CSS variables set on
`.card_player` by an embed:

```css
--videoinline--idle · --videoinline--poster-events · --videoinline--interface-opacity
--videoinline--interface-events · --videoinline--bigbtn-opacity · --videoinline--bigbtn-events
```

These are **already attribute-agnostic** (custom properties, not classes) and
the script writes them on the element it found via `[data-player]`. Nothing to
migrate. But note the embed's selector is `.card_player` — that stylesheet rule
is class-bound. When you restyle with different classes, update that embed's
selector to `[data-player]` so the initial state travels with the attribute:

```css
[data-player] {
  --videoinline--idle: 1;
  --videoinline--poster-events: auto;
  --videoinline--interface-opacity: 0;
  --videoinline--interface-events: none;
  --videoinline--bigbtn-opacity: 0;
  --videoinline--bigbtn-events: none;
}
```

---

# Part 2 — Canonical markup (matching your structure)

Author these and the classes become optional decoration.

## Popup-mode card

```html
<div data-card class="card_wrap">
  <div class="card_layout">

    <div data-player
         data-video-id="e422a6c5-c952-47ed-8930-570a033149f9"
         data-video-title="Who Funds the Funders"
         class="card_player">

      <img data-videoinline-poster-img class="card_poster" alt="" loading="lazy">
      <img data-videoinline-preview    class="card_preview"  alt="" loading="lazy" src="">
      <div class="card_fade"></div>

      <div data-videoinline-poster-meta class="card_poster_meta">
        <button data-card-watch aria-label="Watch video" class="card_watch">
          <div class="card_watch_label">WATCH</div>
        </button>
        <div data-videoinline-poster-time class="card_poster_time">00:22</div>
        <a data-popup-open href="/full-investigation-page/who-funds-the-funders"
           class="card_read">
          <div class="card_read_label">READ</div>
        </a>
      </div>
    </div>

    <div class="card_info">
      <div data-card-title class="card_title">Who Funds the Funders</div>
      <div class="card_date">March 10, 2026</div>
    </div>

  </div>
</div>
```

**Do NOT add `data-videoinline-player`** — it flips the card to inline mode and
the popup will never open.

## Inline-mode card

Identical, **plus** on `.card_player`:

```html
<div data-player
     data-videoinline-player        ← the only structural difference
     data-video-id="…" data-video-title="…"
     class="card_player">
  <video data-videoinline-video playsinline preload="metadata" class="card_video"></video>
  …poster / preview / fade / poster_meta as above…
  <div data-videoinline-loading class="card_loading">…</div>
  <button data-videoinline-playpause class="card_bigbtn">…</button>
  <div data-videoinline-interface class="card_interface">…</div>
</div>
```

## Data-carrying attributes (values, not flags)

| Attribute | On | Required | Purpose |
|---|---|---|---|
| `data-video-id` | `.card_player` | Yes | Bunny GUID → poster, preview, HLS, popup. Warns if missing. |
| `data-video-title` | `.card_player` | Optional | Popup header title. |
| `data-videoinline-poster-src` | `.card_player` | Optional | CMS thumbnail override. Else `{base}/{guid}/thumbnail.jpg`. |
| `data-videoinline-preview-src` | `.card_player` | Optional | CMS preview override. Else `{base}/{guid}/preview.webp`. |
| `data-videoinline-src` | `.card_player` | Optional | Direct HLS override. |
| `href` | `[data-popup-open]` | Yes | Article URL — fetched, injected, hover-prefetched. |

## Attributes the JS **writes** — never author these

`data-videopop-state` · `data-videopop-hover` · `data-videopop-drag` ·
`data-videoinline-state` · `data-videoinline-hover` · `data-videoinline-drag` ·
`data-script-initialized` · `data-videopop-card-hydrated` ·
`data-videopop-bound` · `data-popup-bound`

They appear in your export because it was taken from a **live, running page**.
Authoring them in the Designer will confuse the init guards — strip them from
any markup you paste back in.

---

# Part 3 — Implementation steps

## Strategy: dual selectors, then drop the class half

Every changed selector becomes `[data-new-attr], .old_class`:

- Nothing breaks on deploy — existing pages keep working untouched.
- New components can be authored attribute-only.
- The class half is deleted later, one line per selector.

**Order:** ship the JS first (dual selectors are a no-op on current markup),
then add attributes in Webflow, then drop the fallbacks.

### Step 1 — `videopopup.js` dual selectors

```js
const CARD  = '[data-player]';                       // already done
const WATCH = '[data-card-watch], .card_watch';      // L37

// L209
document.querySelectorAll('[data-videopop], .videopop_wrap')
// L218
component.querySelector('[data-videopop-dialog], .videopop_dialog')
// L242
component.querySelector('[data-videopop-playpause-label], .videopop_playpause_label')
// L243
component.querySelector('[data-videopop-bigbtn], .videopop_bigbtn_wrap, .card_bigbtn_wrap')
// L802
activeOpener.closest('[data-card], .card_wrap')      // already dual
// L807
card?.querySelector('[data-popup-open], .card_read')
// L813
document.querySelector('[data-popup], .popup_wrap')

// L50-55
const ICON = {
  play:       '[data-videopop-icon="play"], .videopop_play_icon, .card_play_icon',
  pause:      '[data-videopop-icon="pause"], .videopop_pause_icon, .card_pause_icon',
  volumeUp:   '[data-videopop-icon="volume-up"], .videopop_volume_up_icon, .card_volume_up_icon',
  volumeMute: '[data-videopop-icon="volume-mute"], .videopop_volume_mute_icon, .card_volume_mute_icon',
  maximise:   '[data-videopop-icon="maximise"], .videopop_fullscreen_maximise, .card_fullscreen_maximise',
  minimise:   '[data-videopop-icon="minimise"], .videopop_fullscreen_minimise, .card_fullscreen_minimise'
};
```

Also update the warning at [L191](videopopup.js#L191) — it interpolates `WATCH`
into the message, which will now print the whole dual selector. Fine, but read
it once to confirm it still makes sense.

> **`POPUP_CARD` hazard — already avoided.** A dual selector
> `'[data-card-player], .card_player:not([data-videoinline-player])'` would bind
> `:not()` to only the second half, and every inline card would be claimed by
> the popup. Because `data-player` was already on every card, `CARD` was swapped
> outright with no dual phase, and `POPUP_CARD` interpolates `CARD`. **Do not
> reintroduce a dual selector on `CARD`** without wrapping each half in its own
> `:not()`.

### Step 2 — `contentpopup.js` dual selectors + guard the crash paths

```js
// L273
document.querySelectorAll('[data-popup], .popup_wrap')
// L280
component.querySelector('[data-popup-dialog], .popup_dialog')
// L283-284 — collapses to one line, attribute is already primary AND present
component.querySelector('[data-content-slot]')
// L418
document.querySelectorAll('[data-popup-open], .card_read, .r_articles_row_wrap')
// L440 — already dual
card.querySelector('[data-card-title], .card_title')
```

Then guard. [L388](contentpopup.js#L388) calls `backdrop.addEventListener`
unguarded, and `dialog` is used unguarded throughout — a component missing
either throws and dies. `videopopup.js` already guards its backdrop
([L219](videopopup.js#L219)); match that:

```js
if (!dialog) {
  console.warn('[popup] no [data-popup-dialog] found', component);
  return;
}
if (backdrop) backdrop.addEventListener('click', closePopup);
else console.warn('[popup] no [data-popup-backdrop] found', component);
```

This is the highest-value change in the document — it converts a silent
whole-component death into a console warning.

### Step 3 — `videoinline.js` dual selectors

```js
// L44
const PLAY_TRIGGERS =
  '[data-videoinline-playpause], [data-card-watch], [data-card-play], .card_watch';

// L34-41
const ICON = {
  play:       '[data-videoinline-icon="play"], .videoinline_play_icon, .card_play_icon',
  pause:      '[data-videoinline-icon="pause"], .videoinline_pause_icon, .card_pause_icon',
  volumeUp:   '[data-videoinline-icon="volume-up"], .videoinline_volume_up_icon, .card_volume_up_icon',
  volumeMute: '[data-videoinline-icon="volume-mute"], .videoinline_volume_mute_icon, .card_volume_mute_icon',
  maximise:   '[data-videoinline-icon="maximise"], .videoinline_fullscreen_maximise, .card_fullscreen_maximise',
  minimise:   '[data-videoinline-icon="minimise"], .videoinline_fullscreen_minimise, .card_fullscreen_minimise'
};
```

`data-card-play` is a cardmode leftover — it goes in Step 5.

### Step 4 — Webflow authoring, in priority order

Both selectors match, so pages migrate one at a time with no coordination.

| Priority | Attribute | Element | Why first |
|---|---|---|---|
| 1 | `data-popup` | `section.popup_wrap` | Root. Not in your markup at all. Both scripts need it. |
| 2 | `data-popup-dialog` | `div.popup_dialog` | Root-adjacent, current crash path. |
| 3 | `data-card-watch` | `button.card_watch` | Only load-bearing class left on the card; its absence kills the whole card in popup mode. |
| 4 | `data-videopop` / `data-videopop-dialog` | popup section / dialog | **Already in your markup** — no Designer work, JS-side only. |
| 5 | `data-popup-open` | `a.card_read` | Opener + Read-handoff href. |
| 6 | `data-card`, `data-card-title` | `.card_wrap`, `.card_title` | Handoff scope and aria-label. |
| 7 | `data-videopop-bigbtn`, `data-videopop-playpause-label` | popup controls | Cosmetic hooks. |
| 8 | Icon attributes (16 SVGs) | all icon SVGs | Bulkiest, lowest risk — keep classes for CSS regardless. |

### Step 5 — drop the class fallbacks

Once every component carries attributes, delete the `, .old_class` half of each
selector and drop `[data-card-play]` from `PLAY_TRIGGERS`. The Part 1 tables are
the checklist. **Keep the icon classes in the CSS** (see the 1B caveat) — only
remove them from the JS selectors.

---

# Part 4 — Retired: `cardmode.js`

`cardmode.js` is no longer loaded. Load order is now `videopopup.js` →
`videoinline.js`. Its responsibilities moved:

| Old cardmode job | Where it lives now |
|---|---|
| Decide inline vs popup from `<video>` presence | `POPUP_CARD` selector, from `data-videoinline-player` ([videopopup.js:38](videopopup.js#L38)) |
| Stamp `data-videopop-open` on WATCH | Not needed — WATCH found by descending from the card ([L189](videopopup.js#L189)) |
| Stamp `data-card-play` on WATCH | Not needed — `PLAY_TRIGGERS` matches `.card_watch` |
| Copy GUID/title onto the button | Not needed — read off `[data-player]` |
| Poster/preview hydration | `hydrateCard()` ([videopopup.js:117](videopopup.js#L117)) |
| `CLICK_ANYWHERE` whole-poster click | **Dropped.** Re-add on the card if wanted. |

Housekeeping done 2026-08-21: `cardmode.js`, `test-cardmode.cjs` and
`test-hidden.cjs` moved to [`archive/`](archive/); `CARD-COMPONENT-HOWTO.md`
carries a superseded banner; `test/README.md` rewritten.

**Coverage gap:** mode detection, WATCH binding and `hydrateCard()` are
untested. The `CARD` → `[data-player]` swap was verified ad-hoc in jsdom, not by
a committed harness. Worth adding before Step 5 removes the safety net.

---

# Risks

| Risk | Mitigation |
|---|---|
| **`.card_watch` bails the whole card** | Highest-priority authoring row. Until `data-card-watch` ships, renaming that class silently kills WATCH on every popup card. |
| **`contentpopup` crashes on missing dialog/backdrop** | Step 2 guards. Do this even if you postpone the rest. |
| Icon display resolved from stylesheet at init | Keep icon classes carrying their CSS; only the lookup moves to attributes. |
| `POPUP_CARD` `:not()` distribution | Resolved — never reintroduce a dual selector on `CARD` without per-half `:not()`. |
| `data-popup-open` also matches related-article rows | Intended — one attribute for all openers. Verify rows swap content in place rather than navigating. |
| 3s hover idle timeout returns preview→thumbnail | Pre-existing ([videopopup.js:158-166](videopopup.js#L158-L166)). A motionless cursor on a card reverts to the still. Decide whether popup cards should keep it. |
| Live-export attributes pasted back into Designer | Strip the JS-written attributes listed at the end of Part 2. |
| `.card_player` selector in the CSS embed | Change to `[data-player]` (Part 1E) or the initial-state variables stay class-bound. |
