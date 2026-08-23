# Habitat Docházka

Systém docházky a omluvenek pro Dětskou vzdělávací skupinu Habitat Zbraslav.

## Funkce

- **Rodič**: Přehled docházky dětí, odesílání omluvenek
- **Učitel**: Zápis denní docházky
- **Ředitel**: Správa omluvenek, volných dnů, export dat, audit log

## Technologie

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Auth**: WorkOS AuthKit (Google OAuth, Email OTP)
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

# WorkOS AuthKit (https://dashboard.workos.com)
WORKOS_CLIENT_ID="client_..."
WORKOS_API_KEY="sk_test_..."
WORKOS_COOKIE_PASSWORD="replace-with-at-least-32-random-characters"
```

Lokální `NEXT_PUBLIC_WORKOS_REDIRECT_URI` se nenastavuje. Portless ji při
každém spuštění odvodí z aktuální branche nebo worktree přes `PORTLESS_URL`.
Na Vercelu aplikace bez explicitní hodnoty použije stabilní
`VERCEL_BRANCH_URL`, případně jedinečnou `VERCEL_URL`. Pro vlastní Preview
doménu nastavte branch-specific `NEXT_PUBLIC_WORKOS_REDIRECT_URI`.

5. Nastavení WorkOS AuthKit:
   - Vytvořte projekt na [dashboard.workos.com](https://dashboard.workos.com)
   - Povolte **Magic Auth** (šestimístný e-mailový kód) a **Google OAuth**
   - Přidejte default redirect URI `https://habitat-app.localhost/callback`
   - Přidejte staging wildcard `https://*.habitat-app.localhost/callback`
   - Pro sign-out URI použijte stejné apex a wildcard adresy s cestou `/login`
   - Zkopírujte Client ID a staging API key do `.env.local`
   - Cookie heslo vygenerujte například příkazem `openssl rand -base64 32`

6. Připravte Convex deployment:

```bash
pnpm convex:dev
```

### WorkOS prostředí a Vercel

WorkOS odděluje `Staging` a `Production`. Pro lokální vývoj a Vercel Preview
používejte staging Client ID a klíč `sk_test_...`. Pro Vercel Production
použijte samostatný production Client ID, klíč `sk_live_...` a nové cookie
heslo. Tajné hodnoty nikdy necommitujte do Git repozitáře; nastavte je přímo
ve Vercel Environment Variables se správným rozsahem `Preview` nebo
`Production`.

Staging WorkOS aplikace musí povolit callback a sign-out wildcardy odpovídající
Vercel branch a deployment URL. Stabilní vlastní alias Preview branche může
místo toho použít branch-specific `NEXT_PUBLIC_WORKOS_REDIRECT_URI`.

Production prostředí ve WorkOS zapněte až ve chvíli, kdy znáte finální doménu.
V production aplikaci potom samostatně nastavte Magic Auth, Google OAuth,
délku session a následující adresy:

```text
App homepage:      https://<produkční-doména>
Initiate login:    https://<produkční-doména>/login
Redirect URI:      https://<produkční-doména>/callback
Sign-out URI:      https://<produkční-doména>/login
```

Vercel Production vyžaduje tyto WorkOS proměnné:

```env
WORKOS_CLIENT_ID="client_..."
WORKOS_API_KEY="sk_live_..."
WORKOS_COOKIE_PASSWORD="samostatný-náhodný-řetězec-minimálně-32-znaků"
NEXT_PUBLIC_WORKOS_REDIRECT_URI="https://<produkční-doména>/callback"
```

### Reprodukovatelná testovací data

Development Convex lze naplnit deterministickými testovacími uživateli, dětmi
a vazbami rodič–dítě:

```bash
pnpm seed:dev
```

Seed používá stabilní aplikační ID a záznamy aktualizuje, takže jej lze spouštět
opakovaně bez vytváření duplikátů. Pokud se testovací uživatel už přihlásil přes
WorkOS, jeho propojené WorkOS ID zůstane zachované. Mutation je interní a běžný
klient ji nemůže zavolat.

Testovací účty používají Gmail aliasy `krizmate+<role>-<jmeno>@gmail.com`:

- rodiče: Róza Rohlíková, Bedřich Bábovka, Věra Vrtulová
- učitelé: Květa Křída, Hugo Hvízd
- ředitel: Bohumil Boss

Testovací děti jsou Žofie Žížalka, Oskar Okurka, Božena Bublina, Max Mlsoun a
Tobiáš Tornádo.

V lokálním developmentu a na Preview větví `develop` a `workos` lze po přihlášení účtem
`dev@habitatzbraslav.cz` přepínat tyto seed uživatele přímo v hlavičce. Funkce
vyžaduje serverovou proměnnou `DEV_PERSONA_SWITCHER=true`, WorkOS staging klíč
a je v kódu explicitně zakázaná pro Vercel Production.

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
├── login/              # Přesměrování do WorkOS AuthKit
├── callback/           # WorkOS OAuth callback
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
├── auth.ts             # WorkOS auth helpers + DB user sync
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

Aplikace používá [WorkOS AuthKit](https://workos.com/authkit) pro autentizaci:

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
