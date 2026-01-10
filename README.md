# Habitat Docházka

Systém docházky a omluvenek pro Dětskou vzdělávací skupinu Habitat Zbraslav.

## Funkce

- **Rodič**: Přehled docházky dětí, odesílání omluvenek
- **Učitel**: Zápis denní docházky
- **Ředitel**: Správa omluvenek, volných dnů, export dat, audit log

## Technologie

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Auth**: Auth.js v5 (Google, Apple)
- **Databáze**: Vercel Postgres / PostgreSQL
- **ORM**: Prisma 7
- **PWA**: Serwist

## Instalace

1. Naklonujte repozitář:

```bash
git clone https://github.com/your-org/habitat-app.git
cd habitat-app
```

2. Nainstalujte závislosti:

```bash
bun install
```

3. Vytvořte `.env` soubor:

```bash
cp .env.example .env
```

4. Nastavte proměnné prostředí:

```env
# Database
DATABASE_URL="postgres://..."

# Auth.js
AUTH_SECRET="your-auth-secret"

# Google OAuth
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# Apple OAuth (optional)
AUTH_APPLE_ID="your-apple-client-id"
AUTH_APPLE_SECRET="your-apple-client-secret"
```

5. Vygenerujte Prisma klienta:

```bash
bun run db:generate
```

6. Pushněte schéma do databáze:

```bash
bun run db:push
```

7. (Volitelně) Naplňte testovacími daty:

```bash
bun run db:seed
```

8. Spusťte vývojový server:

```bash
bun run dev
```

Aplikace bude dostupná na [http://localhost:3000](http://localhost:3000).

## Skripty

- `bun run dev` - Spustí vývojový server
- `bun run build` - Vytvoří produkční build
- `bun run start` - Spustí produkční server
- `bun run lint` - Spustí ESLint
- `bun run test` - Spustí testy (watch mode)
- `bun run test:run` - Spustí testy jednou
- `bun run db:generate` - Vygeneruje Prisma klienta
- `bun run db:push` - Pushne schéma do databáze
- `bun run db:migrate` - Spustí migraci
- `bun run db:seed` - Naplní databázi testovacími daty
- `bun run db:studio` - Otevře Prisma Studio

## Struktura projektu

```
app/
├── (auth)/
│   └── login/          # Přihlašovací stránka
├── (app)/
│   ├── rodic/          # Rozhraní pro rodiče
│   │   └── omluvenka/  # Formulář omluvenky
│   ├── ucitel/
│   │   └── dochazka/   # Zápis docházky
│   └── reditel/        # Administrace
│       ├── omluvenky/  # Správa omluvenek
│       ├── volne-dny/  # Správa volných dnů
│       ├── export/     # Export dat
│       └── audit/      # Audit log
├── actions/            # Server actions
└── api/auth/           # Auth.js API routes

components/
├── ui/                 # Reusable UI komponenty
└── layout/             # Layout komponenty

lib/
├── auth.ts             # Auth.js konfigurace
├── db.ts               # Prisma klient
├── attendance.ts       # Business logika docházky
├── excuse.ts           # Business logika omluvenek
├── excuse-rules.ts     # Pravidla pro automatické schvalování
└── school-days.ts      # Logika školních dnů

prisma/
├── schema.prisma       # Databázové schéma
└── seed.ts             # Testovací data
```

## Pravidla pro omluvenky

- Omluvenka odeslaná **do 9:00 den před absencí** je automaticky schválena
- Omluvenky odeslané později jsou zaznamenány jako neomluvené
- Ředitel může kdykoliv změnit stav omluvenky

## Školní dny

- Pondělí až čtvrtek = výukové dny
- Pátek, sobota, neděle = automaticky zavřeno
- Ředitel může přidat další volné dny (prázdniny, svátky)

## Testovací účty (po spuštění seed)

- **Ředitel**: betka@habitatzbraslav.cz
- **Učitel**: ucitel1@habitatzbraslav.cz
- **Rodič**: rodic1@example.com (2 děti: Anička, Tomáš)

## Licence

Proprietární - Habitat Zbraslav
