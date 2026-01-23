# Instrukcje generowania accountAssociation credentials

## Wymagania wstępne:
1. ✅ Projekt wdrożony na Vercel: `https://batchbridge.vercel.app`
2. ✅ Vercel Authentication wyłączone (Deployment Protection)
3. ✅ Manifest dostępny: `https://batchbridge.vercel.app/.well-known/farcaster.json`

## Krok 1: Przejdź do Base Build Account association tool

Otwórz przeglądarkę i przejdź do:
**https://base.org/build/account-association**

## Krok 2: Wprowadź URL aplikacji

W polu "App URL" wprowadź:
```
https://batchbridge.vercel.app
```

## Krok 3: Kliknij "Submit"

Po wprowadzeniu URL kliknij przycisk **"Submit"**.

## Krok 4: Podpisz manifest

System wyświetli prośbę o podpisanie manifestu:

1. **Połącz swój portfel** (jeśli nie jest jeszcze połączony)
2. **Wybierz konto Farcaster** które chcesz powiązać z aplikacją
3. **Podpisz wiadomość** w swoim portfelu
4. **Potwierdź podpisanie** transakcji

## Krok 5: Skopiuj wygenerowane credentials

Po pomyślnym podpisaniu, zobaczysz wygenerowany obiekt `accountAssociation`:

```json
{
  "header": "eyJmaWQiOjE3MzE4LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4NzYwQjA0NDc5NjM4MTExNzNmRjg3YjAzYzA5OEJBQ0YxNzNCYkU0OCJ9",
  "payload": "eyJkb21haW4iOiJ4LWl0bGlzdC1xcy52ZXJjZWwuYXBwIn0",
  "signature": "0xf4d37c6998420d3ceeca3b89ec2d2009920108ea51eab76027d22c505a7221f654bbdefd44d09cbcc66b67f4ff2ff8f345c85f6d7e5c7279cf0f8e068633acf1b"
}
```

**WAŻNE**: Skopiuj CAŁY obiekt z dokładnie tymi samymi wartościami.

## Krok 6: Weryfikacja

Kliknij przycisk **"Verify"** który się pojawi, aby potwierdzić, że credentials zostały poprawnie wygenerowane.

## Troubleshooting:

### Problem: "Failed to fetch manifest"
- Sprawdź czy `.well-known/farcaster.json` jest dostępny publicznie
- Sprawdź czy Vercel Authentication jest wyłączone
- Sprawdź konsole przeglądarki pod kątem błędów CORS

### Problem: "Invalid signature"
- Upewnij się, że podpisałeś wiadomość właściwym kontem Farcaster
- Spróbuj ponownie z innym kontem

### Problem: "Domain verification failed"
- Upewnij się, że używasz dokładnie tego samego URL co wdrożona aplikacja
- Sprawdź czy DNS jest poprawnie skonfigurowany

## Co dalej?

Po uzyskaniu credentials:
1. Zaktualizuj `minikit.config.ts` z wygenerowanymi danymi
2. Wdróż zmiany na produkcję
3. Przetestuj w `base.dev/preview`