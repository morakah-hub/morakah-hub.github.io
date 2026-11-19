# morakah-hub.github.io

Source for my portfolio at **https://morakah-hub.github.io**.

Plain HTML, CSS and JavaScript with no build step. GitHub Pages serves the `main` branch as-is.

| File | What it is |
| --- | --- |
| `index.html` | All page content: projects, AWRAS build log, about, contact |
| `styles.css` | Layout, colors and type |
| `main.js` | Hero airflow animation, project rail buttons |
| `assets/img/` | Project photos, resized from each project's repo |

## The hero animation

The streamlines are potential flow past a Joukowski airfoil at a 6° angle of attack (the angle where my MH60 XFOIL study found peak L/D for AWRAS). A circle is mapped to an airfoil with z = ζ + 1/ζ, the circulation is set by the Kutta condition, and particles are moved through the exact velocity field. Brighter lines are faster flow, so the suction side over the top of the wing stands out. With reduced motion turned on, it draws still streamlines instead.

## Updating

- **Add or edit a project:** copy one `<article class="project">` block in `index.html`, change the text and links, and add a 960 × 600 image to `assets/img/`.
- **Preview locally:** run `python -m http.server` in this folder and open http://localhost:8000.
