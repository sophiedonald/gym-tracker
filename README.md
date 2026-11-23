# Gym Tracker

Mobile-first PWA (Next.js App Router, TypeScript, Tailwind) for fast gym set logging. Workouts stay in `localStorage` while you train, then post in one batch to two linked Notion databases.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000. On a phone, use "Add to Home Screen" to install it.

## Notion setup

1. Create an integration at https://www.notion.so/profile/integrations and copy its secret.
2. Create two databases:
   - **Workouts**: `Name` (title), `Date` (date), `Total Volume` (number), `Notes` (text), plus a relation to Sets if you want a reverse link.
   - **Sets**: `Exercise` (title), `Set` (number), `Weight` (number), `Reps` (number), `Est 1RM` (number), `Date` (date), `Workout` (relation → Workouts database).
3. On **each** database: `⋯` → **Connections** → add your integration.
4. Copy each database ID (the 32-character part of the database URL before `?v=`).

`.env.local`:

```
NOTION_API_KEY=secret_...
NOTION_WORKOUTS_DB_ID=...
NOTION_SETS_DB_ID=...
```

Property names must match exactly. Sets are written sequentially with a short delay to respect Notion rate limits; if any set fails, the new workout page is archived so a retry doesn't duplicate data.

## Google Calendar setup (Plan Week + today's auto-fill)

1. In Google Cloud Console, create a project and enable the **Google Calendar API**.
2. Create a **service account**, then add a JSON key (Keys → Add key).
3. In Google Calendar, open the **Activities** calendar → Settings and sharing → *Share with specific people* → add the service account email with **Make changes to events**.
4. In the same settings page, copy the **Calendar ID** (under *Integrate calendar*).
5. Add to `.env.local`:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=name@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=...@group.calendar.google.com
```

Use the `private_key` value from the JSON key as one line with literal `\n` escapes (they are converted to newlines at runtime). Events use the `Europe/London` timezone.

## Using the app

- **Plan Week (`/plan`)**: browse previous and future weeks with the arrows. Each day shows the events already in the Activities calendar. Days before today are read-only (no activity, time or location edits, and the server rejects creating events for them). For future days, pick activities, adjust time/duration/location, then *Create Week in Google Calendar*. Defaults (06:00, 90 min, David Lloyd Manchester Trafford) are editable via the settings button and saved in `localStorage`. Events carry a hidden plan key, so re-running skips events that already exist. *Copy Last Week's Plan* reuses last week's saved plan.
- **Log Workout (`/`)**: choose the workout date, enter sets live or at the end of the session. Any set with reps and a weight (or ticked as done) is saved. Today's calendar events fill in the title, offer *Load Planned Exercises* / *Repeat Last Uppers/Legs Session* for gym days, and show a quick-log (duration, distance, notes) for Swim/Run/Stretch/Wattbike. Duration/distance are appended to the Notion workout `Notes`. Drafts persist in `localStorage`; after saving, use *Clear / Start Fresh*.

## Deploy to Vercel

1. Push the repo and import it in Vercel.
2. Add the Notion and Google environment variables above under Project Settings → Environment Variables (paste `GOOGLE_PRIVATE_KEY` with its `\n` escapes).
3. Deploy. Large workouts take a few seconds to save (≈0.35 s per set).

## Notes

- Custom exercises, last-used weight/reps per exercise, and the in-progress workout live in `localStorage` and survive reloads; the workout is cleared only after a successful save.
- Starter exercises: `src/data/exercises.json`.
