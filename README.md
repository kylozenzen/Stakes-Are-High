# High Stakes Truth — 3D Project

## Files

- `index.html` — page structure and UI
- `styles.css` — all visual styling and responsive layout
- `facts.js` — editable truth/lie content and explanations
- `three-table.js` — Three.js table, cards, chips, dealer hands, camera, and animations
- `app.js` — game state, scoring, modes, shop, stats, and UI behavior

## Run it

The game loads Three.js from a CDN, so it needs an internet connection.

For reliable local testing, run a local server inside this folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

You can also drag the whole folder into Netlify.

## Edit the fact bank

Open `facts.js`. Every entry follows this format:

```js
{
  text: "The claim shown to the player.",
  answer: true,
  explanation: "The explanation shown after the reveal.",
  category: "Science",
  difficulty: 2
}
```

Difficulty:

- `1` — Common, 1× base payout
- `2` — Tricky, 1.25× base payout
- `3` — Deep Cut, 1.5× base payout


## Fixed Three.js loading

This build uses the supported ES-module file through an import map:

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.167.1/build/three.module.js"
  }
}
</script>
```

The earlier `build/three.min.js` URL returns 404 for this release and should not be restored.


## Clarity pass changes

This revision fixes the issues visible in the gameplay screenshots:

- The card is now built with a thin horizontal base and separate top/bottom texture planes. The claim and reveal are no longer mapped onto the card edge.
- The camera sits farther back and the table automatically scales on narrow screens.
- Lighting, felt, answer zones, and chip stacks are brighter and easier to distinguish.
- Wager chips are arranged into clean stacks instead of overlapping in a loose pile.
- Controls are shorter and include additional height-based responsive rules.
- The claim and explanation panels have stronger contrast and bounded heights.
- The countdown uses one continuous camera push across `3 → 2 → 1 → REVEAL`.
- Each countdown marker has only a subtle scale-in rather than a full-screen zoom punch.
- Buttons are locked during transitions to prevent double-tap animation glitches.


## Recommended dealer upgrade

This pass consolidates the 3D presentation into one clear game flow:

- The clue appears only in the readable top panel.
- The table card uses a decorative High Stakes Truth back instead of repeating the clue.
- One connected, stylized dealer sits across the table.
- Wager selections physically move the matching number of chips from the player's bank into the pot.
- The dealer watches the selected True/False zone during the countdown.
- The countdown remains 3 → 2 → 1 → REVEAL, but uses a gentle HTML scale/fade rather than repeated camera punches.
- The dealer lifts and flips the verdict card toward the player.
- The explanation replaces the clue in the top panel after the reveal.
- On a win, chips return to the player. On a loss, the dealer sweeps them away.


## Dealer visibility pass

This pass specifically improves dealer readability and staging:

- brightened the environment behind the dealer with a back wall, halo, and rim light
- zoomed the camera out to show more of the full table/dealer composition
- lowered and pushed the dealer farther back so the top clue panel does not cover as much of them
- softened the vignette
- slightly reduced the height of the top clue panel
- fixed the flipped verdict card so the TRUE/FALSE reveal is no longer upside down
