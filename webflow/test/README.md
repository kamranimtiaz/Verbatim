# webflow script tests

Node + jsdom. Not shipped to Webflow — local verification only.

```bash
npm install jsdom
node test-opener-compat.cjs  # data-video-id + legacy data-videopop-id
```

`test-opener-compat.cjs` guards the `data-video-id` rename: openers may use the
new generic name or the legacy `data-videopop-id`, new wins when both are set,
and the popup's own player keeps `data-videopop-id` as internal state.

> Files use `.cjs` because the project's root `package.json` sets
> `"type": "module"`.

## Retired

`test-cardmode.cjs` and `test-hidden.cjs` moved to [`webflow/archive/`](../archive/)
along with `cardmode.js` itself. They tested a script that no longer ships:
mode arbitration now lives in `videopopup.js`, which derives it from the
`POPUP_CARD` selector (`.card_player:not([data-videoinline-player])`) rather
than from the presence of a `<video>` child.

The behaviour they covered is now untested. If mode detection is worth a
harness again, retarget it at `videopopup.js`:

- an inline card (`data-videoinline-player` present) is not claimed as an opener
- a popup card (attribute absent) binds its WATCH button
- a popup card with no `data-video-id` adds no opener and warns
- `hydrateCard()` sets poster src and lazily loads preview on first hover only

> The old jsdom caveat still applies: jsdom reports `readyState === 'loading'`
> at eval time and never fires `DOMContentLoaded` under
> `runScripts: 'outside-only'`, so a harness must wait for load before
> evaluating the script, or everything silently no-ops.
