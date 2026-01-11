# Habitat Docházka

Systém docházky a omluvenek pro Dětskou vzdělávací skupinu Habitat Zbraslav.

## Funkce

- **Rodič**: Přehled docházky dětí, odesílání omluvenek
- **Učitel**: Zápis denní docházky
- **Ředitel**: Správa omluvenek, volných dnů, export dat, audit log

## Technologie

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Auth**: Clerk (Google OAuth, Email OTP)
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

3. Vytvořte `.env.local` soubor:

```bash
cp .env.example .env.local
```

4. Nastavte proměnné prostředí:

```env
# Database
DATABASE_URL="postgres://..."

# Clerk (https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"
```

5. Nastavení Clerk:

   - Vytvořte aplikaci na [dashboard.clerk.com](https://dashboard.clerk.com)
   - Povolte **Email** (s OTP) a **Google** jako metody přihlášení
   - Zkopírujte API klíče do `.env.local`

6. Vygenerujte Prisma klienta:

```bash
bun run db:generate
```

7. Pushněte schéma do databáze:

```bash
bun run db:push
```

8. (Volitelně) Naplňte testovacími daty:

```bash
bun run db:seed
```

9. Spusťte vývojový server:

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
│   └── login/          # Přihlašovací stránka (Clerk SignIn)
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
└── actions/            # Server actions

components/
├── ui/                 # Reusable UI komponenty
└── layout/             # Layout komponenty

lib/
├── auth.ts             # Clerk auth helpers + DB user sync
├── auth-utils.ts       # Role-based auth utilities
├── db.ts               # Prisma klient
├── attendance.ts       # Business logika docházky
├── excuse.ts           # Business logika omluvenek
├── excuse-rules.ts     # Pravidla pro automatické schvalování
└── school-days.ts      # Logika školních dnů

prisma/
├── schema.prisma       # Databázové schéma
└── seed.ts             # Testovací data
```

## Autentizace

Aplikace používá [Clerk](https://clerk.com) pro autentizaci:

- **Email OTP**: Uživatel zadá email a obdrží jednorázový kód
- **Google OAuth**: Přihlášení přes Google účet

Uživatelé jsou při prvním přihlášení automaticky synchronizováni do databáze. Role (PARENT, TEACHER, DIRECTOR) je potřeba nastavit manuálně v databázi nebo přes Prisma Studio.

## Pravidla pro omluvenky

- Omluvenka odeslaná **do 9:00 den před absencí** je automaticky schválena
- Omluvenky odeslané později jsou zaznamenány jako neomluvené
- Ředitel může kdykoliv změnit stav omluvenky

## Školní dny

- Pondělí až čtvrtek = výukové dny
- Pátek, sobota, neděle = automaticky zavřeno
- Ředitel může přidat další volné dny (prázdniny, svátky)

## Testovací účty (po spuštění seed)

Po spuštění seed scriptu jsou v databázi vytvořeni uživatelé s placeholder Clerk ID. Pro správné fungování je potřeba:

1. Vytvořit uživatele v Clerk dashboardu se stejnými emaily
2. Nebo upravit `clerkId` v databázi na skutečné Clerk user ID po prvním přihlášení

- **Ředitel**: krizmate@gmail.com
- **Učitel**: ucitel1@habitatzbraslav.cz
- **Rodič**: rodic1@example.com (2 děti: Anička, Tomáš)

## Licence

Proprietární - Habitat Zbraslav
