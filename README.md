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
3) W Build Command dodaj migracje:
```bash
npm run db:deploy && npm run build
```
4) Deploy.

## Rozwoj
- Plik schematu bazy: `prisma/schema.prisma`
- API:
  - `GET /api/inventory`
  - `POST /api/inventory/adjust`
  - `GET /api/shipments`
  - `POST /api/shipments`
