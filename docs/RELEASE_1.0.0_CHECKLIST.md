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
- [ ] Verify public privacy-policy URL over HTTPS
- [ ] Verify public account-deletion URL over HTTPS
- [ ] Verify deletion from an external browser without requiring app installation
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

## Release

- [x] Git tag `v1.0.0` and GitHub release exist (the tag is historical and is not automatically moved to later commits).
- [ ] Build the latest validated `main` commit with the **Production Android AAB** workflow.
- [ ] Verify the downloaded AAB belongs to the intended commit and has a new, valid Android `versionCode`; do not assume the AAB attached to the original `v1.0.0` release contains current `main`.
- [ ] Install and smoke-test that exact AAB on a physical Android device.
- [ ] Upload the validated AAB to the appropriate Google Play track.
- [ ] Verify Play Console pre-launch checks and release status.

Do not create or move the `v1.0.0` tag just to rebuild the binary. If a new public app version is needed after `1.0.0`, update the app version and prepare a new versioned release deliberately.
