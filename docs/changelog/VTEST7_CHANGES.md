# vtest7: the real resume

Changed files: `public/Michael_Shepherd_Resume.pdf` (new), `src/content.ts`, `src/ui.ts`, `src/style.css`.

## What changed
- The Resume panel no longer shows a short placeholder summary. It now carries the full resume (education, technical skills, experience, projects, certificates), worded exactly as in the supplied PDF.
- **OPEN THE PDF** opens the official PDF (`public/Michael_Shepherd_Resume.pdf`) in a new tab. "Print this page" stays as a secondary action; the print stylesheet still prints only the resume sheet.
- The resume text lives in `content.ts` (`resume`), so it is edited in one place.
- Degree line updated to match the resume: "B.S. in Applied Data Science", "Anticipated graduation May 2027" (also shown on the About panel).

## Notes
- The phone number on the PDF is deliberately **not** shown in the in-site text. The PDF itself is public once deployed, so it does include it.
- The resume gives the NBA All-Star Prediction accuracy as about 0.949. The project's README does not state this, so the All-Star book does not show it yet.

## Verification
Type-checked with the stub-typed `tsc` (exit 0). Rendered at 1500×850 and 390×844 with no horizontal overflow. The real Vite build, the Vercel deploy and printing to paper/PDF were not tested.
