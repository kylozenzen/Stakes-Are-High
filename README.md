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
