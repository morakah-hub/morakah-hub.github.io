# morakah-hub.github.io

Source for my portfolio at **https://morakah-hub.github.io**.

Plain HTML, CSS and JavaScript with no build step. GitHub Pages serves the `main` branch as-is.

| File | What it is |
| --- | --- |
| `index.html` | All page content: projects, AWRAS build log, about, contact |
| `styles.css` | Layout, colors and type |
| `main.js` | Hero robot-arm animation, scroll effects, project rail buttons |
| `assets/img/` | Project photos, resized from each project's repo |

## The hero animation

Two robot arms on a loop: arm A picks a little robot's base, body and head from the tray and stacks them, and arm B screws each part down. When the robot is complete, its eyes light up, it drives off, new parts drop into the tray, and the cycle starts again. The arms are moved with two-link inverse kinematics along eased paths. With reduced motion turned on, it shows one still frame instead.

## Scroll effects

A progress line under the nav, the hero text and scene drifting as you scroll away, and sections that rise in as they reach the screen, with photos wiping in from the top.

## Updating

- **Add or edit a project:** copy one `<article class="project">` block in `index.html`, change the text and links, and add a 960 × 600 image to `assets/img/`.
- **Preview locally:** run `python -m http.server` in this folder and open http://localhost:8000.
