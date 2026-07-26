# Anikin Technologies — SEO Progress Portal

A lightweight, client-facing portal that shows each client the SEO work you've done, what's in progress, and what's coming next. Staff get a portfolio overview of every client.

- **No build step, no server, no database.** Plain HTML/CSS/JS + JSON files.
- **Hosted free on GitHub Pages.**
- **You update a JSON file and `git push` — the client's board updates automatically.**

---

## How access works

There are **no passwords**. Each client has a private link based on their slug:

- Staff dashboard (all clients): `https://<your-pages-url>/`
- A client's board: `https://<your-pages-url>/#/drainrooter`

Only share a client's link with that client. They only ever see their own board (the link is their key). Don't publicize the staff dashboard URL.

> The `data/clients.json` index powers the staff dashboard. If you want a client's link to work but NOT show them in the staff list of a shared screen, that's fine — the client link works regardless. But note: because this is a public static site, a determined person could guess other slugs. Use non-obvious slugs (e.g. `drainrooter-x7k2`) if you want stronger privacy.

---

## Adding a new client (2 steps)

### 1. Create the client data file

Copy `data/clients/_TEMPLATE.json` to `data/clients/<slug>.json` (e.g. `data/clients/kirpa.json`).
Fill in the fields. The slug must be lowercase letters, numbers, and hyphens only.

### 2. Add them to the index

Add one line to `data/clients.json` so they appear on the staff dashboard:

```json
{ "slug": "kirpa", "name": "Kirpa Home Inspection", "industry": "Home Inspection", "location": "Brampton, ON" }
```

Then `git add . && git commit -m "Add Kirpa" && git push`. Their link is now live at `/#/kirpa`.

---

## Updating a task (the everyday workflow)

Open `data/clients/<slug>.json`, find the task, and change its `status`:

| status         | Where it shows on the board |
|----------------|-----------------------------|
| `"done"`       | **Done** column (add a `completedDate`) |
| `"in-progress"`| **In Progress** column |
| `"upcoming"`   | **Up Next** column |

When you finish a task:
1. Change `"status": "upcoming"` (or `"in-progress"`) → `"status": "done"`
2. Set `"completedDate": "2026-07-26"` (YYYY-MM-DD)
3. Optionally add a line to `updates` so the client sees a note
4. `git commit -m "DrainRooter: schema markup done" && git push`

The progress % at the top recalculates automatically (done tasks ÷ total tasks).

---

## Data file reference

See `data/clients/_TEMPLATE.json` for the full shape. Key sections:

- **phases** — the roadmap timeline chips. `status`: `done` / `in-progress` / `upcoming`.
- **tasks** — the Kanban cards. Each has a `status`, a `phase`, and an `hours` number.
- **keywords** — ranking snapshot table. `current` = today's position, `previous` = last check, `target` = goal. Lower number = better. The board auto-computes ▲/▼ movement.
- **updates** — a dated activity feed shown to the client.

All fields are optional except `slug`, `name`, and `tasks` — empty sections are hidden automatically.

## Hours tracking

Give each task an `"hours"` number (e.g. `"hours": 4.5`). The board:
- Shows an hours badge on each task card.
- Sums hours from **completed** tasks into the **"X hrs delivered"** tile at the top.
- Shows total hours delivered on each staff dashboard card.

Only `done` tasks count toward delivered hours — so hours grow as you complete work, matching the progress %.

## Client requests

Clients submit requests on their own board via the **Your Requests** form. Each request tracks the date it was asked, its status (New / In Progress / Done), the completed date, and the **turnaround** ("Completed in 3 days") — all computed automatically.

This feature uses Firebase (free). It requires a one-time setup — see `../FIREBASE-SETUP.md`. Until it's configured, the rest of the portal works and the form shows a "not set up yet" note. You change a request's status from the Firebase console; the board updates instantly.

---

## Deploying to GitHub Pages

See `../PORTAL-DEPLOY.md` in the repo root for the one-time GitHub setup.

## Running locally

From the `portal/` folder:

```
python -m http.server 8000
```

Then open `http://localhost:8000`. (You need a server — opening `index.html` directly won't work because the browser blocks `fetch` on `file://`.)
