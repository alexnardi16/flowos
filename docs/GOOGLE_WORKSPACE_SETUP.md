# Google Workspace setup for FlowOS

FlowOS contains the database schema, Google OAuth client flow, multi-calendar/task-list UI, and the `google-workspace` Supabase Edge Function. Complete the steps below without committing secrets to GitHub.

## 1. Google Cloud project

1. Open Google Cloud Console and create or select a project for FlowOS.
2. Enable Google Calendar API and Google Tasks API.
3. Configure the OAuth consent screen and add the Gmail account used for FlowOS under **Test users** while the app is in testing.
4. Add scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar.events`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly`, `https://www.googleapis.com/auth/tasks`.

## 2. OAuth client

Create an OAuth 2.0 Client ID of type **Web application** and add:

```text
https://inifmdkbefwynupqspfr.supabase.co/auth/v1/callback
```

## 3. Supabase Auth redirect URLs

In **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**, add BOTH the web URLs and the native Android scheme:

```text
https://getflowos.netlify.app/**
flowos://**
```

The native `flowos://**` entry is essential. Without it, Google can complete authentication but Supabase falls back to the web Site URL, which opens the Netlify FlowOS page instead of returning to the installed Android app.

The exact native callback used by the current Android build is:

```text
flowos://today
```

For local web development also add the relevant localhost Expo URL, for example:

```text
http://localhost:8081/**
```

## 4. Google provider

In **Supabase Dashboard → Authentication → Providers → Google**:

1. Enable Google.
2. Paste the Google OAuth Client ID.
3. Paste the Google OAuth Client Secret.
4. Save.

## 5. Edge Function secrets

In **Supabase Dashboard → Edge Functions → Secrets**, add:

```text
GOOGLE_CLIENT_ID=<same Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<same Google OAuth client secret>
```

Do not prefix these variables with `EXPO_PUBLIC_`.

## 6. First connection

1. Open FlowOS in a private/incognito window.
2. Select **Continua con Google**.
3. Approve Calendar and Tasks access.
4. Open **Impostazioni → Google Workspace**.
5. Confirm calendars and task lists.
6. Enable the calendars to synchronize and choose defaults.
7. Press **Sincronizza ora**.

## 7. Verification checklist

- Create an event in FlowOS and verify it appears in Google Calendar.
- Edit that event in Google Calendar and synchronize.
- Create and complete a task in FlowOS.
- Edit and delete a task in Google Tasks, then synchronize.
- Create a new item independently in both FlowOS and Google with the same title/date: FlowOS must report a possible duplicate in **Controlla** rather than silently merging or deleting one.
- Modify an already-linked item independently on both sides: FlowOS must report a conflict rather than overwrite one version.
- Delete a linked item on Google while editing it in FlowOS: FlowOS must report the conflict rather than recreate or delete automatically.

## Security notes

- Never share a Google password, OTP, refresh token, OAuth secret, or Supabase service-role key.
- OAuth tokens are stored in the private Postgres schema and are not exposed through the Data API.
- Public Google metadata tables use row-level security bound to `auth.uid()`.
