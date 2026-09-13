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

The Vercel CLI here is logged out, so step 1 has to be done by a human.

```sh
cd mymedin-client
npx vercel login                    # opens a browser
npx vercel link --project mymedin-client-staging   # creates/links the project
```

Then in the project's **Settings**:

1. **Git** — connect the `mymedin1236/mymedin-client` repo and set the
   *Production Branch* to `staging`. This is the important one: it makes a push
   to `staging` a production deploy *of the staging project*, giving a stable
   URL instead of a per-commit preview URL.
2. **Build & Development Settings** — set the Build Command to
   `npm run build:staging`. With that, staging needs **no environment variables
   at all** — `.env.staging` in the repo supplies them, so the deployment is
   reproducible from the repo alone.
   (The alternative — leaving the build command as `npm run build` and setting
   `VITE_APP_ENV=staging` in Vercel — is verified to work identically. Pick one;
   don't do both.)
3. **Deployment Protection** — turn on Vercel Authentication (or a password).
   Staging is a working copy of a medical app; it should not be publicly
   reachable, and this also keeps it out of search engines regardless of
   `robots.txt`.

Deploy:

```sh
git push -u origin staging
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
