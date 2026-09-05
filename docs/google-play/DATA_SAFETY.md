# FlowOS - Google Play Data safety declaration preparation

This document is a preparation aid. The final answers must be checked against the exact production AAB and the live Supabase/Google/OpenAI integrations before submission.

## Data collected / processed by the app

Google defines collection as transmitting data off the user's device, including transmission by libraries and SDKs.

| Play Console category | Data type | Collection | Purpose | Optional | Deletion |
|---|---|---:|---|---:|---|
| Personal info | Name | Yes, as part of the Google profile used for sign-in | Account management / app functionality | No | Yes |
| Personal info | Email address | Yes | Account management / authentication | No | Yes |
| Personal info | User IDs | Yes | Account management and associating user data | No | Yes |
| Personal info | Other user-generated content | Yes | Tasks, commitments, reminders and related user content | No | Yes |
| Personal info | Calendar events | Yes, when Google is connected | Calendar synchronization / app functionality | Yes | Yes |

### Data that is not collected by FlowOS for analytics/advertising

- No advertising SDK is present in the application configuration.
- Notifications are scheduled locally on the device; FlowOS does not register a push-token analytics database in the current code.
- Diagnostic and notification logs are stored locally on the device and are not transmitted to FlowOS as an analytics profile.
- Device location is no longer requested or transmitted by the production code.

## Third-party processing

FlowOS currently integrates with:

- Supabase for authentication and application data storage.
- Google APIs for user-authorized Calendar / Tasks synchronization.
- OpenAI for optional AI interpretation/planning when the production AI service is available.

Google Play requires disclosure of relevant data handling by third-party SDKs/services and consistency with the privacy policy.

## Google API data

The current Google OAuth scopes are `openid`, `email`, `profile`, `calendar.events`, `calendar.calendarlist.readonly`, and `tasks`. Calendar events and Google Tasks are synchronized through the FlowOS backend. OAuth access/refresh tokens are stored server-side in the private Supabase schema.

## AI data

When AI interpretation/planning is used, user-entered commitment text is sent from the FlowOS backend to OpenAI. The OpenAI Responses API request uses `store: false`. The production configuration should be verified before submission.

## Security

Declare encryption in transit if all production network paths use HTTPS/TLS, which is the intended configuration. Authentication and row-level access controls are used for application data.

## Data deletion

FlowOS provides an in-app deletion path and an external web resource where users can request account and associated data deletion. Google requires both for apps that enable account creation.

The deletion backend removes FlowOS commitments, Google connection records, Google OAuth tokens and the Supabase authentication account, subject to lawful retention requirements.

## Final verification before Play Console submission

1. Build a new Android AAB from the updated `main` branch. The existing v1.0.0 AAB still contains the previous code and must not be treated as equivalent to this updated source.
2. Confirm the exact production AAB permissions and dependency set.
3. Confirm all data transmitted off-device, including Google API data and AI requests.
4. Confirm third-party SDK/service behavior.
5. Confirm no analytics, crash-reporting, push-token or device-ID collection has been introduced.
6. Confirm exact retention and deletion behavior in the live Supabase project.
7. Confirm the live Privacy Policy matches these declarations.
8. Confirm the external account-deletion URL loads without login and clearly provides a way to request deletion.
