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
- **Sprint 4 — done, heuristic (not LLM) suggestions:** `lib/scheduler.ts` (PlanningEngine) now uses real weekly availability windows (`DEFAULT_WEEKLY_AVAILABILITY`, working hours Mon–Fri with a lunch break, none on weekends) instead of a flat 9–18 constant, and prefers slots whose time of day matches the task's energy level (high-energy → morning, low-energy → afternoon) rather than just first-fit. `lib/replanTriggers.ts` + `lib/replanEngine.ts` add automatic replanning: a missed task slot or a flexible item now conflicting with a fixed/calendar event gets a new slot without the person pressing the "Genera piano automatico" button — this runs as part of the same sync pass as the daily summary and reminders. `lib/planningSuggestions.ts` surfaces the largest free gap today with a task that fits, and warns when today is overbooked; shown in the Piano screen. The requested "suggerimenti automatici dell'IA" are rule-based heuristics, not an LLM call — see "Known gaps" for why.
- **Sprint 5 — weather done, everything else not:** `lib/weather.ts` (`lib/weatherSummary.ts` for the pure formatting) fetches today's forecast from Open-Meteo (free, no API key) using the device's location via `expo-location`, and prepends it to the daily summary notification. Genuinely functional, not just typechecked — Open-Meteo needs no credentials so this could be reasoned about end-to-end. Traffic/travel-time (`lib/travelTime.ts`) is an unimplemented stub documenting exactly what it needs (a billed Google routing API key, routed through a new Edge Function, plus geocoding commitment locations, which are free text today). Android Auto and CarPlay are not started — native car-integration frameworks, same category as Sprint 3's Wear OS/Apple Watch gap.

### Architecture

`lib/googleWorkspace.ts` is the GoogleSyncService, `lib/scheduler.ts` is the PlanningEngine, `lib/dailySummary.ts` is the DailySummaryGenerator, `lib/notificationService.ts` is the NotificationService, `lib/backgroundSyncService.ts` is the BackgroundSyncService, `lib/reminderEngine.ts` (core logic in `lib/reminderPlan.ts`) is the ReminderEngine, `lib/widgetSync.ts` (core logic in `lib/widgetData.ts`) is the widget data bridge, `lib/replanEngine.ts` (core logic in `lib/replanTriggers.ts`, suggestions in `lib/planningSuggestions.ts`) is the automatic-replanning layer, and `lib/weather.ts` (core logic in `lib/weatherSummary.ts`) is the weather bridge.
