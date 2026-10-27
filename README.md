# גליון הערכה – Yeshiva Yagdil Torah

Monthly evaluations, scanned assessment sheets and Hebrew report cards.

- **GitHub:** this repo. `public/index.html` is the whole app; `src/` holds its pieces (`python3 src/build.py` rebuilds it).
- **Netlify:** publishes `public/` (no build step). `public/config.js` holds the Supabase address and publishable key (safe to be public; the database rules control access).
- **Supabase:** project **YYT Gilyon Haarachah** (YYT organization, Free plan). Sign-in with Supabase Auth; data in `gilyon_state`, users in `gilyon_users`, letterhead in `gilyon_assets`, AI key in `gilyon_secrets`, audit log in `gilyon_audit`. Setup SQL: `supabase/gilyon-schema.sql`.

## Users

Admins add people in **Settings → Users** (email, role, password). Admin = full access; View = Dashboard, Scores (read only) and Reports. Access is controlled by `gilyon_users`.

## Opening the file directly

If `public/index.html` is opened from a computer (no `config.js`), it runs as a test version with sample data, no password, saved only in that browser.
