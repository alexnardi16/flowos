# FlowOS - Google Play Data safety declaration preparation

This is the evidence-based preparation for the Play Console form. It is not a submitted declaration. The final answers must match the exact AAB uploaded to Google Play and every version still distributed on any Play track.

## Current production data flows verified from source and Supabase

- Supabase Auth authenticates the user. The app stores the FlowOS account ID and Google profile identity (name, email and Google account ID).
- FlowOS stores user-created commitments, including task/event titles, descriptions, dates, deadlines, duration, priority and status, in Supabase. App language, preferences and widget appearance settings are stored locally on the device and are not transmitted to FlowOS servers.
- When the user connects Google, FlowOS reads and synchronizes the selected Google Calendar events and Google Tasks through its backend. OAuth access and refresh tokens are stored in the non-exposed `private` schema. The `private` schema grants access only to the backend `service_role`; `anon` and `authenticated` have no schema/table privileges.
- When notifications are enabled, the app registers an Expo push token. The token is stored in `public.device_push_tokens` and sent to Expo Push Service. Push payloads contain only a background-sync marker and timestamp, not task or calendar content.
- Expo EAS Update receives technical update-check metadata such as platform and runtime/app version. No task, calendar, account profile or user-entered content is included in update checks.
- Voice commands on Android launch the Android system speech-recognition activity through `android.speech.action.RECOGNIZE_SPEECH`. FlowOS receives the resulting text transcript and parses it locally. FlowOS does not request the Android microphone permission, upload raw audio to FlowOS servers, or store voice recordings. The system speech-recognition provider may process audio under its own terms.
- The `ai-planner` and `interpret-commitment` backend functions currently use deterministic local rules and do not call a generative-AI provider. The legacy translation endpoint is retired. No active Edge Function references OpenAI or transmits user content to it.
- Local reminders and diagnostic/notification logs are kept on-device. The app source contains no analytics, advertising or third-party crash-reporting SDK.
- Device location is not requested or transmitted by the current app.

## Recommended Play Console answers

### Data collection and security

| Play Console question | Recommended answer | Evidence / qualification |
|---|---|---|
| Does the app collect or share required user data types? | **Yes** | Account identity, user-created content, Google Calendar data and conditional push token are transmitted off-device. |
| Is all user data collected by the app encrypted in transit? | **Yes**, after confirming the production endpoints/build use HTTPS/TLS | Supabase, Google APIs and Expo endpoints are called over HTTPS. Recheck the final AAB and every network path. |
| Does the app provide a way for users to request deletion of their data? | **Yes** | In-app deletion and the public email-based deletion request page are available. |

### Select these data types

| Play Console category | Data type | Collected? | Optional? | Purpose(s) | Notes |
|---|---|---:|---:|---|---|
| Personal info | Name | Yes | No, as part of Google sign-in profile | Account management; App functionality | Google profile name |
| Personal info | Email address | Yes | No | Account management; App functionality | Google sign-in email |
| Personal info | User IDs | Yes | No | Account management; App functionality | FlowOS user ID and Google account identifier |
| App activity | Other user-generated content | Yes | Yes | App functionality | Tasks, notes, descriptions and other commitments entered by the user |
| Calendar | Calendar events | Yes, when Google is connected | Yes | App functionality | Events and event details synchronized with selected calendars |
| Device or other IDs | Device or other IDs | Yes, when push notifications are enabled | Yes | App functionality | Expo push token associated with the FlowOS account |

For each row above, select **Collected**. Do not select **Shared** on the basis of the current documented data flows, subject to the exceptions below.

### Sharing classification and third parties

Google Play excludes transfers to a service provider processing data on the developer's behalf from the definition of sharing. It also excludes a transfer to a third party based on a specific user-initiated action where the user reasonably expects the data to be transferred.

- **Supabase:** service provider for authentication, storage and backend processing. Data sent to Supabase is collected, but is not declared as shared solely because Supabase is the service provider.
- **Expo Push Service:** service provider for push delivery. The Expo push token and sync-only payload are sent for this user-enabled app functionality; treat Expo as a service provider, not an advertising/data-broker recipient.
- **Google Calendar / Google Tasks:** data is transferred to the Google account and destinations that the user explicitly connects and selects for synchronization. This is a user-initiated feature and the transfer is reasonably expected. It is not sharing for the Play Data Safety definition when the user action and in-app expectations are clear.
- **Google Sign-In:** Google is the identity provider supplying the profile information; the app stores the resulting identity data with Supabase.
- **Expo EAS Update:** receives technical app compatibility metadata, not user content or account data.
- **Netlify:** hosts the public legal/marketing website. Standard web request metadata relates to visits to those public pages, not data collected by the Android app.

Do not declare advertising, marketing, analytics, diagnostics, crash logs, precise/approximate location, contacts, photos/videos, messages or audio files based on the current app source. Android speech recognition is handled by the external system speech-recognition activity; FlowOS receives only the transcript and does not transmit or store the raw recording.

## OAuth credentials

The backend stores Google OAuth access and refresh tokens in `private.google_oauth_tokens`. These are security credentials, not task/calendar content. The current Play Console taxonomy does not present a dedicated OAuth-token data type. Keep their collection and server-side storage clearly disclosed in the Privacy Policy; do not invent a new data type. If the live Play Console form provides a specific authentication/other-info classification applicable to OAuth credentials, review that taxonomy before submitting.

## Security evidence

- Google OAuth scopes in the app: `openid`, `email`, `profile`, `calendar.events`, `calendar.calendarlist.readonly`, and `tasks`.
- OAuth tokens and Google sync cursors are stored in the non-exposed `private` schema.
- Direct SQL privilege checks confirmed no schema/table privileges for `anon` or `authenticated` on the three private Google tables. Backend `service_role` is the intended access path.
- All six public application tables have RLS enabled. The `commitments` and `sync_conflicts` policies restrict rows to `auth.uid() = user_id`; Google connection/calendar/task-list and push-token policies are owner-scoped as well.
- Supabase Security Advisor currently reports two warnings: `pg_net` installed in `public`, and leaked-password protection disabled. The app source uses Google OAuth only and contains no email/password sign-in or sign-up flow, so leaked-password protection does not affect the current app login path; enable it if password authentication is enabled in Supabase Auth or introduced later. The `pg_net` warning is a hardening recommendation, not evidence that task/token data is exposed. The live extension currently has zero queued HTTP requests but 360 recent stored HTTP responses; Supabase documents that dropping/recreating `pg_net` to change its schema deletes those response records. Do not move/recreate it until those records are no longer needed or have been safely preserved. The advisor does not currently report the private Google tables as exposed.
- The legacy `translate-activities` Edge Function has been retired and replaced with an HTTP 410 response. The app source and tests contain no active translation feature or OpenAI integration. Remove any unused `OPENAI_API_KEY` secret from Supabase after confirming no other service uses it.

## Data deletion

The in-app deletion function revokes the stored Google access token on a best-effort basis, deletes the user's FlowOS commitments, Google connection/calendar/task-list records, push tokens, private Google OAuth/sync-state rows, and then deletes the Supabase Auth user. The external page provides an email-based request route without requiring app installation. The external request is manually verified and processed; do not describe it as immediate self-service deletion.


## Exact entry sequence in Play Console

Open **FlowOS → Policy and programs → App content → Data safety → Start**.

1. **Data collection and security**
   - Does the app collect or share required user data types? **Yes**
   - Is all collected user data encrypted in transit? **Yes**, provided the final production AAB and all production endpoints are still using HTTPS/TLS.
   - Does the app provide a way for users to request deletion of their data? **Yes**.

2. **Data types**
   Select exactly the six rows listed above:
   - Personal info → Name
   - Personal info → Email address
   - Personal info → User IDs
   - App activity → Other user-generated content
   - Calendar → Calendar events
   - Device or other IDs → Device or other IDs

3. **Data usage and handling**
   For each selected data type, choose:
   - **Collected**, not Shared, applying the service-provider and user-initiated-transfer exceptions described above.
   - **Not processed ephemerally**: these records/tokens are stored for the service, rather than used only in memory for a single request.
   - Name, Email address and User IDs: **Data collection is required**; purposes **Account management** and **App functionality**.
   - Other user-generated content: **Users can choose whether this data is collected**; purpose **App functionality**.
   - Calendar events: **Users can choose whether this data is collected** by connecting Google; purpose **App functionality**.
   - Device or other IDs: **Users can choose whether this data is collected** by granting notification permission; purpose **App functionality**.

4. **Data deletion questions**
   - In-app account deletion: **Yes**.
   - External account deletion web resource: **Yes**.
   - Web URL: `https://getflowos.netlify.app/delete-account/`.
   - Describe the external path accurately: a user can submit a request by email without reinstalling or signing into the app; the request is manually verified and processed.

5. Save as **Draft** first. Review the Store listing preview and confirm that it does not show unexpected shared data types. Do not submit until the final AAB, the live legal pages and the Google OAuth production configuration have been checked.

Other Console locations:
- Privacy policy URL: **Policy and programs → App content → Privacy policy** → `https://getflowos.netlify.app/privacy-policy/`.
- Store listing: **Grow users → Store presence → Main store listing** (wording may vary) for title, descriptions, screenshots and icon.
- Target audience and content rating: **Policy and programs → App content**. Do not select child age groups or opt into Families unless the product is intentionally directed at children.
- Ads declaration: declare **No** only after confirming the exact production AAB has no ads or advertising SDK.
- App access: provide a dedicated reviewer Google account and instructions. Never provide a personal account or real personal data.

## Final checks before submission

1. Confirm the exact production AAB and its currently distributed predecessors. Google Play's form covers all versions still distributed across tracks.
2. Confirm the final manifest/permissions and third-party SDK behavior in the AAB.
3. Confirm the Google OAuth consent screen, scopes and account deletion flow.
4. Confirm that the public Privacy Policy and external deletion page are live and accessible without login.
5. Remove the unused OpenAI secret from Supabase after checking it is not used by another service.
6. Review the current Play Console data-type taxonomy and each optionality/sharing exception in the form.
7. Save the form as a draft first; inspect the Store listing preview before submitting.
8. Do not claim an independent security audit or certification. No such audit has been performed.
