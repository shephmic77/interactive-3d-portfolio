# vtest5: the open book for Projects

Changed files: `src/book.ts` (new), `src/content.ts`, `src/ui.ts`, `src/style.css`.

## What is new
Opening the Projects section (nav button, the book cart, or the book list in the side panel) now opens **a book in the centre of the screen**. The side panel stays, so the list, search and filters work exactly as before.

| Part | What it does |
|---|---|
| Title spread | An "Ex Libris" bookplate on the left and a clickable table of contents on the right. |
| One spread per project (11) | **Left page:** title, one-line summary, a plate (small chart or diagram), headline numbers and tools. **Right page:** the question, the data, how it works, what came out, "worth knowing" (honest limits) and a GitHub button. |
| Page turns | A leaf turns over the spine on wide screens (any jump, such as a contents entry, turns one leaf). On phones the two pages stack in one scrolling column and cross-fade. Reduced-motion users get an instant swap. |
| Navigation | Prev / Next, a dot for each volume, a GitHub button that is always visible, and the left/right arrow keys, Home and End. "Hide book" tucks it away (an "Open the book" pill brings it back); below 1100 px it reads "Show list". |
| Look | Leather cover tinted by each project's colour, cream paper, ribbon bookmark, serif type (Newsreader) with the site's mono labels. |

## Content rules
Every sentence and number comes from the project's public README on GitHub (read this session) or from `content.ts` before this change. Nothing is invented. Examples: Online Purchase Prediction test metrics, Moneyball RMSE and R², the DS 310 MSE values, the Houston hazard demo counts, the macropad key layout. Charts only plot those real numbers; projects with no numbers get a step diagram instead.

Corrections made while reading the READMEs:
- **Online Purchase Prediction** was listed with Python; the repo is an R project. Tools now read R.
- **NBA All-Star Prediction**: the README states no accuracy figure, so none is shown (an earlier note of about 0.949 is not in the README).

## Accessibility
- Region labelled "Project book"; a polite live region announces "Volume 3 of 11: NBA Moneyball".
- Charts are real lists, tables and text; the coloured bars are decoration. Colour is never the only carrier (values are printed).
- Page-turn leaf is `inert` and hidden from assistive tech; page text is never duplicated for screen readers.
- Scrollable pages get a tab stop only when they actually overflow.
- On screens up to 1100 px the book covers the side panel, which is made `inert` while hidden so Tab cannot reach it.
- All GitHub links open in a new tab with `rel="noopener noreferrer"`.

## Checks
- Stub-typed `tsc` clean on `src/` (the new code uses only DOM and our own types; the real build is `npm run build` on Vercel).
- Real-Three.js, software-GL renders of the full site at 1920x945, 1500x850, 900x1000 and 390x844: contents, all chart types, a mid-turn leaf, hide/show, jump from the side-panel list, arrow keys, Home, Escape, link targets. No console errors.
- Not done: a real Vite build, a GPU-speed look at the page-turn timing, a phone test, a screen-reader pass.

## Known limits
- On short laptop screens (about 850 px tall) the type shrinks to fit; a few pages may still scroll a little, and the GitHub button in the bar is always reachable.
- Fonts load from Google Fonts; offline it falls back to Georgia.
- The 3D book on the cart still opens the same book; the books on the cart are not themselves animated open.
