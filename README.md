# FlowOS

FlowOS è un'app mobile-first che unifica task, eventi e reminder in un unico modello di **Commitment**.

## Stato del progetto

La codebase è in fase di preparazione alla prima release Android **1.0.0**.

### Funzioni attualmente implementate

- Home “Adesso” con suggerimento prioritario
- Commitment unificati: task, eventi e reminder
- Inserimento in linguaggio naturale
- Piano giornaliero con elementi fissi e blocchi IA
- Inbox delle ambiguità
- Focus mode
- Riepilogo giornaliero automatico alle 07:30
- Sincronizzazione Google Calendar e Google Tasks
- Completamento e rinvio
- Confidence score
- Controllo assistito
- Autenticazione Supabase
- Persistenza PostgreSQL con Row Level Security
- Notifiche e reminder locali
- Background tasks
- Widget Android
- Meteo basato sulla posizione, solo quando autorizzato
- Eliminazione definitiva dell'account e dei dati associati
- Privacy policy e pagina pubblica di eliminazione account

## Stack

- Expo SDK 57 / React Native 0.86
- TypeScript
- Expo Router
- Supabase Auth + PostgreSQL + Edge Functions
- Google Calendar / Google Tasks
- EAS Build / EAS Update
- GitHub Actions

## Sviluppo locale

```bash
npm install
npx expo start
```

Per la validazione completa:

```bash
npm run typecheck
npm test
npx expo export --platform web
```

## Android production

Il profilo EAS `production` genera un **Android App Bundle (AAB)** ed usa credenziali remote e auto-incremento del `versionCode`. Il workflow GitHub Actions dedicato alla release costruisce l'AAB quando viene pubblicato un tag/release di versione.

Prima della pubblicazione su Google Play devono essere completati anche i controlli esterni al repository: test del binario su dispositivo Android, configurazione/verifica Google OAuth, Play Console Data Safety e store listing, privacy policy pubblicamente raggiungibile e, quando applicabile, closed testing richiesto da Google Play.

## Privacy e account deletion

- Privacy policy in-app: `/privacy-policy`
- Account deletion: `/delete-account`
- URL pubblico previsto per la cancellazione: `https://getflowos.netlify.app/delete-account`

## CI/CD

- `.github/workflows/ci.yml`: typecheck, test e validazione web
- `.github/workflows/eas-build.yml`: build EAS di sviluppo/preview
- `.github/workflows/eas-production-build.yml`: build production
- `.github/workflows/eas-update.yml`: EAS Update
- `.github/workflows/eas-web-preview.yml`: preview web
- `.github/workflows/release-aab.yml`: build e allegato AAB per release Android
- `.github/workflows/supabase-deploy.yml`: deploy Supabase

## Repository

Codice sorgente principale di FlowOS, pubblicato sul branch `main`.
