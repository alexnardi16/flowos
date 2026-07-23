# FlowOS roadmap

## Phase 1: usable mobile MVP
- Persist commitments locally
- Supabase authentication and database
- AI commitment interpretation
- Daily plan generation
- Local reminders

## Phase 2: integrations
- Google Calendar synchronization
- Microsoft 365 synchronization
- Voice capture
- Push notifications
- Offline synchronization queue

## Phase 3: intelligent orchestration
- Dynamic replanning
- Confidence engine trained on user behavior
- Contextual reminders
- Widgets and lock-screen actions
- Smartwatch companion

## Sprint plan (proactive notifications track)

- **Sprint 1 — done:** daily scheduler at 07:30, automatic Google Calendar/Tasks sync before the summary, duplicate prevention, missed-summary recovery, Notifiche settings section, dedicated notification logger, automated tests. See `docs/IMPLEMENTATION_STATUS.md` for the two gaps found along the way (missing Edge Function source, `diagnostics.ts` web-only persistence).
- **Sprint 2 — done:** ReminderEngine (`lib/reminderEngine.ts` + pure core in `lib/reminderPlan.ts`) adds per-event reminders 10 minutes before start, a grouped "task in scadenza" notification (due within 24h) and a grouped "task scadute" notification (overdue), both content-hash deduped so re-running the engine never re-alerts for the same unchanged set. App badge count = due-soon + overdue. Runs on every foreground and as part of the existing daily sync flow.
- **Sprint 3 — partial, iOS widget unverified beyond typecheck:** `lib/widgetData.ts` (pure, tested) + `lib/widgetSync.ts` + `widgets/TodayWidget.tsx` scaffold an iOS home-screen widget via the official `expo-widgets` library (Expo UI components, no hand-written Swift). It typechecks against the real `expo-widgets`/`@expo/ui` types, but **has never been built or rendered** — there is no Xcode/macOS available in the environment this was written in. Verify with a real iOS development build before trusting it. Android widget, Wear OS companion and Apple Watch companion are **not implemented**: see "Known gaps" below for why and what each would take.
- **Sprint 4:** intelligent replanning — automatic task reordering by duration, priority, energy, availability and fixed events; AI-generated suggestions.
- **Sprint 5:** weather, traffic and travel-time context; Android Auto and CarPlay.

### Architecture

`lib/googleWorkspace.ts` is the GoogleSyncService, `lib/scheduler.ts` is the PlanningEngine, `lib/dailySummary.ts` is the DailySummaryGenerator, `lib/notificationService.ts` is the NotificationService, `lib/backgroundSyncService.ts` is the BackgroundSyncService, `lib/reminderEngine.ts` (core logic in `lib/reminderPlan.ts`) is the ReminderEngine, and `lib/widgetSync.ts` (core logic in `lib/widgetData.ts`) is the widget data bridge.
