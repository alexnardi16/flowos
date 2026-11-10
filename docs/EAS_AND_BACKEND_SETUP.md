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

4. Deploy the rule-based interpretation function:

```bash
supabase functions deploy interpret-commitment
```

`interpret-commitment` uses deterministic parsing rules and does not call OpenAI or another hosted AI model. No OpenAI API key or model secret is required. Google synchronization functions require the Google OAuth client secrets and the internal sync key to be configured server-side; never expose these values through an `EXPO_PUBLIC_` variable.
