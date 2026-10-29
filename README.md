# Habitat Docházka

Systém docházky a omluvenek pro Dětskou vzdělávací skupinu Habitat Zbraslav.

## Funkce

- **Rodič**: Přehled docházky dětí, odesílání omluvenek
- **Učitel**: Zápis denní docházky
- **Ředitel**: Správa dětí a rodičů, e-mailové pozvánky rodičům, správa omluvenek, volných dnů, export dat, audit log

## Technologie

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS v4
- **Auth**: WorkOS AuthKit (Google OAuth, Email OTP)
- **Backend databáze**: Convex
- **PWA**: Web App Manifest, Web Push
- **Lokální vývoj**: Portless

## Instalace

Pro lokální vývoj je potřeba Node.js 24 nebo novější.

1. Naklonujte repozitář:

```bash
git clone https://github.com/matejkriz/habitat-app.git
cd habitat-app
```

2. Nainstalujte závislosti:

```bash
pnpm install --frozen-lockfile
```

3. Vytvořte `.env.local` soubor:

```bash
cp .env.example .env.local
```

4. Nastavte proměnné prostředí:

```env
# Convex — záměrně bez NEXT_PUBLIC_ prefixu, viz „Přístup k databázi" níže
CONVEX_URL="https://your-deployment.convex.cloud"

# WorkOS AuthKit (https://dashboard.workos.com)
WORKOS_CLIENT_ID="client_..."
WORKOS_API_KEY="sk_test_..."
WORKOS_COOKIE_PASSWORD="replace-with-at-least-32-random-characters"

# Sdílené tajemství mezi Next.js a Convexem (viz „Přístup k databázi")
PUSH_INTERNAL_SECRET="..."

# Push notifikace (veřejný VAPID klíč)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."

# Slack Incoming Webhook pro vývojový kanál
SLACK_WEBHOOK_URL="..."
```

### Přístup k databázi

Convex publikuje každý `query`/`mutation` export jako veřejný HTTP endpoint —
přihlášení v Next.js vrstvě je nechrání. Každá veřejná funkce proto vyžaduje
`PUSH_INTERNAL_SECRET` a ověřuje ho přes `convex/serverSecret.ts`. Tajemství
musí být nastavené **shodně v Next.js i v Convex deploymentu**; bez něj
neprojde žádné čtení ani zápis. (Název proměnné je historický — dnes chrání
veškerý přístup k datům, nejen push notifikace.)

Autorizace na úrovni rolí a vazby rodič–dítě zůstává v Next.js vrstvě; tajemství
jen dokazuje, že volání přišlo z našeho serveru. `CONVEX_URL` proto nikdy
nenastavujte s prefixem `NEXT_PUBLIC_` — URL deploymentu by skončila
v klientském bundlu.

Invariant hlídá test `convex/public-function-auth.test.ts`.

Lokální `NEXT_PUBLIC_WORKOS_REDIRECT_URI` se nenastavuje. Portless ji při
každém spuštění odvodí z aktuální branche nebo worktree přes `PORTLESS_URL`.
Na Vercelu aplikace bez explicitní hodnoty použije stabilní
`VERCEL_BRANCH_URL`, případně jedinečnou `VERCEL_URL`. Pro vlastní Preview
doménu nastavte branch-specific `NEXT_PUBLIC_WORKOS_REDIRECT_URI`.

5. Nastavení WorkOS AuthKit:
   - Vytvořte projekt na [dashboard.workos.com](https://dashboard.workos.com)
   - Ve Staging prostředí otevřete sdílenou aplikaci **Habitat Docházka** v **Applications**
   - Povolte **Magic Auth** (šestimístný e-mailový kód) a **Google OAuth**
   - Pro sdílenou Staging aplikaci ponechte App homepage `https://developapp.habitatzbraslav.cz` a Initiate Login URI `https://developapp.habitatzbraslav.cz/login`, i při lokálním vývoji
   - Ponechte default redirect URI `https://habitat-app.localhost/callback`
   - Přidejte staging wildcard `https://*.habitat-app.localhost/callback`
   - Pro sign-out URI použijte stejné apex a wildcard adresy s cestou `/login`
   - V **Applications → Habitat Docházka → Redirects** ponechte User Invitation URL na **Use AuthKit URL (recommended)**
   - Zkopírujte Client ID a staging API key této stejné aplikace do `.env.local`
   - Cookie heslo vygenerujte například příkazem `openssl rand -base64 32`

6. Připravte Convex deployment:

```bash
pnpm convex:dev
```

### WorkOS prostředí a Vercel

WorkOS odděluje `Staging` a `Production`. Lokální vývoj a `develop` sdílejí
výchozí aplikaci **Habitat Docházka** ve Staging prostředí. Pozvánky z API
přebírají kontext aplikace z použitého API klíče. `WORKOS_API_KEY` proto musí
patřit ke stejné aplikaci jako `WORKOS_CLIENT_ID`. Pro Vercel Production
použijte samostatný production Client ID, klíč `sk_live_...` a nové cookie
heslo. Tajné hodnoty nikdy necommitujte do Git repozitáře; nastavte je přímo
ve Vercel Environment Variables se správným rozsahem `Preview` nebo
`Production`.

Ve sdílené Staging aplikaci musí App homepage ukazovat na
`https://developapp.habitatzbraslav.cz` a Initiate Login URI na
`https://developapp.habitatzbraslav.cz/login`. Pozvánky tak vedou na veřejný
develop. Lokální přihlášení předává vlastní callback podle Portless URL při
každém požadavku. Kvůli lokálnímu vývoji proto neměňte kanonickou Initiate
Login URI zpět na localhost. Přehled adres včetně User Invitation URL je v
[`docs/environments.md`](docs/environments.md#workos-aplikace-a-pozvánky).

Staging WorkOS aplikace musí povolit callback a sign-out wildcardy odpovídající
Vercel branch a deployment URL. Stabilní vlastní alias Preview branche může
místo toho použít branch-specific `NEXT_PUBLIC_WORKOS_REDIRECT_URI`.

Při přípravě produkce ve WorkOS samostatně nastavte Magic Auth, Google OAuth,
délku session a následující adresy. Tento seznam popisuje požadovanou
konfiguraci, ne potvrzení aktuálního nastavení v dashboardu.

```text
App homepage:       https://app.habitatzbraslav.cz
Initiate Login URI: https://app.habitatzbraslav.cz/login
Redirect URI:       https://app.habitatzbraslav.cz/callback
Sign-out URI:       https://app.habitatzbraslav.cz/login
User Invitation URL: výchozí hostovaná AuthKit URL pro přijetí pozvánky
```

Vercel Production vyžaduje tyto WorkOS proměnné:

```env
WORKOS_CLIENT_ID="client_..."
WORKOS_API_KEY="sk_live_..."
WORKOS_COOKIE_PASSWORD="samostatný-náhodný-řetězec-minimálně-32-znaků"
NEXT_PUBLIC_WORKOS_REDIRECT_URI="https://app.habitatzbraslav.cz/callback"
```

`PUSH_INTERNAL_SECRET` musí být nastavené shodně v Next.js i v Convexu — bez něj
neprojde žádný přístup k databázi (viz „Přístup k databázi"). Pro push notifikace
je navíc potřeba nastavit VAPID klíče; přesný postup je v
[`docs/push-notifications.md`](docs/push-notifications.md).

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

V lokálním developmentu a na Preview větvi `develop` lze po přihlášení účtem
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
- `pnpm build:vercel` - Nasadí Convex pomocí branch-specific deploy klíče a
  vytvoří Vercel build
- `pnpm start` - Spustí produkční server
- `pnpm lint` - Spustí ESLint
- `pnpm test` - Spustí testy (watch mode)
- `pnpm test:run` - Spustí testy jednou
- `pnpm convex:dev` - Spustí Convex vývojové prostředí
- `pnpm convex:deploy` - Nasadí Convex backend; mimo Vercel vždy nejdřív
  ověřte cílový deployment
- `pnpm convex:codegen` - Vygeneruje Convex typy

Přesný seznam proměnných, jejich Vercel scope, typ a viditelnost je v
[`docs/environments.md`](docs/environments.md). Produkce a `develop` musí mít
samostatný Convex projekt, WorkOS prostředí, interní tajemství, VAPID pár i
Slack webhook. Žádná tajná proměnná se nenastavuje globálně pro více prostředí.

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

Uživatelé jsou při prvním přihlášení automaticky synchronizováni do databáze s rolí PARENT. Role TEACHER a DIRECTOR se nastavují manuálně v datech uživatele.

Ředitel může v **Správě dětí** z karty dítěte zvolit **Pozvat rodiče** a zadat jeho
e-mail. Rodičovský účet a vazba k dítěti se uloží rovnou; WorkOS odešle českou
pozvánku s platností sedm dní. Při prvním přihlášení se účet propojí podle
ověřeného e-mailu, takže rodič uvidí přiřazené dítě. Musí se přihlásit stejným
e-mailem, na který pozvánka přišla.

Opakované odeslání použije existující rodičovský účet i vazbu. Pokud odeslání
e-mailu selže, karta to oznámí a umožní pozvánku odeslat znovu. Pro pozvánky
ponechte výchozí hostovanou AuthKit URL pro přijetí pozvánky v nastavení
příslušné WorkOS aplikace. Initiate Login URI sdílené Staging aplikace musí
zůstat na veřejném developu i při lokálním vývoji. Samostatná e-mailová
služba není potřeba. Před nasazením ověřte cíl existující pozvánky podle
[`docs/environments.md`](docs/environments.md#workos-aplikace-a-pozvánky).

## Pravidla pro omluvenky

- Při požadavku na odhlášení oběda je omluvenka odeslaná **do 9:00 předchozího všedního dne (na pondělí v pátek)** automaticky schválena
- Později odeslané omluvenky s odhlášením oběda čekají na schválení ředitelem
- Rodič může oběd ponechat přihlášený; taková omluvenka schválení nepotřebuje a oběd zůstává k úhradě
- Ředitel může kdykoliv změnit stav omluvenky

## Školní dny

- Pondělí až čtvrtek = výukové dny
- Pátek, sobota, neděle = automaticky zavřeno
- Ředitel může přidat další volné dny (prázdniny, svátky)

## Testování

`pnpm check` spustí typecheck, lint a rychlé automatické testy. Praktický rozsah
pokrytí, browser průchody a nastavení testovacího prostředí popisuje
[docs/testing.md](docs/testing.md).
