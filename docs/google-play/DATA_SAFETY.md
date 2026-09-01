# FlowOS - proposed Google Play Data safety declaration

This document is a preparation aid. The final answers must be checked against the exact production build and the live Supabase/OpenAI/Google integrations before submission.

## Data likely collected / processed

| Play Console category | Data type | Collection | Purpose | Optional | Deletion |
|---|---|---:|---|---:|---|
| Personal info | Email address | Yes | Account creation, authentication | No | Yes |
| Personal info | User IDs | Yes | Account management and associating user data | No | Yes |
| Personal info | Name / profile information | Only if actually collected | Account/profile functionality | TBD | Yes |
| Personal info | Calendar | Yes, when Google is connected | Calendar synchronization | Yes | Yes |
| Personal info | Other user-generated content | Yes | Tasks/commitments and related user content | No | Yes |
| Location | Approximate location | Yes, when weather is requested/authorized | Weather summary | Yes | Not retained as a location profile according to the current app privacy policy |

## Third-party processing

FlowOS currently integrates with:

- Supabase for authentication and application data storage.
- Google APIs for user-authorized Calendar / Tasks synchronization.
- Open-Meteo for weather requests based on the user's location.
- OpenAI for optional AI planning when AI mode is available.

The current privacy policy states that Google OAuth tokens are stored server-side in a private database area, and that AI requests are configured with `store: false` at OpenAI. Verify these statements against the deployed backend before submission.

## Security

Declare data as encrypted in transit if all production network paths use HTTPS/TLS, which is the intended configuration.

## Data deletion

FlowOS provides an account deletion flow. Before submission, verify end-to-end that deleting an account permanently removes the user's FlowOS data, Google tokens and authentication account, as represented by the production `delete-account` function.

## Sharing vs service providers

Do not blindly mark every third-party processor as "shared". Apply Google's current Data safety definitions to each integration and verify whether a recipient is acting as a service provider / processor or whether the transfer qualifies as sharing under Play policy.

## Important final verification

Before pressing Submit in Play Console, verify the production AAB and live backend for:

1. All permissions actually present in the manifest.
2. All data sent off-device.
3. All SDKs and third-party services.
4. Whether analytics, crash reporting, push notification tokens or device identifiers are used.
5. Exact retention and deletion behavior.
6. Exact Google API scopes and data handling.
7. Whether AI functionality is enabled in the production environment.
