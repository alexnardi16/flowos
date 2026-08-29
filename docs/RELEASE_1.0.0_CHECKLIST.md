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

## Release

- [ ] Create Git tag `v1.0.0` on the final validated commit
- [ ] Publish GitHub release `v1.0.0`
- [ ] Confirm GitHub Actions production AAB workflow succeeds
- [ ] Upload resulting AAB to Google Play production
- [ ] Verify Play Console release status
