# גליון הערכה – Yeshiva Yagdil Torah

Monthly evaluations, scanned assessment sheets and Hebrew report cards.

- `public/index.html` – the app (what Netlify serves)
- `src/` – source pieces; run `python3 src/build.py` to rebuild `public/index.html`
  - `p1_head.html` styles · `p2_body.html` layout · `p3_core.js` data, audit log, undo/redo
  - `p4_views.js` dashboard, students, scores · `p5_assess.js` assessments, printing/PDF, Claude scanning
  - `p6_reports.js` reports & report setup · `p7_settings.js` settings, audit log page, sample data, start-up
  - `font.txt` BA Tzlotana (report font) · `logo.txt`, `lh.txt`, `fav.txt` images

Current version is the **test version**: no password (`TEST_MODE` in `p3_core.js`), data is saved in each browser, and the Claude API key is saved in the browser. Supabase is not connected yet.
