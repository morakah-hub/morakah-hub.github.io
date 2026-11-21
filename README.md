# morakah-hub.github.io

Source for my portfolio at **https://morakah-hub.github.io**.

Plain HTML, CSS and JavaScript with no build step. GitHub Pages serves the `main` branch as-is.

| File | What it is |
| --- | --- |
| `index.html` | All page content: projects, AWRAS build log, about, contact |
| `styles.css` | Layout, colors and type |
| `main.js` | Space background, hero landscape and wing, underground scene, scroll effects, project rail |
| `assets/img/` | Project photos, resized from each project's repo |

## The scenes

The page is a trip downward, all in pixel art.

- **Hero:** a dusk landscape seen from a moving train. Each layer (clouds, mountain ridges, hills, trees, the path, the foreground grass) moves at its own speed, and its contents are generated as they scroll in, with random shapes, sizes, colors and spacing, so it never repeats. A robot runs along the path. Above the clouds, the wing sits in potential flow past a Joukowski airfoil (a circle mapped by z = ζ + 1/ζ, with circulation from the Kutta condition), and brighter streaks are faster air.
- **Underground:** a block cut-away with dirt, stone and deepslate, ores that get rarer with depth, fossils, a lava pocket, torches, and a pixel robot arm drilling ore in a cave. The bottom crumbles into space.
- **Space:** behind the rest of the page. Stars in white, blue, purple and pink (rarely red, yellow or orange), plus pixel galaxies, edge-on disks, planets, nebulas and the odd black hole. Scrolling flies forward or back through it.

The pixel scenes are drawn into small canvases and scaled up with `image-rendering: pixelated`. With reduced motion turned on, each scene shows a still frame.

## Scroll effects

A progress line under the nav, the hero text and wing drifting as you scroll away, and sections that rise in as they reach the screen.

When you change `styles.css` or `main.js`, bump the `?v=` number on their links in `index.html` so browsers load the new file instead of a cached one.

## Updating

- **Add or edit a project:** copy one `<article class="project">` block in `index.html`, change the text and links, and add a 960 × 600 image to `assets/img/`.
- **Preview locally:** run `python -m http.server` in this folder and open http://localhost:8000.
