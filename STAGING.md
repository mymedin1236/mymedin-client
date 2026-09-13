# Staging environment — frontend

A staging copy of the app, deployed from the `staging` branch to its own Vercel
project, talking to its own backend and its own database. Nothing it does can
reach production data or production analytics.

| | Production | Staging |
|---|---|---|
| Branch | `main` | `staging` |
| Vercel project | `mymedin-client` | `mymedin-client-staging` |
| API | `https://mymedin-server.onrender.com/api` | `https://mymedin-server-staging.onrender.com/api` |
| Analytics | live Mixpanel project | none |
| Indexed by Google | yes | no (`robots.txt` disallows all) |
| Installed PWA name | MyMedin | MyMedin (Staging) |
| Visible marker | none | red `STAGING` badge, bottom-left |

## How the wiring works

`src/config/env.js` is the single source of truth. `VITE_APP_ENV` selects one of
a fixed set of environments; it never supplies a URL:

```js
const API_BY_ENV = {
  production: "https://mymedin-server.onrender.com/api",
  staging:    "https://mymedin-server-staging.onrender.com/api",
};
```

That preserves the original security property — a stray or hostile build-time
env value cannot repoint a deployed app at an arbitrary host, because the only
reachable API origins are the ones in this file, and the CSP in `vercel.json`
independently enforces the same list. An unrecognised value falls back to
production rather than to something unexpected, so a typo cannot silently
produce an app pointing nowhere.

Build it locally exactly as staging deploys it:

```sh
npm run build:staging   # = vite build --mode staging, reads .env.staging
```

## Creating the Vercel project (one time)

Do this in the Vercel dashboard, not the CLI: connecting a Git repo, choosing a
production branch and setting deployment protection are all dashboard-only
settings, and the CLI cannot configure them.

**1. Create the project.** Add New > Project > Import Git Repository >
`mymedin1236/mymedin-client`. Vercel allows the same repo in several projects,
which is what we want. Name it `mymedin-client-staging`.

**2. Settings > Git > Production Branch: `staging`.** This is the important one.
It makes a push to `staging` a *production* deploy of the staging project, which
gives a stable URL. Left on `main`, staging would only ever produce per-commit
preview URLs — no good for a CORS allowlist, a PWA install, or sharing.

**3. Settings > Build & Development > Build Command: `npm run build:staging`.**
With that, staging needs **no environment variables at all**: `.env.staging` in
the repo supplies them, so the deploy is reproducible from the repo alone.
(Leaving the default `npm run build` and setting `VITE_APP_ENV=staging` in
Vercel is verified to work identically. Pick one; don't do both.)

**4. Stop the two projects building each other's branches.** With one repo in
two projects, *every* push builds in *both* — a push to `staging` also makes a
throwaway preview in the production project, and vice versa. That wastes build
minutes and, worse, produces production-project URLs serving staging commits.
Set Settings > Git > Ignored Build Step to "Run my Bash snippet" in each:

```sh
# in mymedin-client (production project)
[ "$VERCEL_GIT_COMMIT_REF" = "main" ] && exit 1 || exit 0

# in mymedin-client-staging
[ "$VERCEL_GIT_COMMIT_REF" = "staging" ] && exit 1 || exit 0
```

Vercel's convention is inverted on purpose: **exit 1 builds, exit 0 skips**.

**5. Settings > Deployment Protection > Vercel Authentication: on.** Staging is
a working copy of a medical app; it should not be publicly reachable. This also
keeps it out of search engines whatever `robots.txt` says.

## Deploying

```sh
git push origin main        # production; behaviour unchanged by this work
git push -u origin staging  # creates the branch and the first staging deploy
```

## Before staging actually works end to end

The frontend is ready, but staging has no backend yet. Still to do:

- Create the `mymedin-server-staging` Render service from the `staging` branch of
  `mymedin-server`.
- Point it at a **separate database**. Reusing the production `MONGO_URI` would
  make every staging test a production write — the one mistake that undoes the
  entire point of this environment.
- Add the staging frontend URL to the server's `CLIENT_ORIGIN`, or CORS will
  reject every request. Note `server.js` also allows
  `https://dental-app-client*.vercel.app` by regex; a project named
  `mymedin-client-staging` does **not** match that pattern, so it must be listed
  explicitly.
- Give it its own `JWT_SECRET`, so a staging token is worthless against
  production.

## Verifying a staging deploy

1. The red `STAGING` badge is visible bottom-left. If it isn't, the build picked
   up the wrong environment and is talking to **production** — stop and fix it.
2. DevTools > Network: API calls go to `mymedin-server-staging.onrender.com`.
3. `/robots.txt` returns `Disallow: /`.
4. No requests to `api.mixpanel.com`.
