# FlowOS 1.0.0 Release Checklist

## Repository / build

- [x] `package.json` version is `1.0.0`
- [x] Expo app version is `1.0.0`
- [x] EAS production profile targets Android
- [x] Production workflow generates an AAB
- [x] Production credentials are remote
- [x] Android `versionCode` is auto-incremented by EAS
- [x] CI passes on `main`
- [ ] Production AAB installed and smoke-tested on a physical Android device
- [ ] Production AAB uploaded to Play Console and accepted by pre-launch checks

## Google integration

- [x] Google account connection is implemented
- [x] Google Calendar / Tasks synchronization is implemented
- [ ] Confirm production OAuth consent screen and publishing status
- [ ] Confirm production OAuth client IDs / redirect configuration
- [ ] Confirm all requested Google scopes are justified and verified where required
- [ ] Confirm Google API quota and credentials are production-ready

## Privacy / account deletion

- [x] In-app privacy policy exists
- [x] In-app account deletion flow exists
- [x] Server-side account deletion function exists
- [x] Verify public privacy-policy URL over HTTPS (Netlify deployment and live legal-site smoke test)
- [x] Verify public account-deletion URL over HTTPS (Netlify deployment and live legal-site smoke test)
- [ ] Verify deletion from an external browser without requiring app installation
- [ ] Confirm the Android/browser speech-recognition provider and whether the external audio-processing flow requires an Audio files declaration
- [ ] Confirm Expo push-token, Expo EAS Update and Supabase data disclosures against the production SDK/service configuration
- [ ] Complete Google Play Data Safety form consistently with the actual data flows

## Google Play Console

- [ ] Store listing completed
- [ ] App icon uploaded
- [ ] Screenshots uploaded
- [ ] Short and full descriptions completed
- [ ] Content rating completed
- [ ] Target audience completed
- [ ] Ads declaration completed
- [ ] Data Safety completed
- [ ] Privacy policy URL configured
- [ ] App access / reviewer instructions completed if required
- [ ] Closed testing completed if required for the developer account
- [ ] Production access granted

## Functional acceptance on a physical Android device

Run these checks on the production-like AAB, with a real Google account connected. Automated tests cover pure logic and code contracts, but cannot confirm Android system UI, network behavior, account configuration, or real Google API behavior. Record the device model, Android version, app versionCode, date, and result before marking each item complete.

- [ ] **Create and persist:** create one timed event, one all-day event, and one task; confirm each appears in FlowOS, survives app force-stop/relaunch, and appears in the expected Google Calendar/Tasks destination.
- [ ] **Edit and delete:** change title, time/date, duration, and all-day state; confirm the change propagates once to Google without duplicates. Test both “delete from FlowOS only” and “delete from FlowOS and Google”; confirm a later Google refresh does not resurrect a FlowOS-hidden item.
- [ ] **Offline recovery:** enable airplane mode, create and edit an activity, force-close/reopen the app, restore connectivity, and confirm queued changes sync exactly once without losing the newest edit or duplicating records.
- [ ] **Cross-view consistency:** compare Today, Calendar, List, Today widget, and Calendar widget after create/edit/complete/delete and after a refresh. Confirm all-day activities do not display a time and timed activities show the correct interval.
- [ ] **Timezone and daylight-saving transition:** test an all-day event and a timed event near a date boundary; change the device timezone (or test a date around the DST change), reopen FlowOS, and confirm dates do not shift unexpectedly.
- [ ] **Notifications and widgets:** verify notification permission granted/denied paths, immediate summary, scheduled summary, reminders, notification drawer persistence, widget completion, widget refresh, and behavior after app restart.
- [ ] **Account isolation:** sign out and sign in as a different test account; confirm the previous account's activities are not shown, diagnostic data is cleared, and Google sync uses only the newly connected account.
- [ ] **Network / sync recovery:** interrupt connectivity during a Google push and pull, restore it, and verify the sync status recovers without duplicates or lost changes.
- [ ] **Stability:** use the app for a short smoke session, inspect diagnostics for unexpected errors, and confirm navigation and add/edit sheets remain usable after repeated operations.

## Privacy / account deletion

- [ ] Verify that logs do not expose activity titles, descriptions, locations, email addresses, or credentials.
- [ ] Test account deletion end-to-end and verify the account's cloud data is deleted as expected.


## Privacy and Google Play audit — 2026-11-10

- [x] Rechecked all active Supabase Edge Functions. No active function calls OpenAI; `ai-planner` and `interpret-commitment` use deterministic rules.
- [x] Retired the unused `translate-activities` endpoint; it now returns HTTP 410 and requires a valid JWT.
- [x] Added the retired endpoint source to the repository so future deployments do not restore the old OpenAI translation implementation.
- [x] Updated the canonical Privacy Policy and static fallback; both files are identical.
- [x] Rewrote `docs/google-play/DATA_SAFETY.md` using the live app/backend data flows and current Google Play data-type taxonomy.
- [x] Verified all six public application tables have RLS enabled.
- [x] Verified the three private Google OAuth/sync tables are in a non-exposed schema and grant no schema/table privileges to `anon` or `authenticated`.
- [ ] Remove the unused `OPENAI_API_KEY` secret from Supabase Edge Function secrets, after confirming it is not used outside FlowOS.
- [ ] Verify the latest Netlify production deploy is ready and inspect the live Privacy Policy and deletion page from an external browser.
- [ ] Complete and save the Google Play Data Safety form as a draft, then inspect its Store listing preview before submission.
- [ ] Confirm the Google OAuth consent screen is in production and any required Google verification is complete.
- [ ] Confirm the production AAB, install it on a physical Android device, and verify the exact binary before Play Console submission.

### Supabase warnings intentionally not changed

- `pg_net` is installed in `public`. The queue is empty, but 360 recent HTTP response records existed at audit time. Supabase documents that dropping/recreating the extension deletes those records, so this change was not made automatically.
- Leaked-password protection is disabled. The FlowOS app uses Google OAuth only and has no email/password sign-in flow. Enable the setting if password authentication is enabled in Supabase Auth or introduced in a future release.

## Release

- [x] Git tag `v1.0.0` and GitHub release exist (the tag is historical and is not automatically moved to later commits).
- [ ] Build the latest validated `main` commit with the **Production Android AAB** workflow.
- [ ] Verify the downloaded AAB belongs to the intended commit and has a new, valid Android `versionCode`; do not assume the AAB attached to the original `v1.0.0` release contains current `main`.
- [ ] Install and smoke-test that exact AAB on a physical Android device.
- [ ] Upload the validated AAB to the appropriate Google Play track.
- [ ] Verify Play Console pre-launch checks and release status.

Do not create or move the `v1.0.0` tag just to rebuild the binary. If a new public app version is needed after `1.0.0`, update the app version and prepare a new versioned release deliberately.
