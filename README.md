# Plugi Tracker

Prosta aplikacja webowa do kontroli stanu magazynowego plugow snieznych i rejestru wysylek do klientow.

## Funkcje
- Stany magazynowe po zlozeniu dla modeli FL 540, FL 470, FL 400, FL 340, FL 260
  z numerem (np. 2716) i wariantami: ocynk, pomaranczowy, Schwenkbock.
- Reczne korekty stanu (+/-).
- Rejestr wysylek z minimalnymi danymi adresowymi.
- Interfejs w PL i DE (przelacznik w naglowku).

## Wymagania
- Node.js 20+
- npm
- Konto i baza PostgreSQL (np. Neon, Supabase, Render)

## Konfiguracja lokalna
1) Zainstaluj paczki:
```bash
npm install
```

2) Utworz plik `.env` i wpisz polaczenie do bazy:
```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME?schema=public"
```

3) Utworz tabele w bazie:
```bash
npm run db:migrate
```

4) Uruchom aplikacje:
```bash
npm run dev
```

Strona bedzie dostepna pod `http://localhost:3000`.

## Deploy (Vercel)
1) Polacz repo z Vercel.
2) Ustaw zmienna `DATABASE_URL` w ustawieniach projektu.
3) (Opcjonalnie) Ustaw zmienna `REVIEW_TOKEN`, aby wlaczyc link tylko do podgladu.
3) W Build Command dodaj migracje:
```bash
npm run db:deploy && npm run build
```
4) Deploy.

## Link podgladu (read-only)
Po ustawieniu `REVIEW_TOKEN` w Vercel:

```
https://TWOJA-DOMENA/review?token=REVIEW_TOKEN
```

Uzytkownik musi sie zalogowac przez `/login`, ale nie ma mozliwosci edycji.

## Role aplikacji (poza /admin)
Ustaw nowe zmienne srodowiskowe:
- `VIEWER_PASSWORD` (tylko podglad + push)
- `EDITOR_PASSWORD` (edycja + push)

Logowanie:
- `/viewer` (VIEWER)
- `/editor` (EDITOR)

API ról:
- `POST /api/role-login`
- `POST/GET /api/role-logout`
- `GET /api/role/me`

## Rozwoj
- W zakladce `/sent` dostepne sa kompaktowe raporty PDF: gotowe (READY), wyslane (SENT) i laczny. Jezyk PDF wybiera sie osobno (Polski / Deutsch). Lista zawiera tylko firme, adres i plugi w formacie `FL 540 2716-744` (model, nr produktu, Bau-Nr); ilosc wieksza od 1 jest dopisana przy plugu. Raport uwzglednia filtry firmy i Bau-Nr; pomija rezerwacje i zamowienia samych czesci. Nie drukuje wezy, dodatkow ani uwag.
- Test i przykladowe PDF bez bazy danych: `node scripts/check-shipments-pdf.cjs <katalog-wyjscia>`.
- BOM 8/3: w `/admin` znajduje sie osobna sekcja z jedna receptura, bez wariantow kolorystycznych. Uzupelnij czesci i ilosci przed oznaczeniem zamowienia z zaworem 8/3 jako READY. Receptura 8/3 jest niezalezna od 6/2.
- Przy wdrozeniu obslugi 8/3 uruchom `npm run db:deploy` przed uruchomieniem nowej wersji aplikacji.
- Test rozliczania BOM zaworow bez bazy danych: `node scripts/check-valve-bom.cjs`.
- Plik schematu bazy: `prisma/schema.prisma`
- API:
  - `GET /api/inventory`
  - `POST /api/inventory/adjust`
  - `GET /api/shipments`
  - `POST /api/shipments`
