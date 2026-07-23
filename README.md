# FlowOS

Prototype mobile-first per unificare task, eventi e reminder in un unico modello di **Commitment**.

## Avvio

```bash
npm install
npx expo start
```

Scansiona il QR code con Expo Go oppure avvia un emulatore Android/iOS.

## Funzioni implementate

- Home “Adesso” con singolo suggerimento prioritario
- Commitment unificati: task, eventi e reminder
- Inserimento in linguaggio naturale con classificazione locale simulata
- Piano giornaliero con elementi fissi e blocchi IA
- Inbox delle sole ambiguità
- Focus mode
- Riepilogo giornaliero automatico alle 07:30, con sincronizzazione Google e recupero se il dispositivo era spento/offline
- Completamento e rinvio
- Confidence score
- Modalità “controllo assistito”

## Limiti intenzionali dell’MVP

- Nessun backend: stato in memoria
- Nessuna autenticazione
- IA reale, notifiche, voce e sincronizzazione calendario ancora da collegare
- Il parser locale in `lib/store.ts` simula lo structured output dell’IA

## Prossima architettura consigliata

1. Supabase Auth + PostgreSQL + Row Level Security
2. Edge Function `interpret-commitment` con structured output
3. Sync Google Calendar / Microsoft 365
4. Expo Notifications per reminder locali e push
5. Persistenza offline con SQLite e coda di sincronizzazione
6. Widget e lock-screen actions tramite moduli Expo/native

## Struttura pronta per lo sviluppo

- `.env.example`: variabili per Supabase e modalità IA
- `supabase/migrations/0001_initial_schema.sql`: schema iniziale con RLS
- `.github/workflows/ci.yml`: controllo TypeScript automatico
- `docs/ROADMAP.md`: roadmap incrementale

## Repository

Codice sorgente principale di FlowOS, pubblicato sul branch `main`.
