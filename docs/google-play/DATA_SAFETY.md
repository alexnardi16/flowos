# FlowOS - Google Play Data safety declaration preparation

This document is a preparation aid, not a submitted Play Console declaration. Recheck the exact production AAB, Supabase project, Google OAuth configuration and Expo push setup before submitting or changing the Play Console form.

## Data collected / processed by the app

The table below follows the current Google Play data-type names. Confirm each answer against the exact production binary and current Play Console form before submission. In particular, verify the account-profile fields returned by Google Sign-In and the actual token-deletion behavior.

Google defines collection as transmitting data off the user's device, including transmission by libraries and SDKs.

| Play Console category | Data type | Collection | Purpose | Optional | Deletion |
|---|---|---:|---|---:|---|
| Personal info | Name | Yes, as part of the Google profile used for sign-in | Account management / app functionality | No | Yes |
| Personal info | Email address | Yes | Account management / authentication | No | Yes |
| Personal info | User IDs | Yes | Account management and associating user data | No | Yes |
| App activity | Other user-generated content (task titles, notes, descriptions and commitment details) | Yes | App functionality | Yes, user chooses what to enter | Yes |
| Calendar | Calendar events | Yes, when Google is connected | App functionality | Yes, user chooses whether to connect Google | Yes |

| Device or other IDs | Expo push token | Yes, when notification permission is granted | App functionality | Yes, user can deny/disable notifications | Yes, when the account/device token is removed |

### Voice commands

- Voice commands open the Android system speech-recognition activity (or the browser speech-recognition API on web).
- FlowOS receives the recognized transcript and parses the command locally; the app code does not upload or store raw audio recordings on FlowOS servers.
- The system/browser speech-recognition provider may process the audio independently. Verify the relevant provider and whether this external system flow affects the Play Console Audio files declaration for the shipped Android build.

### Device identifiers and notifications

- When notification permission is granted, the app obtains an Expo push token for the device.
- The token is stored in the Supabase `device_push_tokens` table, associated with the authenticated user, and sent to Expo's push service for background-sync notifications.
- The push payload contains a sync marker and timestamp, not task titles, descriptions, calendar event content or other commitment data.
- Review the Play Console taxonomy for whether this token must be declared under **Device or other IDs**. Its purpose is app functionality; collection is conditional on notification permission.

### Data that is not collected by FlowOS for analytics/advertising

- No advertising SDK is present in the application configuration.
- Local reminders are scheduled on the device. The separate Expo push token described above is used for background synchronization, not advertising or analytics.
- Diagnostic and notification logs are stored locally on the device; the current app code does not upload them to a third-party analytics or crash-reporting service.
- Device location is no longer requested or transmitted by the production code.

## Recipients and sharing

- **Supabase:** receives account identity, FlowOS commitments, preferences, Google connection metadata and OAuth tokens for authentication, storage and synchronization.
- **Google:** provides sign-in and receives the event/task changes that FlowOS synchronizes to the Google calendars and task lists selected by the user.
- **Expo:** receives the device push token and the background-sync push message metadata needed to deliver the notification. The message contains no task or calendar content.
- **Netlify:** hosts the public website and legal pages; web visitors' standard request metadata may be processed by the hosting provider.

## Third-party processing

FlowOS currently integrates with:

- Supabase for authentication and application data storage.
- Google APIs for user-authorized Calendar / Tasks synchronization.
- Expo Push Service for delivery of background-sync notifications when the user grants notification permission.

Google Play requires disclosure of relevant data handling by third-party SDKs/services and consistency with the privacy policy.

## Google API data

The current Google OAuth scopes are `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly`, and `https://www.googleapis.com/auth/tasks`. Calendar events and Google Tasks are synchronized through the FlowOS backend. OAuth access/refresh tokens are stored server-side in the private Supabase schema.

## Security

Declare encryption in transit if all production network paths use HTTPS/TLS, which is the intended configuration. Authentication and row-level access controls are used for application data.

## Data deletion

FlowOS provides an in-app deletion path and an external web resource where users can request account and associated data deletion. Google requires both for apps that enable account creation.

The deletion backend removes FlowOS commitments, Google connection records, Google OAuth tokens and the Supabase authentication account, subject to lawful retention requirements.

## Final verification before Play Console submission

1. Build a new Android AAB from the updated `main` branch. The existing v1.0.0 AAB still contains the previous code and must not be treated as equivalent to this updated source.
2. Confirm the exact production AAB permissions and dependency set.
3. Confirm all data transmitted off-device, including Google API data, Supabase account/content data and Expo push tokens.
4. Confirm third-party SDK/service behavior, especially Expo push-token registration and delivery.
5. Confirm there is no analytics or crash-reporting SDK, and correctly declare the Expo push token as a device identifier if required by the current Play Console taxonomy.
6. Confirm exact retention and deletion behavior in the live Supabase project.
7. Confirm the live Privacy Policy matches these declarations.
8. Confirm the external account-deletion URL loads without login and clearly provides a way to request deletion.
