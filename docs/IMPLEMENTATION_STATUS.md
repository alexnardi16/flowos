# FlowOS implementation status

## Implemented

- Mobile-first Expo Router application
- Unified Commitment domain model
- Today, Plan, Inbox, Profile, Capture and Focus screens
- Natural-language interpretation with a Supabase Edge Function
- Local fallback parser when the backend is unavailable
- Supabase passwordless authentication
- Persistent authentication sessions
- Supabase repository with Row Level Security schema
- Offline persistence and mutation queue
- Local notifications
- Daily summary notification at 07:30 local time, with automatic Google Calendar/Tasks sync beforehand, missed-summary recovery on app foreground, duplicate prevention, a dedicated notification log, and a Notifiche settings screen
- Per-event reminders 10 minutes before start, grouped due-soon/overdue task notifications, and app badge count (ReminderEngine)
- Automatic replanning (missed slots, conflicts with fixed events), energy-aware scheduling within real weekly availability windows, and rule-based planning suggestions (ReplanEngine + extended PlanningEngine)
- Today's weather in the daily summary (Open-Meteo, device location via expo-location)
- Device calendar event creation
- EAS Build and EAS Update profiles
- GitHub Actions TypeScript validation

## Requires external account configuration

- EAS project creation/link and first preview build
- Supabase project URL and publishable key
- Deployment of database migration and Edge Function
- Server-side OpenAI API key
- Apple and Google push credentials for remote notifications
- Google Calendar OAuth if direct Google-account synchronization is preferred over device-calendar synchronization

## Known gaps found while implementing Sprint 1

- The `google-workspace` and `google-delete-item` Supabase Edge Functions referenced by `lib/googleWorkspace.ts` and `lib/commitmentsRepository.ts` are not committed to this repository (only `interpret-commitment` is). They appear to exist only as deployed Supabase functions. Recommend committing their source under `supabase/functions/` so the project isn't dependent on the state of one Supabase dashboard.
- The daily summary background task (`lib/backgroundSyncService.ts`) uses `expo-background-task`, which is opportunistic on both Android (WorkManager) and iOS (BGTaskScheduler): the OS decides when it actually runs, not FlowOS. The 07:30 notification's *delivery time* is still exact because it is a native OS calendar trigger; only its *content freshness* depends on whether a background sync managed to run beforehand. The in-app recovery check on foreground does not have this limitation.
- `lib/diagnostics.ts` only persists to `window.localStorage`, so on native builds (iOS/Android) it silently records nothing — the in-app "Logger" section under Io only ever shows data on the web build. Not fixed as part of this sprint; the new `lib/notificationLog.ts` uses AsyncStorage instead and works on every platform.
- The grouped due-soon/overdue notifications only re-fire when the underlying set of task ids changes (content-hash dedup), not once per day regardless. An overdue task that never changes will not keep re-notifying every morning — intentional, to avoid nagging, but worth knowing if the expectation was a daily repeat.
- **Sprint 3 native widgets/companions were only partially built, and only the iOS widget at that.** This environment has no Xcode, no Android Studio, and no way to run EAS Build (api.expo.dev is outside the sandbox's network allowlist), so nothing native could be compiled or visually verified here — only TypeScript could be written and typechecked.
  - iOS widget: scaffolded with the official `expo-widgets` library (`widgets/TodayWidget.tsx`, wired into `lib/widgetSync.ts`). Typechecks against real library types, but has never been run. **Verify with a real iOS development build before shipping.**
  - Android widget: not implemented. Recommend `react-native-android-widget` — it renders JSX to native RemoteViews via a config plugin, so it's buildable without hand-written Kotlin, but its component API needs to be checked against current docs before writing it (only shallow secondary-source knowledge of it going into this sprint).
  - Wear OS companion: not implemented. This is a separate native Kotlin module using the Wear OS Data Layer API to talk to the phone app — real native engineering, not a config-plugin shortcut.
  - Apple Watch companion: not implemented. Same situation on the other platform — a separate watchOS target in Swift/SwiftUI, using WatchConnectivity to talk to the phone app.
  - Recommend doing the remaining three with a local Claude Code session (or a mobile engineer) on a machine that actually has Xcode/Android Studio, where the native build can be compiled and tested as it's written — the same rigor Sprint 1/2 had here, just with the right tools for native code.
- **Sprint 4's "suggerimenti automatici dell'IA" are rule-based heuristics, not an LLM call.** Wiring real AI suggestions in would need a new Supabase Edge Function (like `interpret-commitment`) calling a model — writeable here, but not deployable or testable end-to-end without Supabase project access. The current gap list already flags that even the *existing* Google-sync edge functions aren't committed to this repo; adding a new undeployed one would only make that worse until that's sorted out first.
- **Sprint 5: only weather was actually built.** Traffic/travel-time (`lib/travelTime.ts`) is a documented stub, not an implementation — it needs a billed Google routing API key that hasn't been provided, plus geocoding for commitment locations (currently free text). Android Auto and CarPlay were not started at all: both are native car-integration frameworks (Android's Car App Library in Kotlin, CarPlay's framework in Swift), the same category of work as the Wear OS/Apple Watch gap in Sprint 3 — needs Xcode/Android Studio and should go through a local Claude Code session or a mobile engineer, not this sandbox.
- **GitHub Codespaces has no Android SDK by default.** `eas build --local` and `expo run:android` both fail with "SDK location not found" until one is installed. `.devcontainer/devcontainer.json` + `.devcontainer/setup-android-sdk.sh` fix this for any *new* Codespace (or an existing one after "Rebuild Container"). For a Codespace already running, run `bash .devcontainer/setup-android-sdk.sh` once manually. The script pins `platforms;android-36`, `build-tools;36.0.0` and `ndk;27.1.12297006` to match what this project's Gradle build actually requests — re-check those version numbers against a build log if this ever starts failing again after an SDK bump.
- **JDK 22+ breaks CMake-based native modules (expo-updates, react-native-worklets) with an unhelpful error.** The task fails with only `WARNING: A restricted method in java.lang.System has been called` as the reported cause — this is JEP 472's native-access restriction, unrelated to any app code, and it's a known issue across many native Android projects (react-native, react-native-vision-camera, etc. all hit the identical message). Two mitigations are in place: `.devcontainer/devcontainer.json` pins JDK 17 (the traditional, still-safe choice for Android tooling) instead of a newer default, and `plugins/withNativeAccessJvmArgs.js` — a local Expo config plugin — appends `--enable-native-access=ALL-UNNAMED` to `org.gradle.jvmargs` on every `expo prebuild`, so even a build machine that does use a newer JDK (an EAS cloud builder, someone's own laptop) won't hit this.

## Later native product work

- Android/iOS home-screen widgets
- Share extension for capturing content from other apps
- Native speech recognition and audio capture
- Store submission assets and privacy disclosures
