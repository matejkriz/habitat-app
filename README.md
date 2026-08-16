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
- **Backend databáze**: Convex
- **PWA**: Serwist

## Instalace

1. Naklonujte repozitář:

```bash
git clone https://github.com/your-org/habitat-app.git
cd habitat-app
```

2. Nainstalujte závislosti:

```bash
pnpm install
```

3. Vytvořte `.env.local` soubor:

```bash
cp .env.example .env.local
```

4. Nastavte proměnné prostředí:

```env
# Convex
CONVEX_URL="https://your-deployment.convex.cloud"

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

6. Připravte Convex deployment:

```bash
pnpm convex:dev
```

7. Spusťte vývojový server:

```bash
pnpm dev
```

Aplikace bude dostupná na [http://localhost:3000](http://localhost:3000).

## Skripty

- `pnpm dev` - Spustí vývojový server
- `pnpm build` - Vytvoří produkční build
- `pnpm start` - Spustí produkční server
- `pnpm lint` - Spustí ESLint
- `pnpm test` - Spustí testy (watch mode)
- `pnpm test:run` - Spustí testy jednou
- `pnpm convex:dev` - Spustí Convex vývojové prostředí
- `pnpm convex:deploy` - Nasadí Convex backend
- `pnpm convex:codegen` - Vygeneruje Convex typy

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
├── db.ts               # Convex kompatibilní DB vrstva
├── attendance.ts       # Business logika docházky
├── excuse.ts           # Business logika omluvenek
├── excuse-rules.ts     # Pravidla pro automatické schvalování
└── school-days.ts      # Logika školních dnů

convex/
├── schema.ts           # Convex databázové schéma
└── db.ts               # Nízkoúrovňové Convex CRUD funkce
```

## Autentizace

Aplikace používá [Clerk](https://clerk.com) pro autentizaci:

- **Email OTP**: Uživatel zadá email a obdrží jednorázový kód
- **Google OAuth**: Přihlášení přes Google účet

Uživatelé jsou při prvním přihlášení automaticky synchronizováni do databáze. Role (PARENT, TEACHER, DIRECTOR) je potřeba nastavit manuálně v datech uživatele.

## Pravidla pro omluvenky

- Omluvenka odeslaná **do 9:00 den před absencí** je automaticky schválena
- Omluvenky odeslané později jsou zaznamenány jako neomluvené
- Ředitel může kdykoliv změnit stav omluvenky

## Školní dny

- Pondělí až čtvrtek = výukové dny
- Pátek, sobota, neděle = automaticky zavřeno
- Ředitel může přidat další volné dny (prázdniny, svátky)
