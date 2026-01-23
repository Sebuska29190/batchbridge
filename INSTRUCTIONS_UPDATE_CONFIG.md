# Instrukcje aktualizacji minikit.config.ts z credentials

Po wygenerowaniu `accountAssociation` credentials z Base Build Account association tool, musisz zaktualizować plik `minikit.config.ts`.

## Krok 1: Otwórz plik konfiguracyjny

Otwórz plik: `minikit.config.ts`

## Krok 2: Znajdź sekcję accountAssociation

Znajdź następujący fragment kodu:

```typescript
export const minikitConfig = {
  accountAssociation: {
    // To będzie dodane w kroku 5 po wygenerowaniu credentials
    "header": "",
    "payload": "",
    "signature": ""
  },
  // ... reszta konfiguracji
}
```

## Krok 3: Wprowadź wygenerowane credentials

Zastąp puste stringi wartościami wygenerowanymi przez Base Build Account association tool:

```typescript
export const minikitConfig = {
  accountAssociation: {
    "header": "WSTAW_TUTAJ_WYGENEROWANY_HEADER",
    "payload": "WSTAW_TUTAJ_WYGENEROWANY_PAYLOAD", 
    "signature": "WSTAW_TUTAJ_WYGENEROWANY_SIGNATURE"
  },
  // ... reszta konfiguracji pozostaje bez zmian
}
```

## Przykład z rzeczywistymi danymi:

```typescript
export const minikitConfig = {
  accountAssociation: {
    "header": "eyJmaWQiOjE3MzE4LCJ0eXBlIjoiY3VzdG9keSIsImtleSI6IjB4NzYwQjA0NDc5NjM4MTExNzNmRjg3YjAzYzA5OEJBQ0YxNzNCYkU0OCJ9",
    "payload": "eyJkb21haW4iOiJ4LWl0bGlzdC1xcy52ZXJjZWwuYXBwIn0",
    "signature": "0xf4d37c6998420d3ceeca3b89ec2d2009920108ea51eab76027d22c505a7221f654bbdefd44d09cbcc66b67f4ff2ff8f345c85f6d7e5c7279cf0f8e068633acf1b"
  },
  miniapp: {
    // ... reszta konfiguracji
  },
} as const;
```

## Krok 4: Zaktualizuj również .well-known/farcaster.json

Po zaktualizowaniu `minikit.config.ts`, musisz również zaktualizować manifest w `.well-known/farcaster.json`.

Możesz to zrobić na dwa sposoby:

### Opcja A: Ręczna aktualizacja

Otwórz plik `.well-known/farcaster.json` i zaktualizuj sekcję `accountAssociation`:

```json
{
  "accountAssociation": {
    "header": "SAMA_WARTOŚĆ_CO_W_minikit.config.ts",
    "payload": "SAMA_WARTOŚĆ_CO_W_minikit.config.ts",
    "signature": "SAMA_WARTOŚĆ_CO_W_minikit.config.ts"
  },
  "frame": {
    // ... reszta pozostaje bez zmian
  }
}
```

### Opcja B: Użyj skryptu generowania manifestu

Jeśli zainstalowałeś zależności, możesz uruchomić:

```bash
npm install
npm run generate-manifest
```

Skrypt automatycznie wygeneruje plik `.well-known/farcaster.json` na podstawie `minikit.config.ts`.

## Krok 5: Sprawdź poprawność formatu

Upewnij się, że:
1. Wartości są dokładnie takie same jak wygenerowane (bez dodatkowych spacji)
2. Cudzysłowy są poprawnie zamknięte
3. Nie ma błędów składniowych TypeScript

## Krok 6: Weryfikacja lokalna

Przed wdrożeniem możesz sprawdzić czy konfiguracja jest poprawna:

```bash
npx tsc --noEmit minikit.config.ts
```

Jeśli nie ma błędów, konfiguracja jest poprawna.

## Uwaga:

- **Nie udostępniaj** swoich credentials publicznie (nie commitować do publicznego repo bez zabezpieczeń)
- Po wdrożeniu credentials będą publicznie dostępne w manifestcie
- Jeśli potrzebujesz zmienić powiązane konto, musisz wygenerować nowe credentials