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
- **Lokální vývoj**: Portless

## Instalace

Pro lokální vývoj je potřeba Node.js 24 nebo novější.

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

# Push notifikace (veřejný VAPID klíč + sdílené serverové tajemství)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
PUSH_INTERNAL_SECRET="..."
```

5. Nastavení Clerk:
   - Vytvořte aplikaci na [dashboard.clerk.com](https://dashboard.clerk.com)
   - Povolte **Email** (s OTP) a **Google** jako metody přihlášení
   - Zkopírujte API klíče do `.env.local`

6. Připravte Convex deployment:

```bash
pnpm convex:dev
```

Pro push notifikace je navíc potřeba nastavit VAPID klíče a stejné
`PUSH_INTERNAL_SECRET` v Next.js i Convexu. Přesný postup je v
[`docs/push-notifications.md`](docs/push-notifications.md).

### Reprodukovatelná testovací data

Development Convex lze naplnit deterministickými testovacími uživateli, dětmi
a vazbami rodič–dítě:

```bash
pnpm seed:dev
```

Seed používá stabilní aplikační ID a záznamy aktualizuje, takže jej lze spouštět
opakovaně bez vytváření duplikátů. Pokud se testovací uživatel už přihlásil přes
Clerk, jeho propojené Clerk ID zůstane zachované. Mutation je interní a běžný
klient ji nemůže zavolat.

Testovací účty používají Gmail aliasy `krizmate+<role>-<jmeno>@gmail.com`:

- rodiče: Róza Rohlíková, Bedřich Bábovka, Věra Vrtulová
- učitelé: Květa Křída, Hugo Hvízd
- ředitel: Bohumil Boss

Testovací děti jsou Žofie Žížalka, Oskar Okurka, Božena Bublina, Max Mlsoun a
Tobiáš Tornádo.

V lokálním developmentu a na Preview větve `develop` lze po přihlášení účtem
`dev@habitatzbraslav.cz` přepínat tyto seed uživatele přímo v hlavičce. Funkce
vyžaduje serverovou proměnnou `DEV_PERSONA_SWITCHER=true`, Clerk development
klíče a je v kódu explicitně zakázaná pro Vercel Production.

7. Spusťte vývojový server:

```bash
pnpm dev
```

Aplikace bude dostupná na [https://habitat-app.localhost](https://habitat-app.localhost).
Při prvním spuštění může Portless vyžádat oprávnění pro instalaci lokálního HTTPS certifikátu.
V Git worktree s vlastní branchí přidá Portless název branche automaticky jako subdoménu,
například `https://fix-ui.habitat-app.localhost`.

## Skripty

- `pnpm dev` - Spustí vývojový server přes Portless
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
