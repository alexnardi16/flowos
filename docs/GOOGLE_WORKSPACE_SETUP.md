# Google Workspace setup for FlowOS

FlowOS already contains the database schema, Google OAuth client flow, multi-calendar/task-list UI, and the `google-workspace` Supabase Edge Function. Complete the steps below without committing secrets to GitHub.

## 1. Google Cloud project

1. Open Google Cloud Console and create or select a project for FlowOS.
2. Enable:
   - Google Calendar API
   - Google Tasks API
3. Configure the OAuth consent screen.
4. During development, add the Gmail account used for FlowOS under **Test users**.
5. Add these scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
   - `https://www.googleapis.com/auth/tasks`

## 2. OAuth client

Create an OAuth 2.0 Client ID of type **Web application**.

Add this authorized redirect URI, replacing `<PROJECT_REF>` only if the Supabase project changes:

```text
https://inifmdkbefwynupqspfr.supabase.co/auth/v1/callback
```

The current web app return URL must also be allowed in Supabase Auth URL configuration:

```text
https://alex16nardi-flowos--flowos-private.expo.app/**
```

For local development add the relevant localhost Expo URL, for example:

```text
http://localhost:8081/**
```

## 3. Supabase Auth

In Supabase Dashboard → Authentication → Providers → Google:

1. Enable Google.
2. Paste the Google OAuth Client ID.
3. Paste the Google OAuth Client Secret.
4. Save.

In Authentication → URL Configuration:

- set the production site URL to the deployed FlowOS URL;
- add production and local redirect URLs.

## 4. Edge Function secrets

In Supabase Dashboard → Edge Functions → Secrets, add:

```text
GOOGLE_CLIENT_ID=<same Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<same Google OAuth client secret>
```

Do not prefix these variables with `EXPO_PUBLIC_`. They must remain server-only.

The function already receives `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Supabase.

## 5. First connection

1. Open FlowOS in a private/incognito window.
2. Select **Continua con Google**.
3. Approve Calendar and Tasks access.
4. Open **Io → Google Workspace**.
5. Confirm that personal and shared calendars are listed.
6. Enable the calendars to synchronize.
7. Choose a writable calendar as default.
8. Choose a default Google Tasks list.
9. Press **Sincronizza ora**.

A calendar shared with another person is imported whenever it appears in the signed-in account's Google Calendar list. FlowOS can create/update events only when Google reports access role `writer` or `owner`.

## 6. Verification checklist

- Create an event in the personal calendar from FlowOS.
- Create an event in the shared calendar from FlowOS.
- Edit both events in Google Calendar, then press **Sincronizza ora** in FlowOS.
- Create and complete a task in FlowOS.
- Edit and delete a task in Google Tasks, then synchronize.
- Change the default calendar and verify that the next event preselects it.
- Change the destination manually before creating another event/task.

## Security notes

- Never share a Google password, OTP, refresh token, OAuth secret, or Supabase service-role key.
- OAuth tokens are stored in the private Postgres schema and are not exposed through the Data API.
- Public Google metadata tables use row-level security bound to `auth.uid()`.
- The OTP login remains available as a recovery path; it does not automatically grant Calendar/Tasks access.
