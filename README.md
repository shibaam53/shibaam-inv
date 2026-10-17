# Shibaam

Inventory management for a wire-mesh / industrial products business (private app), with a public website to be built last.
Read **AGENTS.md** (rules for AI agents and contributors) and **PROJECT.md** (product context) first.

Stack: React + Vite + TypeScript, Tailwind CSS v4, shadcn/ui, Supabase (Postgres, Auth, RLS, RPC, Edge Functions), Vercel.

---

## 1. First-time setup

Prerequisites: Node.js LTS, Git, a Supabase account. **Docker is not required.**

```bash
npm install
cp .env.example .env.local        # then fill in your URL + publishable key (never the secret key)
```

### Create the Supabase project (dashboard)
1. New project (e.g. `shibaam`). Save the database password in a password manager.
2. Authentication → Sign In / Providers → turn **off** "Allow new users to sign up".
3. Settings → API Keys → copy the **Project URL** and the **publishable** key (`sb_publishable_…`) into `.env.local`.
   The **secret** key (`sb_secret_…`) is used only for the Edge Function secret below.

### Link the CLI and push the database (no Docker)
```bash
npx supabase init                  # creates supabase/config.toml (keep the existing migrations/tests folders)
npx supabase login                 # opens the browser
npx supabase link --project-ref YOUR_PROJECT_REF     # ref = the part of the URL before .supabase.co; asks for the DB password
npx supabase migration list        # shows local vs remote migrations
npx supabase db push --dry-run     # preview what will run
npx supabase db push               # apply all migrations in order
```

### Create the first Super User
1. Dashboard → Authentication → Users → **Add user** (email + password, tick *Auto Confirm User*).
2. Edit `docs/bootstrap-super-user.sql` with that email and run it in the **SQL Editor** (one time).

### Generate typed DB types, run the app
```bash
npm run gen:types                  # overwrites src/types/database.ts from your real schema
npm run dev
```

### Deploy the Edge Function (lets the Super User create staff logins)
```bash
npx supabase secrets set ADMIN_SECRET_KEY=sb_secret_xxxxxxxx
# optional, recommended once the app has a URL:
npx supabase secrets set ALLOWED_ORIGIN=https://your-app.vercel.app
npx supabase functions deploy admin-create-user --no-verify-jwt
# if the CLI asks for Docker, add:  --use-api
```
The function verifies the caller itself (active Super User only), which is why `--no-verify-jwt` is used.

---

## 2. Changing the database from the CLI (the everyday workflow)

The database schema lives **only** in `supabase/migrations/`. Never change it in the dashboard.

```bash
npx supabase migration new add_something          # creates supabase/migrations/<timestamp>_add_something.sql
# edit that new file (add tables/columns/functions, plus RLS + grants - see migration 3)
npx supabase db push --dry-run                    # preview
npx supabase db push                              # apply to the linked project
npm run gen:types                                 # refresh TypeScript types
```

Rules:
- **Never edit a migration that has already been pushed.** To fix or undo something, write a **new** migration.
- Every new table/view/function: enable RLS, revoke default privileges, grant narrowly, add a pgTAP test.
- If someone changed the schema in the dashboard: `npx supabase db pull` captures it as a migration.
- If `migration list` shows a mismatch: `npx supabase migration repair --status applied|reverted <version>`.
- Commit migrations to Git; they are the source of truth and recreate the database anywhere.

### Tests
- **Database (pgTAP, 76 checks):** `npx supabase test db --linked` runs them against your linked project, or `npx supabase start` + `npx supabase test db` against a local copy. The CLI runs pg_prove in a container, so this route **needs Docker**.
- **Without Docker:** open `supabase/tests/database/01_security_and_stock.test.sql` in the SQL Editor of your **dev** project and run it. The SQL Editor shows only the last result: **"No rows returned" = every test passed**; any row means a failure. The file ends in `rollback`, so it leaves no data behind. Enable the extension first: Dashboard → Database → Extensions → `pgtap`.
- **App:** `npm run typecheck && npm run lint && npm test`.

---

## 3. One database now, production later

You are starting with a single Supabase project. Two safe ways to go live:

**A. Use the same project (simplest).**
1. Finish testing.
2. In the SQL Editor run `docs/reset-test-data.sql` once. It wipes all stock history and sets balances to 0 but keeps users, products, UOMs and settings. **Destructive: never run it once real data exists.**
3. Enter real opening stock with `set_opening_stock()`.

**B. A separate production project (recommended once real data matters).**
1. Create `shibaam-prod`, then `npx supabase link --project-ref PROD_REF` and `npx supabase db push` (same migrations = same schema).
2. Create the production Super User, set the Vercel env vars to the prod URL/key, deploy the Edge Function to prod.
3. Copy only the reference data you want (products, UOMs, rules) and enter opening stock fresh. Don't copy test ledger rows.
Keep dev and prod separate from then on; test migrations on dev first.

Before go-live either way: confirm your Supabase plan's backup/retention and **test a restore**.

---

## 4. Deploy the app (Vercel)
1. Import the Git repo. Framework preset: Vite. Build `npm run build`, output `dist`.
2. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (never the secret key).
3. `vercel.json` already contains the SPA rewrite and security headers. After deploying, hard-refresh a deep link such as `/app/inventory`.

---

## 5. What exists / what is next
Built: database (tables, RLS, immutable ledger, stock RPCs, bill status, perforation specs with pitch + derived open area, conversion rules inactive by default), pgTAP tests, Edge Function, login, role guards, app shell, dashboard and inventory list.
Next (see PROJECT.md §12): stock in/out screens, product/UOM/user admin, reports. **Do not activate conversion factors, SWG data or open-area formulas until verified** (PROJECT.md §6).
