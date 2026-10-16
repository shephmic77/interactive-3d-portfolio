# vtest7: the real resume, as a one-page sheet

Changed files: `public/Michael_Shepherd_Resume.pdf` (new), `src/content.ts`, `src/ui.ts`, `src/style.css`.

## What changed
- The Resume panel shows the resume as **one letter-size sheet laid out like the PDF**: same serif face, name and contact line, ruled section headings (thick rule, then a thin one under the title), row layout with right-aligned places and dates, square bullets with hanging indents, same order and wording. Measured against the PDF the lines wrap identically and sit within about one point.
- The sheet scales with its container (1 unit = 1 pt of a 612 × 792 page), so it stays one page at any width. On desktop the panel widens for this section only (up to 800 px). On phones it fits the screen width; pinch to zoom, or use the PDF button.
- **OPEN THE PDF** opens `public/Michael_Shepherd_Resume.pdf` in a new tab. **PRINT THIS PAGE** prints the sheet on one letter page (checked: 1 page).
- The resume text lives in `content.ts` (`resume`), so it is edited in one place. It is real HTML text, not an image, so it can be selected, searched and read by screen readers.
- Degree line updated to match the resume: "B.S. in Applied Data Science", "Anticipated graduation May 2027" (also shown on the About panel).
- The phone number is shown exactly as on the PDF. To hide it from the page text, delete the `phone` field in `content.ts` and its use in `ui.ts`; the PDF itself is public once deployed.

## Notes
- The resume gives the NBA All-Star Prediction accuracy as about 0.949. That project's README does not state it, so the All-Star book does not show it yet.
- Font: Liberation Serif / Times New Roman (what the PDF uses), with Tinos loaded as a match for devices that have neither.

## Verification
Type-checked with the stub-typed `tsc` (exit 0). Overlaid on the PDF in a software-rendered browser; printed to PDF through Chromium (1 page, letter). Phone width checked at 390 px (no horizontal overflow). Not tested: the real Vite build, the Vercel deploy, a real printer, Safari/Firefox, screen readers. Text on a 390 px phone is about 5.6 px until zoomed.
