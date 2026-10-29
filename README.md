# FlowOS

**FlowOS** is a mobile-first productivity app that brings tasks, events and reminders together in one daily planning system.

**Website:** https://getflowos.netlify.app/about/  
**Privacy policy:** https://getflowos.netlify.app/privacy-policy/  
**Account deletion:** https://getflowos.netlify.app/delete-account/  
**Source code:** https://github.com/alexnardi16/flowos

## What you can do

- Review today's activities in a dedicated **Today** view.
- Manage commitments in **Calendar** and **List** views.
- Create tasks, events and reminders with dates, times, durations, priorities and recurrence.
- Enter activities using natural-language input.
- Use **Focus** mode to concentrate on the next step.
- Set local notifications, custom reminders and a daily summary.
- Synchronize supported Google Calendar events and Google Tasks when you connect Google.
- Use Android home-screen widgets for Today and Calendar.
- Manage sync conflicts and recover from transient network/server failures.
- Delete your FlowOS account and associated data through the in-app flow or public deletion page.

The core planning and suggestion features described here use application rules and heuristics; the product listing does not claim that they are AI-generated.

## Project status

The repository contains the Android app, backend integration, automated tests, deployment workflows and public legal pages. The codebase is maintained on the `main` branch.

A successful CI/build is not a substitute for physical-device acceptance or Play Console approval. Before publishing, complete the checklist in [`docs/RELEASE_1.0.0_CHECKLIST.md`](docs/RELEASE_1.0.0_CHECKLIST.md), including production OAuth verification, end-to-end account deletion, Data Safety declarations and real-device tests.

## Technology

- Expo / React Native
- TypeScript and Expo Router
- Supabase Auth, PostgreSQL and Edge Functions
- Google Calendar API and Google Tasks API
- EAS Build / EAS Update
- GitHub Actions
- Netlify for the public website and legal pages

## Local development

Requirements: Node.js 22 or later.

```bash
npm install
npx expo start
```

Useful validation commands:

```bash
npm run typecheck
npm test
npx expo lint
npx expo export --platform web
```

The application needs the appropriate environment configuration and backend services to test authentication and live Google synchronization end to end. See [`docs/EAS_AND_BACKEND_SETUP.md`](docs/EAS_AND_BACKEND_SETUP.md) and [`docs/GOOGLE_WORKSPACE_SETUP.md`](docs/GOOGLE_WORKSPACE_SETUP.md).

## Android release

The production workflow builds an Android App Bundle (AAB). The `versionCode` is managed by the production build workflow. Release metadata and four-language notes are maintained in:

- [`docs/google-play/STORE_METADATA.md`](docs/google-play/STORE_METADATA.md)
- [`docs/release-notes-1.0.0.md`](docs/release-notes-1.0.0.md)
- [`docs/google-play/DATA_SAFETY.md`](docs/google-play/DATA_SAFETY.md)
- [`docs/RELEASE_1.0.0_CHECKLIST.md`](docs/RELEASE_1.0.0_CHECKLIST.md)

The public legal site is hosted on Netlify; **GitHub Pages is not currently enabled** for this repository. The static website source lives in `public/` and is copied into the web export.

## Main workflows

- `.github/workflows/ci.yml`: typecheck, tests, lint, Expo Doctor and web export validation.
- `.github/workflows/release-aab.yml`: production Android AAB build and release artifact.
- `.github/workflows/eas-build.yml`: EAS development/preview builds.
- `.github/workflows/eas-update.yml`: EAS Update.
- `.github/workflows/eas-web-preview.yml`: web preview workflow.
- `.github/workflows/public-site-smoke.yml`: scheduled reachability checks for public legal pages.
- `.github/workflows/supabase-deploy.yml`: Supabase deployment workflow.

## Privacy and support

For privacy questions or account-deletion requests, contact [alex16nardi@gmail.com](mailto:alex16nardi@gmail.com). Never send passwords or OAuth tokens by email.
