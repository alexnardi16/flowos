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

## Later native product work

- Android/iOS home-screen widgets
- Share extension for capturing content from other apps
- Native speech recognition and audio capture
- Store submission assets and privacy disclosures
