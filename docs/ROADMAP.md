# FlowOS roadmap

This roadmap describes the current product direction, not a historical sprint log. Release readiness and external publication requirements are tracked separately in [`RELEASE_1.0.0_CHECKLIST.md`](RELEASE_1.0.0_CHECKLIST.md).

## Implemented in the current codebase

- Unified commitments for tasks, events and reminders.
- Today, Calendar, List and Focus views.
- Natural-language activity entry using deterministic application rules.
- Date, time, duration, all-day, priority, recurrence and custom reminder editing.
- Local notifications, configurable daily summary and reminder scheduling.
- Google Calendar and Google Tasks connection, synchronization, conflict handling and retry/offline recovery.
- Android home-screen widgets for Today and Calendar.
- In-app account deletion, public account-deletion page, privacy policy and terms of service.
- Automated type, regression, web-export and public-site checks through GitHub Actions.

## Known limitations

- **AI-generated planning suggestions:** the current planning and suggestion logic is rule-based/heuristic; the product should not describe it as LLM-generated advice. Any optional server-side AI interpretation must be verified against the production configuration before being advertised.
- **iOS widgets:** a code scaffold exists, but a real iOS build and device validation have not been completed.
- **Microsoft 365:** no Outlook/To Do synchronization is currently implemented.
- **Travel time and traffic-aware scheduling:** not implemented; the existing travel-time module is a stub and would require a routing provider, geocoding and production credentials.
- **Android Auto, CarPlay and wearable companions:** not implemented.
- **Weather/location:** location-based weather is not part of the current release and the app should not request device location for this purpose.

## Next priorities

1. Complete the physical-device and production OAuth checks in the release checklist.
2. Verify account deletion end to end and reconcile the public privacy policy with the exact production data flows.
3. Finish Google Play listing, Data Safety and reviewer access requirements.
4. After the first public release, prioritize improvements from real usage and support feedback before adding new integrations.
