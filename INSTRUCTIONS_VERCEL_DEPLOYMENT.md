# Instrukcje integracji Base Mini App - Vercel Deployment

## Krok 1: Wyłączenie Deployment Protection w Vercel

Aby Base Build Account association tool mógł uzyskać dostęp do Twojego manifestu, musisz wyłączyć Deployment Protection (Vercel Authentication).

### Procedura:

1. **Zaloguj się do Vercel Dashboard** (https://vercel.com)
2. **Wybierz projekt "batchbridge"** z listy projektów
3. **Przejdź do Settings** → **Deployment Protection**
4. **Wyłącz "Vercel Authentication"**:
   - Znajdź przełącznik "Vercel Authentication"
   - Przełącz go na pozycję OFF (wyłączone)
   - Kliknij "Save" aby zapisać zmiany

### Uwaga:
- Wyłączenie Vercel Authentication pozwala Base Build Account association tool na dostęp do `.well-known/farcaster.json` bez autentykacji
- Po zakończeniu procesu association możesz ponownie włączyć ochronę

## Krok 2: Sprawdzenie czy aplikacja jest dostępna publicznie

Przed generowaniem credentials upewnij się, że:
1. Aplikacja jest wdrożona na Vercel pod adresem: `https://batchbridge.vercel.app`
2. Manifest jest dostępny pod adresem: `https://batchbridge.vercel.app/.well-known/farcaster.json`
3. Obrazy są dostępne pod:
   - `https://batchbridge.vercel.app/icon.png`
   - `https://batchbridge.vercel.app/hero.png`
   - `https://batchbridge.vercel.app/screenshot-portrait.png`

## Krok 3: Generowanie accountAssociation credentials

Po wyłączeniu Deployment Protection przejdź do:
1. **Base Build Account association tool**: https://base.org/build/account-association
2. **Wpisz App URL**: `https://batchbridge.vercel.app`
3. **Kliknij "Submit"**
4. **Podpisz manifest** zgodnie z instrukcjami
5. **Skopiuj wygenerowany `accountAssociation` object**

## Krok 4: Aktualizacja konfiguracji

Po uzyskaniu credentials:
1. Zaktualizuj `minikit.config.ts` z wygenerowanymi danymi
2. Wdróż zmiany na produkcję
3. Przetestuj w `base.dev/preview`

## Troubleshooting:

Jeśli występują problemy:
1. **403 Forbidden**: Upewnij się, że Vercel Authentication jest wyłączone
2. **404 Not Found**: Sprawdź czy `.well-known/farcaster.json` istnieje w build output
3. **CORS errors**: Sprawdź konfigurację headers w `vercel.json`