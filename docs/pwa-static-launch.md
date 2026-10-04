# Static PWA launch preview

`manifest.json` opens `/launch.html`. The worker precaches this public document and
serves its navigations from cache, including query strings. Other navigations
remain network-only, with the existing offline document on network failure.
Authenticated HTML, API responses, and account data are never added to this cache.

The launch document contains inline CSS and a small inline logo. Two animation
frames let the skeleton paint before `location.replace("/")`. There is no minimum
display duration and no wait for the `load` event. The browser may hold this painted
frame while the server navigation runs; verify this on a real iPhone Home Screen
launch. Desktop tests do not establish iOS behavior.

Regenerate the document with `pnpm generate:pwa-launch` (Node 24). Its startup-image
links come from `app/pwa-startup-images.ts`. Keep its CSS skeleton aligned with
`app/loading.tsx` and the PNG generator, and bump the public cache version in
`public/sw.js` whenever cached launch assets change.

## Preview environment

This experiment uses the branch `fix/pwa-static-launch`, created from `develop`.
Branch-scoped Vercel configuration supplies the development `CONVEX_URL` at runtime,
an empty `CONVEX_DEPLOY_KEY` to skip backend deployment, and
`VERCEL_PREVIEW_FEEDBACK_ENABLED=0` to exclude the Vercel Toolbar.

`convex deploy --cmd ...` supplies its URL only to the build subprocess. This does
not replace a runtime Vercel `CONVEX_URL` variable.

There is no hardcoded WorkOS callback for this branch: the existing helper resolves
the stable Vercel branch origin. Check the actual `/login` redirect URI before
testing. Development personas are allowed only on the selected preview branch,
with the existing opt-in flag, WorkOS staging key, and developer-email checks.

## Timing

The launch script stores only durations and a worker-control boolean in session
storage. The root client consumes this record once and logs `[habitat-launch]`.
`shellMs` covers navigation start through the second animation frame;
`navigationGapMs` covers calling `replace` through the new navigation start;
`addedMs` is their sum. These values include fetching the launch HTML when the
worker does not control the page. They exclude OS time before navigation and the
subsequent server/dashboard load. Nothing is uploaded.

Install a fresh Home Screen icon from this preview origin so iOS picks up the new
manifest start URL. Test repeated launches and a launch after closing the app.
