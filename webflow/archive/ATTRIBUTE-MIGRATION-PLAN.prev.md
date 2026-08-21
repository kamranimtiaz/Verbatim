# Attribute Migration Plan — removing class dependence

> **Scope note:** `cardmode.js` is **no longer used.** Its job was absorbed into
> `videopopup.js`. This plan covers the three live scripts only:
> `videopopup.js`, `videoinline.js`, `contentpopup.js`.
> `webflow/cardmode.js`, `CARD-COMPONENT-HOWTO.md` and `webflow/test/*` still
> describe the retired architecture — see [Part 4](#part-4--retired-cardmodejs).

## Why

The live scripts are **hybrid**: some elements are found by `data-*` attribute,
others by Webflow class name. Renaming a class in the Designer — a normal,
harmless-looking refactor — silently breaks behaviour, and in one place throws
an uncaught error that kills the component's init.

Goal: **every element the JS needs is found by attribute.** Classes go back to
being purely visual.

## Current state

| File | Class-dependent? | Count |
|---|---|---|
| `videoinline.js` | **No** — already 100% attribute-driven | 1 (a legacy alias only) |
| `videopopup.js` | Yes — the bulk of it | 21 |
| `contentpopup.js` | Yes | 6 |

## How mode is decided **now** (no cardmode.js)

`videopopup.js` derives it declaratively from a selector, rather than stamping
attributes at runtime the way cardmode did:

```js
const CARD        = '.card_player';
const INLINE_FLAG = '[data-videoinline-player]';
const POPUP_CARD  = `${CARD}:not(${INLINE_FLAG})`;
```

- Card **has** `data-videoinline-player` → inline. `videoinline.js` claims it;
  `videopopup.js` skips it.
- Card **lacks** it → popup. `videopopup.js` claims it, calls `hydrateCard()`,
  and binds the card's `.card_watch` as an opener.

Two consequences that differ from the old cardmode world:

1. **`data-videoinline-player` is now authored in Webflow**, not stamped at
   runtime. It is the mode switch. Presence of a `<video>` child no longer
   decides anything.
2. **The WATCH button needs no role attribute at all.** `videopopup.js` finds it
   by descending from the card ([L189](videopopup.js#L189)). `videoinline.js`
   picks it up via `PLAY_TRIGGERS`, which already includes `.card_watch`
   ([L44](videoinline.js#L44)).

## Migration strategy

**Dual-selector, not replace.** Every changed selector becomes
`[data-new-attr], .old_class`:

- Nothing breaks on deploy; existing pages keep working untouched.
- New/edited components can be authored attribute-only.
- The class half is deleted later, one line per selector.

**Order:** ship the JS first (dual selectors are a no-op on current markup),
then add attributes in Webflow component by component, then drop the fallbacks.

---

# Part 1 — Class → attribute mapping (complete)

Convention: namespace prefix matching the owning script (`popup`, `videopop`,
`card`), lowercase, hyphenated. Presence is the signal — no value — except where
the attribute carries data.

## videopopup.js — component shell

| Current selector | Type | New attribute | Line | Required | Notes |
|---|---|---|---|---|---|
| `.videopop_wrap` | class | `data-videopop` | [L209](videopopup.js#L209) | **Yes** | Component root. Without it nothing initializes. |
| `.videopop_dialog` | class | `data-videopop-dialog` | [L218](videopopup.js#L218) | **Yes** | |
| `.videopop_playpause_label` | class | `data-videopop-playpause-label` | [L242](videopopup.js#L242) | Optional | Text swapped Play/Pause. |
| `.videopop_bigbtn_wrap` | class | `data-videopop-bigbtn` | [L243](videopopup.js#L243) | Optional | Centre overlay play button. |
| `.card_bigbtn_wrap` | class | `data-videopop-bigbtn` *(same)* | [L243](videopopup.js#L243) | Optional | Two classes collapse to one attribute. |

## videopopup.js — cards

| Current selector | Type | New attribute | Line | Required | Notes |
|---|---|---|---|---|---|
| ~~`.card_player`~~ | class | **`data-player`** ✅ **DONE** | [L35](videopopup.js#L35) | **Yes** | Migrated 2026-08-21. Attribute already present on all cards, so no Webflow authoring was needed. `POPUP_CARD` derives from `CARD`, so it followed automatically. |
| `.card_watch` | class | `data-card-watch` | [L37](videopopup.js#L37) | **Yes** | WATCH button, found by descending from the card. |
| `.card_wrap` | class | `data-card` *(already exists)* | [L802](videopopup.js#L802) | Optional | Read-handoff scope. |
| `.card_read` | class | `data-popup-open` | [L807](videopopup.js#L807) | Optional | Article href for the Read handoff. |
| `.popup_wrap` | class | `data-popup` | [L813](videopopup.js#L813) | Optional | Cross-script handle. Must match contentpopup's new root. |
| `[data-videoinline-player]` | attr | — unchanged | [L36](videopopup.js#L36) | — | **The mode switch.** Authored in Webflow on inline cards only. |

## videopopup.js — icons ([L49-55](videopopup.js#L49-L55))

Each pair collapses to **one** attribute. Twelve classes become six.

| Current selector | New attribute | Required |
|---|---|---|
| `.videopop_play_icon, .card_play_icon` | `data-videopop-icon="play"` | Optional |
| `.videopop_pause_icon, .card_pause_icon` | `data-videopop-icon="pause"` | Optional |
| `.videopop_volume_up_icon, .card_volume_up_icon` | `data-videopop-icon="volume-up"` | Optional |
| `.videopop_volume_mute_icon, .card_volume_mute_icon` | `data-videopop-icon="volume-mute"` | Optional |
| `.videopop_fullscreen_maximise, .card_fullscreen_maximise` | `data-videopop-icon="maximise"` | Optional |
| `.videopop_fullscreen_minimise, .card_fullscreen_minimise` | `data-videopop-icon="minimise"` | Optional |

> Valued attribute, not six bare ones — it keeps the ICON map a simple
> key→selector lookup and reads better in the Designer.
> **Caveat:** icon visibility is resolved from the *stylesheet* at init
> ([L28-31](videopopup.js#L28)), borrowing the display value from a visible
> sibling. The classes must keep carrying that CSS; only the *lookup* moves to
> attributes.

## contentpopup.js

| Current selector | Type | New attribute | Line | Required | Notes |
|---|---|---|---|---|---|
| `.popup_wrap` | class | `data-popup` | [L273](contentpopup.js#L273) | **Yes** | Component root. |
| `.popup_dialog` | class | `data-popup-dialog` | [L280](contentpopup.js#L280) | **Yes** | **Hard-crash today** if absent. Add a guard. |
| `.popup_inner` | class | `data-content-slot` *(already exists)* | [L284](contentpopup.js#L284) | **Yes** | Attribute is already primary; just author it. |
| `.card_read` | class | `data-popup-open` *(already exists)* | [L418](contentpopup.js#L418) | — | Already supported. |
| `.r_articles_row_wrap` | class | `data-popup-open` *(same)* | [L418](contentpopup.js#L418) | — | Collapses into the generic opener attribute. |
| `.card_wrap` | class | `data-card` *(already exists)* | [L437](contentpopup.js#L437) | Optional | |
| `.card_title` | class | `data-card-title` *(already exists)* | [L440](contentpopup.js#L440) | Optional | |
| `[data-popup-backdrop]` | attr | — unchanged | [L279](contentpopup.js#L279) | **Yes** | **Hard-crash today** if absent. |
| `[data-popup-close]` | attr | — unchanged | [L281](contentpopup.js#L281) | Optional | |
| `[data-popup-stagger]` | attr | — unchanged | [L291](contentpopup.js#L291) | Optional | |
| `[data-content]` | attr | — unchanged | [L255](contentpopup.js#L255) | **Yes** | On the **fetched article page**, not the popup. |

> Four of seven already have an attribute path. Only `.popup_wrap` and
> `.popup_dialog` need genuinely new attributes.

## videoinline.js

One legacy alias only — `PLAY_TRIGGERS` at [L44](videoinline.js#L44):

```js
const PLAY_TRIGGERS = '[data-videoinline-playpause], [data-card-play], .card_watch';
```

Becomes `'[data-videoinline-playpause], [data-card-watch], [data-card-play], .card_watch'`.
`data-card-play` is itself a cardmode leftover — drop it in Step 5.

Everything else is already attribute-only, and is the naming reference:
`data-videoinline-player`, `-video`, `-poster-img`, `-preview`, `-mute`,
`-fullscreen`, `-timeline`, `-progress`, `-buffered`, `-handle`,
`-progress-text`, `-duration-text`, `-poster-time`, `-loading`, `-volume`,
`-volume-fill`, `-playpause`, plus data-carrying `data-video-id`,
`data-videoinline-src`, `data-videoinline-poster-src`,
`data-videoinline-preview-src`.

---

# Part 2 — The card you described

> *"A card which when hovered shows preview, otherwise thumbnail. When a button
> is clicked it opens the video popup."*

**Good news: this already works.** `hydrateCard()`
([videopopup.js:117-167](videopopup.js#L117-L167)) does exactly this for
popup-mode cards — lazy preview load on `pointerenter`/`focusin`, poster from
CMS-or-Bunny, hover state attribute, CDN warming. No new capability is needed;
only the attribute renames below.

## Card wrapper

| Attribute | Value | Required | Purpose |
|---|---|---|---|
| `data-card-player` | — | Yes | Marks it a video card. Popup mode = this **without** `data-videoinline-player`. |
| `data-video-id` | Bunny GUID | Yes | One CMS field → poster, preview, HLS, popup. Warns if missing. |
| `data-videopop-title` | text | Optional | Popup header title. |
| `data-videoinline-poster-src` | URL | Optional | CMS thumbnail override. Else `{base}/{guid}/thumbnail.jpg`. |
| `data-videoinline-preview-src` | URL | Optional | CMS preview override. Else `{base}/{guid}/preview.webp`. |
| `data-card` | — | Optional | Only for the Read-handoff lookup scope. |

**Do NOT add `data-videoinline-player`** — that flips the card to inline mode and
the popup will never open.

## Thumbnail image (the still)

| Attribute | Value | Required | Purpose |
|---|---|---|---|
| `data-videoinline-poster-img` | — | Yes | The `<img>` showing the still. `hydrateCard` sets its `src` (and strips `srcset`/`sizes` so Webflow's responsive set can't override). |

## Preview (animated hover art)

| Attribute | Value | Required | Purpose |
|---|---|---|---|
| `data-videoinline-preview` | — | Yes | The `<img>` for the animated webp. **Leave `src` empty in Webflow** — filled lazily on first hover, once only. |

Crossfade is CSS, driven by the state attribute the script writes on the **card**:

```css
[data-card-player] [data-videoinline-preview] { opacity: 0; transition: opacity .25s; }
[data-card-player][data-videoinline-hover="active"] [data-videoinline-preview] { opacity: 1; }
```

> `data-videoinline-hover` flips to `active` on `pointermove` and back to `idle`
> on `pointerleave` **or after a 3s idle timeout** ([L158-166](videopopup.js#L158-L166)).
> So a motionless cursor parked on the card returns to the thumbnail. If you want
> preview to persist while hovered, that timeout needs removing for popup cards.

## WATCH button

| Attribute | Value | Required | Purpose |
|---|---|---|---|
| `data-card-watch` | — | Yes | Found by descending from the card; bound as the opener. |

No role attribute needed — that was cardmode's job and it is gone.

## Read link (optional)

| Attribute | Value | Required | Purpose |
|---|---|---|---|
| `data-popup-open` | — | Yes | Opens the content popup. |
| `href` | article URL | Yes | Fetched and injected; also drives hover prefetch. |
| `data-card-title` | — | Optional | On the title element, for the popup aria-label. |

## Complete markup

```html
<div data-card
     data-card-player
     data-video-id="e422a6c5-c952-47ed-8930-570a033149f9"
     data-videopop-title="Sixty Seconds on the Scandal"
     class="card_wrap card_player">

  <div class="card_media">
    <img data-videoinline-poster-img class="card_poster" alt="">
    <img data-videoinline-preview class="card_preview" alt="" src="">
  </div>

  <h3 data-card-title class="card_title">Sixty Seconds on the Scandal</h3>
  <button data-card-watch class="card_watch">Watch</button>
  <a data-popup-open href="/articles/who-funds-the-funders" class="card_read">Read</a>
</div>
```

Classes stay for styling only. Delete every one and the card still works.

## The inline variant, for contrast

Same markup **plus** `data-videoinline-player` on the wrapper and a
`<video data-videoinline-video>` inside. That one attribute is the entire
difference.

---

# Part 3 — Implementation steps

### Step 1 — dual selectors (no behaviour change)

`videopopup.js`
```js
// DONE — no dual selector needed: data-player was already on every card.
const CARD  = '[data-player]';
const WATCH = '[data-card-watch], .card_watch';
// POPUP_CARD derives from CARD, so it needed no separate edit:
const POPUP_CARD = `${CARD}:not(${INLINE_FLAG})`;

document.querySelectorAll('[data-videopop], .videopop_wrap')
component.querySelector('[data-videopop-dialog], .videopop_dialog')
component.querySelector('[data-videopop-playpause-label], .videopop_playpause_label')
component.querySelector('[data-videopop-bigbtn], .videopop_bigbtn_wrap, .card_bigbtn_wrap')
card?.querySelector('[data-popup-open], .card_read')
document.querySelector('[data-popup], .popup_wrap')

const ICON = {
  play:       '[data-videopop-icon="play"], .videopop_play_icon, .card_play_icon',
  pause:      '[data-videopop-icon="pause"], .videopop_pause_icon, .card_pause_icon',
  volumeUp:   '[data-videopop-icon="volume-up"], .videopop_volume_up_icon, .card_volume_up_icon',
  volumeMute: '[data-videopop-icon="volume-mute"], .videopop_volume_mute_icon, .card_volume_mute_icon',
  maximise:   '[data-videopop-icon="maximise"], .videopop_fullscreen_maximise, .card_fullscreen_maximise',
  minimise:   '[data-videopop-icon="minimise"], .videopop_fullscreen_minimise, .card_fullscreen_minimise'
};
```

> **`POPUP_CARD` risk — now avoided.** The danger was a dual selector like
> `'[data-card-player], .card_player:not(...)'`, where `:not()` binds to only
> the second half and every inline card gets claimed by the popup. Because
> `data-player` was already on every card, `CARD` was swapped outright with no
> dual-selector phase, and `POPUP_CARD` interpolates `CARD` — so the hazard
> never arose. Verified in jsdom against the live card markup: an inline card
> (`data-videoinline-player`) is excluded, popup cards are selected, and
> `watch.closest(CARD)` resolves to the right card.

`contentpopup.js`
```js
document.querySelectorAll('[data-popup], .popup_wrap')
component.querySelector('[data-popup-dialog], .popup_dialog')
component.querySelector('[data-content-slot], .popup_inner')
document.querySelectorAll('[data-popup-open], .card_read, .r_articles_row_wrap')
```

`videoinline.js`
```js
const PLAY_TRIGGERS =
  '[data-videoinline-playpause], [data-card-watch], [data-card-play], .card_watch';
```

### Step 2 — fix the two hard-crash paths

[contentpopup.js:388](contentpopup.js#L388) calls `backdrop.addEventListener`
unguarded, and `dialog` is used unguarded throughout, so a component missing
either throws and dies. `videopopup.js` already guards its backdrop
([L219](videopopup.js#L219)) — match that:

```js
if (backdrop) backdrop.addEventListener('click', closePopup);
else console.warn('[popup] no [data-popup-backdrop] found', component);
if (!dialog) { console.warn('[popup] no [data-popup-dialog] found', component); return; }
```

### Step 3 — Webflow authoring

Per component, add the new attributes alongside the existing classes. Both
selectors match, so pages migrate one at a time with no coordination.

Priority order:
1. `data-videopop` / `data-popup` (roots — nothing works without them)
2. `data-videopop-dialog` / `data-popup-dialog`
3. `data-card-player` / `data-card-watch`
4. Icons and optional extras

### Step 4 — drop the class fallbacks

Once every component carries attributes, delete the `, .old_class` half of each
selector, and drop `[data-card-play]` from `PLAY_TRIGGERS`. One line per
selector; the Part 1 tables are the checklist.

---

# Part 4 — Retired: cardmode.js

`cardmode.js` is no longer loaded. Its responsibilities moved:

| Old cardmode job | Where it lives now |
|---|---|
| Decide inline vs popup from `<video>` presence | `POPUP_CARD` selector, from `data-videoinline-player` ([videopopup.js:38](videopopup.js#L38)) |
| Stamp `data-videopop-open` on WATCH | Not needed — WATCH found by descending from the card ([L189](videopopup.js#L189)) |
| Stamp `data-card-play` on WATCH | Not needed — `PLAY_TRIGGERS` already matches `.card_watch` |
| Copy GUID/title onto the button | Not needed — read off the card |
| Poster/preview hydration | `hydrateCard()` ([videopopup.js:117](videopopup.js#L117)) |
| `CLICK_ANYWHERE` whole-poster click | **Dropped.** Re-add on the card if wanted. |

Housekeeping — **done 2026-08-21**:

- `webflow/cardmode.js` → moved to [`archive/cardmode.js`](archive/cardmode.js).
  Archived rather than deleted: nothing loads it (no HTML page referenced it),
  but it is the only record of the retired dispatch logic.
- `webflow/test/test-cardmode.cjs`, `test-hidden.cjs` → moved to
  [`archive/`](archive/). They read `cardmode.js` off disk, so they would have
  thrown once it was gone.
- [`CARD-COMPONENT-HOWTO.md`](CARD-COMPONENT-HOWTO.md) → **superseded banner
  added** at the top listing the five instructions that are now wrong. Body
  kept for history.
- [`test/README.md`](test/README.md) → rewritten; documents what the retired
  tests covered and what a `videopopup.js`-targeted replacement should assert.
- Load order is now just `videopopup.js` → `videoinline.js`.

**Coverage gap opened by this:** mode detection, WATCH binding and
`hydrateCard()` are untested. The `CARD` → `[data-player]` swap was verified
ad-hoc in jsdom rather than by a committed harness; a permanent one targeting
`videopopup.js` is still worth adding.

---

# Risks

| Risk | Mitigation |
|---|---|
| ~~**`POPUP_CARD` `:not()` distribution**~~ | **Resolved.** `CARD` swapped outright to `[data-player]`, no dual selector, so `:not()` never had two halves to distribute across. Verified in jsdom. |
| Icon display resolved from stylesheet | Keep the icon classes carrying their CSS; only the lookup moves to attributes. |
| `data-popup-open` now also matches related-article rows | Intended — one attribute. Verify rows still swap content in place rather than navigating. |
| 3s hover idle timeout returns preview→thumbnail | Pre-existing. Decide whether popup cards should keep it. |
| Stale cardmode docs/tests mislead the next build | Part 4 housekeeping. |
