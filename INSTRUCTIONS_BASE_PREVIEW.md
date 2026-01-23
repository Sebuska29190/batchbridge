# Instrukcje testowania w base.dev/preview

Po wdrożeniu zmian na produkcję, przetestuj swoją aplikację w Base Preview tool.

## Krok 1: Otwórz Base Preview

Przejdź do: **https://base.dev/preview**

## Krok 2: Dodaj URL aplikacji

W polu "Enter your app URL" wprowadź:
```
https://batchbridge.vercel.app
```

Kliknij "Preview" lub naciśnij Enter.

## Krok 3: Przejrzyj zakładki

Base Preview ma kilka zakładek do weryfikacji:

### Zakładka "Preview"
- **Podgląd embed**: Zobacz jak Twoja aplikacja będzie wyglądać jako embed w Farcaster
- **Launch button**: Kliknij "Launch" aby otworzyć aplikację w podglądzie
- **Sprawdź czy**: 
  - Obrazy ładują się poprawnie (icon, hero)
  - Tytuł i opis są poprawne
  - Aplikacja uruchamia się bez błędów

### Zakładka "Metadata"
- **Weryfikacja manifestu**: Sprawdź czy wszystkie pola manifestu są poprawnie wczytane
- **Sprawdź czy nie ma brakujących pól**: 
  - `name`, `iconUrl`, `homeUrl` - wymagane
  - `screenshotUrls`, `heroImageUrl` - zalecane
  - `description`, `subtitle` - dla lepszego UX
- **Ostrzeżenia**: Napraw wszystkie warningi dotyczące metadanych

### Zakładka "Account association"
- **Weryfikacja credentials**: Sprawdź czy `accountAssociation` credentials są poprawne
- **Status**: Powinien pokazywać "Verified" lub podobny potwierdzający status
- **Jeśli błąd**: Sprawdź czy credentials są identyczne z wygenerowanymi

### Zakładka "Frame validation" (jeśli dotyczy)
- Jeśli aplikacja ma Farcaster Frame, sprawdź walidację tutaj

## Krok 4: Testowanie uruchomienia aplikacji

1. **Kliknij "Launch"** w zakładce Preview
2. **Sprawdź czy aplikacja ładuje się poprawnie**
3. **Przetestuj podstawowe funkcje**:
   - Łączenie portfela
   - Wybór tokenów
   - Generowanie quote
   - (Opcjonalnie) testowanie transakcji

## Krok 5: Testowanie na różnych urządzeniach

Base Preview pozwala na testowanie różnych viewportów:

1. **Mobile view**: Sprawdź responsywność na mobile
2. **Desktop view**: Sprawdź wygląd na desktopie
3. **Tablet view**: Sprawdź wygląd na tablecie

## Krok 6: Sprawdzenie błędów konsoli

Otwórz DevTools (F12) i sprawdź:
1. **Console tab**: Czy są jakieś błędy JavaScript
2. **Network tab**: Czy wszystkie zasoby ładują się poprawnie
3. **CORS errors**: Czy nie ma błędów CORS przy ładowaniu manifestu

## Typowe problemy i rozwiązania:

### Problem: "Invalid manifest"
- Sprawdź czy `.well-known/farcaster.json` jest poprawnym JSON
- Sprawdź czy wszystkie wymagane pola są obecne
- Sprawdź czy URL do obrazów są dostępne

### Problem: "Account association failed"
- Sprawdź czy credentials w `minikit.config.ts` i `.well-known/farcaster.json` są identyczne
- Sprawdź czy używasz tego samego konta Farcaster co przy generowaniu
- Spróbuj wygenerować credentials ponownie

### Problem: "Images not loading"
- Sprawdź czy obrazy są dostępne pod podanymi URL
- Sprawdź rozmiary obrazów (zalecane):
  - Icon: 512x512px
  - Hero: 1200x630px  
  - Screenshot: 1080x1920px (portrait)
- Sprawdź format (PNG zalecany)

### Problem: "App not launching properly"
- Sprawdź czy główna aplikacja działa pod `https://batchbridge.vercel.app`
- Sprawdź czy nie ma błędów JavaScript
- Sprawdź czy portfel łączy się poprawnie w embed

## Krok 7: Zbierz feedback i zanotuj problemy

Podczas testowania zanotuj:
1. **Co działa dobrze**
2. **Problemy do naprawienia**
3. **Sugestie ulepszeń**
4. **Błędy w konsoli**

## Krok 8: Iteracyjne poprawki

Jeśli znajdziesz problemy:
1. **Napraw problemy** lokalnie
2. **Wdróż poprawki** na produkcję
3. **Przetestuj ponownie** w base.dev/preview
4. **Powtarzaj** aż wszystkie testy przejdą

## Krok 9: Finalna weryfikacja

Przed ogłoszeniem aplikacji jako gotowej, upewnij się że:
- ✅ Wszystkie zakładki w Base Preview pokazują "Verified" lub "Success"
- ✅ Aplikacja uruchamia się bez błędów
- ✅ Obrazy ładują się poprawnie
- ✅ Manifest jest kompletny
- ✅ Account association jest zweryfikowane

## Dodatkowe testy:

### Test na różnych przeglądarkach:
- Chrome/Chromium
- Firefox
- Safari (jeśli możliwe)

### Test z różnymi portfelami:
- MetaMask
- Coinbase Wallet
- Rabby
- Inne wspierane przez Twoją aplikację

Po pomyślnym przejściu wszystkich testów, Twoja aplikacja jest gotowa do użycia jako Base Mini App!