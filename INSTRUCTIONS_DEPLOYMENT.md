# Instrukcje wdrożenia zmian na produkcję

Po zaktualizowaniu `minikit.config.ts` z `accountAssociation` credentials, musisz wdrożyć zmiany na produkcję (Vercel).

## Krok 1: Sprawdź zmiany przed wdrożeniem

Upewnij się, że wszystkie zmiany są gotowe:

1. ✅ `minikit.config.ts` - zaktualizowany z credentials
2. ✅ `.well-known/farcaster.json` - zaktualizowany manifest (lub gotowy do wygenerowania)
3. ✅ Wszystkie nowe pliki obrazów są w `frontend/public/`

Sprawdź status zmian:
```bash
git status
```

Powinieneś zobaczyć zmodyfikowane/nowe pliki:
- `minikit.config.ts`
- `.well-known/farcaster.json` (lub skrypt do jego generowania)
- `INSTRUCTIONS_*.md` (pliki instrukcji)
- `package.json` (nowy w głównym katalogu)
- `scripts/generate-manifest.ts`

## Krok 2: Commit zmian

Dodaj zmiany do gita i zrób commit:

```bash
# Dodaj wszystkie zmienione pliki
git add .

# Zrób commit ze znaczącą wiadomością
git commit -m "feat: Add Base Mini App configuration with accountAssociation credentials"

# Lub jeśli chcesz podzielić na mniejsze commity:
git add minikit.config.ts .well-known/farcaster.json
git commit -m "feat: Update minikit.config.ts with accountAssociation credentials"
```

## Krok 3: Push do głównej gałęzi

Wypchnij zmiany do głównej gałęzi (zwykle `main` lub `master`):

```bash
git push origin main
```

## Krok 4: Monitoruj deployment na Vercel

Po pushu, Vercel automatycznie rozpocznie deployment:

1. **Otwórz Vercel Dashboard**: https://vercel.com
2. **Przejdź do projektu "batchbridge"**
3. **Sprawdź zakładkę "Deployments"**
4. **Monitoruj postęp deploymentu**

Czas deploymentu zwykle zajmuje 1-3 minuty.

## Krok 5: Weryfikacja deploymentu

Po zakończeniu deploymentu, zweryfikuj czy wszystko działa:

### Test 1: Sprawdź dostępność manifestu
Otwórz w przeglądarce:
```
https://batchbridge.vercel.app/.well-known/farcaster.json
```

Powinieneś zobaczyć poprawny JSON z `accountAssociation` credentials.

### Test 2: Sprawdź dostępność obrazów
Sprawdź czy obrazy są dostępne:
- `https://batchbridge.vercel.app/icon.png`
- `https://batchbridge.vercel.app/hero.png`
- `https://batchbridge.vercel.app/screenshot-portrait.png`

### Test 3: Sprawdź główną aplikację
Otwórz główną aplikację:
```
https://batchbridge.vercel.app
```

Upewnij się, że aplikacja działa poprawnie.

## Krok 6: (Opcjonalnie) Ponowne włączenie Deployment Protection

Jeśli chcesz zabezpieczyć swój deployment:

1. **Przejdź do Vercel Dashboard** → **Settings** → **Deployment Protection**
2. **Włącz "Vercel Authentication"** (przełącz na ON)
3. **Kliknij "Save"**

**Uwaga**: Po włączeniu Vercel Authentication, Base Build Account association tool może mieć problem z weryfikacją w przyszłości. Zostaw wyłączone jeśli planujesz częste aktualizacje manifestu.

## Troubleshooting deploymentu:

### Problem: "Build failed"
- Sprawdź logs deploymentu w Vercel
- Upewnij się, że `package.json` w głównym katalogu nie koliduje z `frontend/package.json`
- Sprawdź czy TypeScript kompiluje się poprawnie

### Problem: "Manifest not found after deployment"
- Sprawdź czy `.well-known/farcaster.json` jest w output directory
- Sprawdź konfigurację `vercel.json` - czy `headers` są poprawnie skonfigurowane
- Sprawdź czy plik został poprawnie skopiowany podczas build process

### Problem: "CORS errors"
- Sprawdź konfigurację headers w `vercel.json`
- Upewnij się, że `Access-Control-Allow-Origin` jest ustawione na `*` dla `.well-known/*`

## Krok 7: Po udanym deploymentcie

Po pomyślnym wdrożeniu:
1. **Zanotuj wersję deploymentu** z Vercel Dashboard
2. **Przetestuj w `base.dev/preview`** (następny krok)
3. **Powiadom zespół** o udanym wdrożeniu

## Automatyczne deploymenty:

Vercel automatycznie deployuje przy każdym pushu do `main`. Jeśli chcesz kontrolować kiedy deployować:
1. Użyj feature branches
2. Użyj Vercel's "Promote to Production"
3. Skonfiguruj deployment rules w Vercel Settings