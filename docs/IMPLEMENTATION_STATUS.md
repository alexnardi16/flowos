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

## Later native product work

- Android/iOS home-screen widgets
- Share extension for capturing content from other apps
- Native speech recognition and audio capture
- Store submission assets and privacy disclosures
