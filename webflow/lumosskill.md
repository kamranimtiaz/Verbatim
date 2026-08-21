---
name: lumos-skill
description: "Build responsive layouts for Webflow using the Lumos Framework by Timothy Ricks. Use this skill whenever the user asks about Webflow layouts, HTML structure for Webflow, responsive design in Webflow, Lumos classes, Lumos utility classes, Webflow components, Webflow sections, grids, flexbox, spacing, typography, color themes, or anything related to structuring a Webflow site. Also trigger when the user mentions \"Lumos\", \"u-\" classes, \"breakpointless\", fluid sizing, or Webflow framework patterns — even if they don't explicitly say \"Lumos Framework.\""
---
 
# Lumos Framework — Responsive Layouts for Webflow
 
Docs: https://lumos.timothyricks.com/
 
Output will be pasted into an existing Lumos project. All utility classes and variables are pre-defined.
 
## Rules
 
### Output
 
- Vanilla HTML, CSS, JS only
- Only write CSS for component classes and container queries — never for `u-*` utilities
- No CSS resets, `:root` definitions, `body` styles, or utility redefinitions
- No `px` — default to `rem`. Text `max-width` uses `ch`. Container query breakpoints use `em`
- Class-only selectors — no tag names, IDs, data attributes, or descendant selectors
- No fallback values in `var()` — exception: responsive keyword variables (e.g. `var(--flex-medium, grid)`)
- No inline `style=""` — put styles in `<style>` block
- `<style>` first child inside `_wrap`, `<script>` last child:
  ```html
  <section class="hero_wrap u-section">
    <style> /* ... */ </style>
    <!-- component markup -->
    <script> /* ... */ </script>
  </section>
  ```
- No `::before`/`::after` — use a `<div>` with a class
- No `<em>` tag for italic — use `font-style: italic` in CSS on a `<span>` with a component class
- Use `<div>` for text elements, not `<span>` — only use `<span>` inside headings (`<h1>`–`<h6>`) or paragraphs (`<p>`)
- Empty divs (decorative, spacers) need `padding: 0` — Webflow adds default padding
- `background-color` not `background`. `overflow: clip` not `overflow: hidden`
- When setting `color` alongside `background-color`, apply both to the same element — don't put `background-color` on a parent and `color` on a child. The element with the background should own its text color
- `var(--border-width--main)` for all border widths
- Always use `--_theme---*` variables for colors. When a design specifies a color outside the theme system, map it to the closest theme variable. **Never use hex codes anywhere — not in CSS, comments, or explanatory text.** Don't tell the user to map hex values — just use the closest `--_theme---*` variable directly
- `img`/`video` already have `object-fit: cover` and `img` has `width: 100%` — don't re-add
- Icons/logos next to text need `flex-shrink: 0`
- Square icons/logos: `width` + `aspect-ratio: 1/1` — not `width` + `height`
- Logos need `object-fit: contain` (overrides default `cover`)
- Input elements must have `font-size` no smaller than `1rem` — below `1rem` triggers auto-zoom on iOS
- SVGs get their own component class. Stroke attributes in CSS, not inline. `stroke-width: var(--border-width--main)`. `stroke: currentColor`
- Respect `prefers-reduced-motion` for complex animations — not needed for simple CSS transitions
- Accessibility: tabs need `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-controls`, `aria-selected`, `aria-labelledby`. Accordions need `aria-expanded`, `aria-controls`. Keyboard nav (`Enter`, `Space`, arrows). Screen reader–only text: use `u-sr-only` class
### JavaScript
 
- Scoped per component with init guard:
  ```html
  <script>
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".component_wrap").forEach((component) => {
      if (component.dataset.scriptInitialized) return;
      component.dataset.scriptInitialized = "true";
      // component.querySelector(".component_element")
    });
  });
  </script>
  ```
- `const`/`let` only, no `var`. No ALL_CAPS names
- Target by class or `data-` attribute only — never by `id`. Scope to component: `component.querySelector(...)`. Only use `document.querySelector` to reach outside the component (rare, should be commented)
- Only `.is-active` for toggling state — no `.is-visible`, `.is-open`, etc.
- JS-appended elements: never hard-code HTML strings. Place a hidden template inside the component wrapped in `.[component]_hidden.u-display-none`. JS clones from the template:
  ```html
  <div class="tabs_hidden u-display-none">
    <div class="tabs_toast">
      <span class="tabs_toast_text u-text-style-small"></span>
    </div>
  </div>
  ```
  ```javascript
  const template = component.querySelector(".tabs_hidden .tabs_toast");
  const toast = template.cloneNode(true);
  toast.querySelector(".tabs_toast_text").textContent = message;
  component.querySelector(".tabs_list").appendChild(toast);
  ```
  Never use `innerHTML`, `createElement`, or template literal HTML for elements with visual structure
- No classes without CSS styles — use DOM order for JS targeting
- Screen size checks: `getComputedStyle` not `window.innerWidth`
- Mobile interaction override: `transform: unset !important;` inside container query
### Class Naming
 
- Component class first, then utilities: `<h2 class="hero_title u-text-style-h2">`
- Underscores separate parts: `[component]_[type]_[element]`
- Broadest type first → specific → element: `card_testimonial_title`, `cta_secondary_visual_img`
- Preferred names: `_title` not `_heading`, `_text` not `_paragraph`, `_img` not `_image`
- `_wrap` marks component/subcomponent start: `tabs_wrap` (component), `tabs_link_wrap` (subcomponent)
- Max 3 underscores. Deeper nesting starts a new subcomponent: `cta_secondary_icon_wrap` not `cta_secondary_visual_icon_wrap`
- Hyphens only for multi-word parts: `tabs_link_wrap` not `tabs_link-wrap`
- Utilities: `u-` prefix. Combo classes: `.is-reversed`, `.is-1`, `.is-active`
- Combo classes always scoped: `.hero_card_wrap.is-reversed { }` not `.is-reversed { }`
- Combo classes must exist in the HTML — Webflow removes unused classes. If a combo class is only applied dynamically (e.g. JS toggling `.is-active`) **and has CSS styles defined for it** (e.g. `.tabs_link_wrap.is-active { ... }`), place an element with it inside a `[component]_hidden u-display-none` div. If the combo class has no CSS (JS only uses it for querying/targeting), no `_hidden` placeholder is needed. If a `_hidden` div already exists (for clone templates), reuse it
- Every element must have a component class — no bare `<span>`, `<div>`, or `<a>` with only a utility class
- Interactive elements (`<a>`, `<button>`) that act as component roots must end in `_wrap`
- Any element containing children with component classes must end in `_wrap`
- SVG `<path>` and `<line>` elements need their own component class for stroke styling — named as siblings to the SVG, not nested: `enterprise_button_path` not `enterprise_button_svg_path`
- SVG inside a subcomponent starts a new subcomponent name: `enterprise_button_svg` not `enterprise_button_arrow_svg`
- Decorative SVGs need `aria-hidden="true"`
- Images (not logos, not transparent) need `background-color: var(--_theme---background-skeleton)` as a loading placeholder
- Direct parents of text elements should not be `display: flex` — flex prevents margin collapsing. Use `display: block` or no display override
- Buttons must be wrapped in a div with `u-button-wrapper`: `<div class="hero_actions u-button-wrapper">`
### Sections & Containers
 
```html
<section class="[name]_wrap u-section">
  <div class="[name]_contain u-container">
    <div class="[name]_layout">
      ...
    </div>
  </div>
</section>
```
- `u-section`: `display: flex; flex-flow: column; background-color: var(--_theme---background); color: var(--_theme---text); padding-top/bottom: var(--_spacing---section-space--main)`
- `u-container`: `max-width: var(--max-width--main); width: calc(100% - var(--site--margin) * 2); display: flex; flex-flow: column; container-type: inline-size; gap: var(--_spacing---space--8)`
- **Never apply layout directly on `u-container`** — it has `container-type: inline-size`, so `@container` rules affect its children, not itself. Always use a child `_layout` div:
  ```css
  /* CORRECT */ .hero_layout { display: var(--flex-medium, grid); flex-direction: column; grid-template-columns: repeat(12, minmax(0, 1fr)); }
  /* WRONG */  .hero_contain { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); }
  ```
- First section: use `--_spacing---section-space--page-top` for nav offset
### Layout
 
- Grid columns: always `minmax(0, 1fr)` — never bare `1fr`: `repeat(2, minmax(0, 1fr))` not `1fr 1fr`
- `grid-column-end: span 5` not `grid-column-end: 6`. Both: `grid-column: 1 / span 5`
- Any element with `display: var(--flex-medium, grid)` or `display: grid` must also have `flex-direction: column`
- Direct grid children need `width: 100%`
- Content blocks: `width: 100%` + `align-self: start|center|end` for vertical alignment
- Two-column grids: `grid-row-gap: var(--_spacing---space--8)`
- DOM order + `grid-column-start`/`grid-row-start` for positioning — avoid `order`
- Minimize `@container` code — ideally only `display: flex` on parent
### Sizes & Spacing
 
- Spacing: `--_spacing---space--1` through `--8`. `space--1`/`space--2` too small for text — use `space--3`+
- Section padding: `--_spacing---section-space--none|small|main|large|page-top`
- Container widths: `--max-width--small: 50rem`, `--max-width--main: 90rem`, `--max-width--full: 100%`
- `--site--margin`, `--site--gutter`
- `--radius--small`, `--radius--main`, `--radius--round`
- `u-margin-trim` removes first child margin-top / last child margin-bottom
- Gap for lists/columns, margins for text elements
- Flex containers with multiple children should almost always have `gap` using a spacing variable — missing gap is a common oversight
### Typography
 
- Headings: `u-text-style-display`, `u-text-style-h1`–`h6`
- Paragraphs: `u-text-style-large`, `u-text-style-main`, `u-text-style-small`
- Tag (`h1`–`h6`) is semantic; utility controls visual size
- Font weight: use `--_typography---font--primary-regular`, `--_typography---font--primary-medium`, or `--_typography---font--primary-bold` — never raw numeric weights like `400`, `500`, `700`
- Letter spacing: use `--_typography---letter-spacing--tight` (-0.03em) — never raw values like `-0.03em` or `-1px`
- Most headings and body text need `margin-bottom: var(--_text-style---margin-bottom)` for vertical rhythm
- The direct parent of text elements with margins (usually `_content`) should have `u-margin-trim`
- **Text wrapping pattern**: since `_content` is `display: block`, headings and paragraphs that need a `max-width` must be wrapped in a div with `u-heading` or `u-text`. These utilities have `min-width: 100%`, `flex-direction: column`, and `align-items: inherit` — so they stay full width, pass `max-width` to their direct children via `max-width: inherit`, and inherit center alignment from `_content`. The component class, `display: flex`, `max-width`, and `margin-bottom` go on the wrapper. **When centering, add `u-alignment-center` to `_content`** — this utility provides `text-align: center`, `justify-content: center`, and `align-items: center`. Don't write these styles manually. Flex children like `u-button-wrapper` and `u-heading`/`u-text` wrappers use `justify-content: inherit` and `align-items: inherit` to pick up alignment from `_content`:
  ```html
  <div class="hero_content u-alignment-center u-margin-trim">
    <div class="hero_title u-heading u-text-style-h2">
      <h1></h1>
    </div>
    <div class="hero_text u-text u-text-style-small">
      <p></p>
    </div>
  </div>
  ```
  ```css
  .hero_content { width: 100%; }
  .hero_title { display: flex; max-width: 10ch; margin-bottom: var(--_text-style---margin-bottom); }
  .hero_text { display: flex; max-width: 40ch; margin-bottom: var(--_text-style---margin-bottom); }
  ```
  If text doesn't need a `max-width`, it can go directly on the element without a wrapper:
  ```html
  <h1 class="hero_title u-text-style-h1"></h1>
  ```
  ```css
  .hero_title { margin-bottom: var(--_text-style---margin-bottom); }
  ```
- Reduced-opacity text: `color: color-mix(in hsl, currentColor 80%, transparent)` — adjust percentage as needed. Never use the `opacity` property to fade text
### Buttons
 
- No button utility — always style on component class with `data-trigger="hover focus"`
- Buttons must always include padding — default: `padding: var(--_spacing---space--3) var(--_spacing---space--5)`
- Primary:
  ```css
  .hero_button {
    padding: var(--_spacing---space--3) var(--_spacing---space--5);
    background-color: color-mix(in hsl, var(--_theme---button-primary--background) calc(100% * var(--_trigger---on)), var(--_theme---button-primary--background-hover) calc(100% * var(--_trigger---off)));
    color: color-mix(in hsl, var(--_theme---button-primary--text) calc(100% * var(--_trigger---on)), var(--_theme---button-primary--text-hover) calc(100% * var(--_trigger---off)));
    border-color: color-mix(in hsl, var(--_theme---button-primary--border) calc(100% * var(--_trigger---on)), var(--_theme---button-primary--border-hover) calc(100% * var(--_trigger---off)));
    border-width: var(--border-width--main);
    transition: all 300ms;
  }
  ```
- Secondary (outlined): same pattern with `--_theme---button-secondary--*`
### Color & Theming
 
- `u-theme-light` (default), `u-theme-dark`, `u-theme-brand` — apply to sections/cards, all variables update automatically
- **Choosing the right theme class**: `u-theme-light` for light/white backgrounds, `u-theme-dark` for dark/black backgrounds, `u-theme-brand` for colored backgrounds (green, blue, etc.). Nav and section should share the same theme class when they share visual context
- Theme variables: `--_theme---background`, `--_theme---text`, `--_theme---border`, `--_theme---background-2` (lighter shade of the section background — use for pill buttons, tags, badges, nav buttons, or any element needing subtle contrast), `--_theme---background-skeleton`
- Links: `--_theme---text-link--border|text|border-hover|text-hover`
- Buttons: `--_theme---button-primary--background|border|text|*-hover`, `--_theme---button-secondary--*` — **buttons MUST always use these button variables for all colors (background, text, border)**. Never use `--_theme---text`, `--_theme---background`, or the inverted colors technique on buttons. The button variables are already configured per theme to produce the correct visual result
- **Don't set `color` on headings or paragraphs** unless the text color differs from the section's inherited `--_theme---text`
- **Inverted colors for decorative elements only**: when SVGs, icons, badges, or other non-interactive decorative elements use colors without a specific theme variable, invert the section's theme — `--_theme---text` for the element's background/fill, `--_theme---background` for foreground elements on top. **Never apply this to buttons** — buttons always use `--_theme---button-primary--*` or `--_theme---button-secondary--*` regardless of their visual appearance
### Responsive
 
- Never `@media`. Prefer responsive variables; use `@container` only when variables can't express the change
- Every `display`, `flex-direction`, `align-items`, and `position` switch MUST use responsive variables:
  ```css
  /* CORRECT */
  .enterprise_header { display: var(--flex-medium, grid); flex-direction: column; }
  .enterprise_case_header { flex-direction: var(--column-medium, row); align-items: var(--start-medium, center); }
 
  /* WRONG — never use @container for simple keyword switches */
  @container (width < 50em) { .enterprise_header { display: flex; } }
  ```
- Don't mix both — if one part needs `@container`, use it for the whole component
#### Responsive Variables
 
- `--_responsive---large` (~50em+), `--_responsive---medium` (~35–50em), `--_responsive---small` (~20–35em), `--_responsive---xsmall` (~<20em) — one is `1`, rest `0`
- Keywords per breakpoint (medium/small/xsmall): `--flex-*`, `--none-*`, `--column-*`, `--row-*`, `--start-*`, `--center-*`, `--end-*`, `--first-*`, `--last-*`, `--unset-*`, `--relative-*`
- Patterns:
  ```css
  display: var(--flex-medium, grid);
  flex-direction: var(--column-medium, row);
  position: var(--relative-medium, sticky);
  top: calc((var(--nav--height-total) + var(--_spacing---space--2)) * var(--_responsive---large));
  max-height: var(--unset-medium, calc(100svh - var(--nav--height-total) - var(--_spacing---space--2) - var(--_spacing---space--2)));
  grid-template-columns: repeat(calc(var(--_responsive---large) * 4 + var(--_responsive---medium) * 3 + var(--_responsive---small) * 2 + var(--_responsive---xsmall) * 1), minmax(0, 1fr));
  ```
 
#### Container Queries
 
- Target: `u-container` (`container-type: inline-size`). Affects children only
- Breakpoints in `em`: `@container (width < 50em) { .el { } }`
### Trigger & State System
 
Flips CSS variable values on a parent so children react without descendant selectors.
 
- `--_state---true: 1` / `--_state---false: 0` → flip when activated (`.is-active`, `data-state` match)
- `--_trigger---on: 1` / `--_trigger---off: 0` → flip on hover/focus (`data-trigger`)
- **Hidden by default, shown when active** → `var(--_state---false)`
- **Shown by default, hidden when active** → `var(--_state---true)`
- `data-state` listeners: `checked` (`:checked`), `current` (`.w--current`), `open` (`.w--open`), `pressed` (`aria-pressed`), `expanded` (`aria-expanded`), `external` (`target="_blank"`)
- JS-driven interactives (tabs, sliders, accordions): toggle `.is-active`, not `data-state`
- `data-trigger` types: `hover`, `focus`, `preview`, `mobile`, `group`, `hover-other`, `focus-other`
- **Never select `[data-state]`, `[data-trigger]`, or `.is-active` in CSS** — read variable values only:
  ```css
  /* CORRECT */
  .tabs_link_text { opacity: var(--_state---false); }
  .tabs_link_bar { transform: scaleY(calc(var(--_state---false))); transition: transform; }
 
  /* WRONG */
  .tabs_link.is-active .tabs_link_text { opacity: 1; }
  ```
- Don't wrap single variable in `calc()`: `opacity: var(--_state---false)` not `opacity: calc(var(--_state---false))`
- Ordering: `true`/`on` always first, `false`/`off` second in `color-mix()` and `calc()`
- Patterns:
  ```css
  opacity: calc(1 - 0.4 * var(--_trigger---on));
  transform: scale(calc(1 + 0.2 * var(--_trigger---on)));
  transform: rotate(calc(45deg * var(--_trigger---on)));
  transform: translateX(calc(2rem * var(--_trigger---on)));
  ```
 
### Scalable Visual Compositions
 
For graphical/decorative visuals where elements float freely (overlapping cards, badges, images — not aligned on a grid). Scales proportionally like a single image. **Only for graphical elements, not entire sections.**
 
Structure: `_visual_wrap` → `_visual_inner` → absolutely positioned children.
 
```html
<div class="hero_visual_wrap">
  <div class="hero_visual_inner">
    <div class="hero_visual_card"></div>
    <div class="hero_visual_badge"></div>
  </div>
</div>
```
 
```css
.hero_visual_wrap {
  container-type: inline-size;
  width: 100%;
  aspect-ratio: 3 / 2;
  position: relative;
}
 
.hero_visual_inner {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 1cqw;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
 
/* Centered child: no top/left/bottom/right, offset from center with transform */
.hero_visual_card {
  position: absolute;
  transform: translateX(-10em) translateY(-3em);
  width: 30em;
  aspect-ratio: 4 / 2;
}
 
/* Corner-anchored child: anchor to a corner, offset with transform */
.hero_visual_badge {
  position: absolute;
  bottom: 0;
  right: 0;
  transform: translateX(-5em) translateY(-5em);
  width: 20em;
  aspect-ratio: 1 / 1;
}
 
.hero_visual_badge_text {
  font-size: 2em;
}
```
 
Key rules:
- `_visual_wrap`: `container-type: inline-size`, `position: relative`, `width: 100%`, `aspect-ratio` to define the canvas. Can use `max-width` if needed
- **The bounding box must tightly hug the content.** The `aspect-ratio` and any `max-width` on `_visual_wrap` should be sized so elements reach or nearly reach all edges — no large empty margins inside the composition. If elements only occupy the center, the aspect ratio is too tall/wide. Adjust `aspect-ratio`, element positions, and sizes until the outermost elements are close to the edges of the `_visual_wrap`. Think of the bounding box as shrink-wrapped around the content
- `_visual_inner`: `display: flex; justify-content: center; align-items: center` and `font-size: 1cqw` — the only place `cqw` appears. Everything else uses `em`
- Children use `position: absolute` positioned one of two ways:
  - **Centered** (default): omit `top`/`left`/`bottom`/`right` — centers via flex. Offset with `transform` in `em`
  - **Corner-anchored**: set one corner pair (`top: 0; left: 0`, `top: 0; right: 0`, `bottom: 0; left: 0`, or `bottom: 0; right: 0`), offset with `transform` in `em`
- **Never use percentage values** (`top: 50%`, `left: 30%`) — offsets are exclusively `transform` in `em`
- **Only wrap elements that have both a custom `font-size` AND need a `transform`** — because `em` in transforms resolves against the element's own `font-size`, not the parent's `1cqw`. Most children (images, cards, shapes) can have `position`, `transform`, and `width` directly — no extra wrapper needed. The wrapper is only for text elements where you set a `font-size` like `3em` and also need positional offset:
  ```css
  /* Needs a wrapper — has font-size AND transform */
  .hero_visual_heading_wrap { position: absolute; top: 0; left: 0; transform: translateX(5em) translateY(2em); }
  .hero_visual_heading { font-size: 3em; }
 
  /* No wrapper needed — no custom font-size */
  .hero_visual_card { position: absolute; transform: translateX(5em) translateY(2em); width: 30em; }
  ```
- Sizes (`width`, `aspect-ratio`), font sizes, and `border-radius` on children are in `em` — not `--radius--*` variables, which don't scale with the composition
- **No container queries by default** — because everything is in `em` relative to `1cqw`, the entire composition scales down proportionally as the container shrinks. Don't add `@container` rules to resize, reposition, or hide children at smaller sizes unless the user specifically asks for a different responsive behavior
## Centering
 
Never use `top: 50%; left: 50%; transform: translate(-50%, -50%)`. Instead, use flex on the parent and `position: absolute` on the child with no `top`/`left`/`bottom`/`right`:
```css
.parent { display: flex; justify-content: center; align-items: center; }
.child { position: absolute; }
```
This applies everywhere, not just visual compositions.
 
## Example
 
```html
<section class="hero_wrap u-section">
  <style>
    .hero_layout {
      display: var(--flex-medium, grid);
      flex-direction: column;
      grid-template-columns: repeat(12, minmax(0, 1fr));
    }
    .hero_title { margin-bottom: var(--_text-style---margin-bottom); }
    .hero_text { margin-bottom: var(--_text-style---margin-bottom); }
  </style>
  <div class="hero_contain u-container">
    <div class="hero_layout">
      <div class="hero_content u-margin-trim">
        <h1 class="hero_title u-text-style-h1"></h1>
        <p class="hero_text u-text-style-main"></p>
      </div>
      <div class="hero_visual"></div>
    </div>
  </div>
</section>
```
 
## Anti-patterns
 
- `px` anywhere, `vw` for fonts
- `@media` queries
- `:hover`, `:focus`, or any interactive pseudo-class in CSS — use `data-trigger` and `--_trigger---on`/`--_trigger---off`
- `.is-active`, `[data-state]`, `[data-trigger]` in CSS selectors
- `@container` for simple display/direction/position switches (use responsive variables)
- `@keyframes` with state/trigger selectors
- Fallback values in `var()` (except responsive keywords)
- `false`/`off` before `true`/`on` in expressions
- Unscoped combo classes
- Grid columns with bare `1fr` — always `minmax(0, 1fr)`
- `display: grid` or layout on `u-container` — use a child `_layout` div
- Hex color codes (`#ff0000`, `#333`) anywhere — CSS, comments, or prose. Never reference hex values
- Hardcoded colors (`white`, `black`, etc.) or border widths — always use `--_theme---*` variables
- `color` on headings/paragraphs that matches the section's inherited `--_theme---text` — redundant
- Hardcoded button colors — use `--_theme---button-primary--*` or `--_theme---button-secondary--*`
- `opacity` property to fade text — use `color-mix(in hsl, currentColor [%], transparent)`
- `innerHTML`, `createElement`, or template literal HTML in JS — use the `_hidden` clone pattern
- `getElementById`, `id` attributes, or JS targeting by `id`
- Combo classes in CSS but not in the HTML — Webflow purges them; put them in a `_hidden u-display-none` div
- Text elements missing `margin-bottom: var(--_text-style---margin-bottom)`
- Text parent missing `u-margin-trim`
- Empty divs without `padding: 0`
- Buttons without padding
- `<style>` not first child or `<script>` not last child inside `_wrap`
- Percentage values on `top`/`left`/`bottom`/`right` for positioning — use corner anchors with `0` and `transform` in `em`
- `top: 50%; left: 50%; transform: translate(-50%, -50%)` — use flex centering on parent
- `transform` with `em` on an element with its own `font-size` in visual compositions — wrap in a positioning div