# EAS and backend deployment

## EAS project link

The repository is configured for EAS Build and EAS Update. The first authenticated setup must be run by an Expo account owner:

```bash
npm install
npx eas login
npx eas init
npx eas update:configure
```

After `eas init`, Expo writes `expo.extra.eas.projectId` and `expo.updates.url` into the app configuration. Commit those generated values.

## Preview build

Native calendar access and remote push notifications require a development or preview build rather than Expo Go.

```bash
npx eas build --profile preview --platform android
```

## Publish an update

```bash
npx eas update --channel preview --message "FlowOS preview" --environment preview
```

## Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/0001_initial_schema.sql` in the SQL editor or with the CLI.
3. Set app variables:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

4. Set the server-side secret and deploy the Edge Function:

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_MODEL=gpt-5-mini
supabase functions deploy interpret-commitment
```

The OpenAI key must never be exposed through an `EXPO_PUBLIC_` variable.
