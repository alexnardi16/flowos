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
- **Sprint 2:** per-event reminders 10 minutes before start, due-task and overdue-task notifications, app icon badge, grouped notifications.
- **Sprint 3:** Android widget, iOS widget, Wear OS companion, Apple Watch companion.
- **Sprint 4:** ReminderEngine-driven intelligent replanning — automatic task reordering by duration, priority, energy, availability and fixed events; AI-generated suggestions.
- **Sprint 5:** weather, traffic and travel-time context; Android Auto and CarPlay.

### Architecture

`lib/googleWorkspace.ts` is the GoogleSyncService, `lib/scheduler.ts` is the PlanningEngine, `lib/dailySummary.ts` is the DailySummaryGenerator, `lib/notificationService.ts` is the NotificationService, and `lib/backgroundSyncService.ts` is the BackgroundSyncService that chains all of them together and exposes the OS background task plus the in-app recovery check. A ReminderEngine for per-item reminders (Sprint 2) does not exist yet.
