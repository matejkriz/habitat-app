# Prostředí a proměnné

Produkce a `develop` jsou dva samostatné bezpečnostní a datové celky. Nesmí
sdílet Convex projekt nebo data, WorkOS prostředí a uživatele, interní
tajemství, VAPID pár, cookie heslo ani Slack Incoming Webhook.

## Vercel

Každá položka se vytváří dvakrát: jednou pro `Production` a jednou jako
branch-specific `Preview (develop)`. Výjimkou je `DEV_PERSONA_SWITCHER`, který
patří pouze do `Preview (develop)`. Nepoužívejte globální `Preview` scope:
nechtěně by zpřístupnil stejné služby všem feature větvím.

| Proměnná | Vercel typ | Viditelnost v aplikaci | Scope | Poznámka |
| --- | --- | --- | --- | --- |
| `CONVEX_DEPLOY_KEY` | Sensitive | pouze build | Production / Preview (`develop`) | Unikátní deploy klíč příslušného Convex deploymentu. |
| `CONVEX_URL` | Encrypted | pouze server | Production / Preview (`develop`) | URL odpovídajícího Convex deploymentu; není credential. |
| `PUSH_INTERNAL_SECRET` | Sensitive | pouze server | Production / Preview (`develop`) | Stejná hodnota musí být jen v odpovídajícím Convex deploymentu. |
| `WORKOS_CLIENT_ID` | Encrypted | pouze server | Production / Preview (`develop`) | Client ID aplikace pro dané prostředí. |
| `WORKOS_API_KEY` | Sensitive | pouze server | Production / Preview (`develop`) | Klíč stejné WorkOS aplikace jako `WORKOS_CLIENT_ID`; `sk_live_...` v produkci, `sk_test_...` na developu. |
| `WORKOS_COOKIE_PASSWORD` | Sensitive | pouze server | Production / Preview (`develop`) | Unikátní náhodná hodnota, minimálně 32 znaků. |
| `WORKOS_AUTHKIT_DOMAIN` | Encrypted | pouze server | Production / Preview (`develop`) | HTTPS origin AuthKit domény bez cesty. |
| `MCP_RESOURCE_URL` | Encrypted | pouze server | Production / Preview (`develop`) | Přesná veřejná URL MCP endpointu; na developu `https://developapp.habitatzbraslav.cz/api/mcp`. |
| `MCP_CONFIRMATION_SECRET` | Sensitive | pouze server | Production / Preview (`develop`) | Samostatný náhodný secret, minimálně 32 znaků; nesdílet s Convexem. |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Encrypted | veřejná v browser bundlu | Production / Preview (`develop`) | Přesně `https://<doména>/callback`; změna vyžaduje nový build. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Encrypted | veřejná v browser bundlu | Production / Preview (`develop`) | Veřejná polovina unikátního VAPID páru; změna vyžaduje nový build. |
| `NEXT_PUBLIC_ATTENDANCE_CALENDAR_START_DATE` | Encrypted | veřejná v browser bundlu | Production / Preview (`develop`) | Formát `YYYY-MM-DD`; nejde o tajemství. |
| `DEV_PERSONA_SWITCHER` | Encrypted | pouze server | pouze Preview (`develop`) | Hodnota `true`; v Production proměnná vůbec nesmí existovat. |
| `SLACK_WEBHOOK_URL` | Sensitive | pouze server | Production / Preview (`develop`) | Produkce je svázaná s `#omluvenky`, develop s `#omluvenky-dev`. |

`Sensitive` je write-only i pro členy Vercel projektu. `Encrypted` je šifrované
uložení, ale člen projektu může hodnotu přečíst. Prefix `NEXT_PUBLIC_` vždy
znamená, že výsledná hodnota je po buildu veřejná bez ohledu na typ ve Vercelu.

`VERCEL_OIDC_TOKEN`, `VERCEL_URL` a `VERCEL_BRANCH_URL` spravuje Vercel; ručně
je nevytvářejte. `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY` a `VAPID_SUBJECT`
patří pouze do Convexu. `CONVEX_DEPLOYMENT` je lokální volba Convex deploymentu,
ne Vercel runtime konfigurace.

## Domény a callbacky

| Prostředí | Aplikace | WorkOS redirect | WorkOS sign-out |
| --- | --- | --- | --- |
| local | `https://habitat-app.localhost` | `https://habitat-app.localhost/callback` | `https://habitat-app.localhost/login` |
| develop | `https://developapp.habitatzbraslav.cz` | `https://developapp.habitatzbraslav.cz/callback` | `https://developapp.habitatzbraslav.cz/login` |
| production | `https://app.habitatzbraslav.cz` | `https://app.habitatzbraslav.cz/callback` | `https://app.habitatzbraslav.cz/login` |

Pro lokální worktrees zachovejte v allowlistu callback
`https://*.habitat-app.localhost/callback` a sign-out
`https://*.habitat-app.localhost/login`. Výchozí OAuth callback sdílené
Staging aplikace zůstává `https://habitat-app.localhost/callback`.

## WorkOS aplikace a pozvánky

Adresy se nastavují v **Applications → příslušná aplikace → Redirects**.
Lokální vývoj a `develop` sdílejí výchozí aplikaci **Habitat Docházka** ve
WorkOS Staging prostředí. Produkce má vlastní aplikaci v Production
prostředí. Následující tabulka uvádí kanonické cíle aplikace, které používají
odkazy z e-mailů a zahájení přihlášení.

| WorkOS nastavení | Staging, local i develop | Production |
| --- | --- | --- |
| App homepage | `https://developapp.habitatzbraslav.cz` | `https://app.habitatzbraslav.cz` |
| Initiate Login URI | `https://developapp.habitatzbraslav.cz/login` | `https://app.habitatzbraslav.cz/login` |
| User Invitation URL | Use AuthKit URL (recommended) | Use AuthKit URL (recommended) |

Lokální přihlášení předává `redirect_uri` podle aktuální Portless URL při
každém požadavku, takže se po ověření vrátí na příslušný localhost callback
z tabulky výše. Tím se nemění kanonické cíle e-mailů. Kvůli lokálnímu vývoji
nepřepisujte App homepage ani Initiate Login URI sdílené Staging aplikace na
localhost.

`WORKOS_API_KEY` a `WORKOS_CLIENT_ID` musí patřit stejné aplikaci. Podle
[dokumentace WorkOS Applications](https://workos.com/docs/authkit/applications)
pozvánka odeslaná přes API přebírá kontext aplikace z API klíče. Samotné
nastavení `WORKOS_CLIENT_ID` proto neopraví pozvánky vytvořené klíčem jiné
aplikace. Pozvánky vytvořené ručně v WorkOS dashboardu vždy používají výchozí
aplikaci prostředí, takže samy o sobě neověří nastavení API pozvánek Habitatu.

WorkOS doporučuje pro User Invitation URL výchozí hostovanou AuthKit adresu,
která obslouží přijetí pozvánky. Volba **Use AuthKit URL (recommended)** může
v přehledu zobrazovat User Invitation URL jako **Not set**; znamená to
použití výchozí adresy. Pokud je nastavena Initiate Login URI, odkaz
z pozvánky vede nejprve na ni. Ve Staging proto musí ukazovat na veřejný
develop. User Invitation URL, Initiate Login URI a OAuth callback jsou
samostatná nastavení. Viz
[WorkOS User invitation URL](https://workos.com/docs/authkit/custom-emails#set-up-your-user-invitation-url).

Nastavený přihlašovací cíl lze ověřit veřejným požadavkem
`GET https://api.workos.com/user_management/initiate_login?client_id=client_...`
s Client ID dané aplikace. Odpověď `302` musí v hlavičce `Location` obsahovat
příslušnou Initiate Login URI z tabulky. Kontrola nevyžaduje API klíč ani
osobní token pozvánky a neodesílá e-mail. Ověří přihlašovací cíl pro toto
Client ID; vazbu API klíče na aplikaci zkontrolujte samostatně v dashboardu.

Před nasazením pozvánek do dalšího prostředí zkontrolujte v příslušné WorkOS
aplikaci všechny tři hodnoty a vazbu nasazeného API klíče na Client ID. U
existující pozvánky vytvořené aplikací ověřte `accept_invitation_url` a v
odhlášeném prohlížeči zkontrolujte hostovanou stránku i cíl návratu do
Habitatu. Develop musí vracet na `developapp.habitatzbraslav.cz`, produkce na
`app.habitatzbraslav.cz`. Kvůli této kontrole nevytvářejte ani znovu
neodesílejte pozvánky skutečným rodičům. Ověření samotného `/login` nebo
lokálního emulátoru nepotvrzuje cíl odkazu v pozvánce ze skutečného WorkOS.

## MCP pro rodičovské omluvenky

Pilot na developu používá `https://developapp.habitatzbraslav.cz/api/mcp` jako
OAuth Resource Indicator i jako hodnotu `MCP_RESOURCE_URL`. Hodnota
`WORKOS_AUTHKIT_DOMAIN` pro WorkOS Staging je
`https://decent-flower-49-staging.authkit.app`. Ve WorkOS develop
prostředí v **Connect → Configuration**:

1. zapněte Client ID Metadata Document (CIMD),
2. kvůli starším klientům ponechte zapnutou i Dynamic Client Registration,
3. přidejte přesnou Resource Indicator URL MCP endpointu a nastavte ji jako výchozí.

MCP server publikuje OAuth discovery na
`/.well-known/oauth-protected-resource` a kompatibilní proxy metadat na
`/.well-known/oauth-authorization-server`. WorkOS vydává token; Habitat ověřuje
jeho podpis, issuer, audience, expiraci a scope `openid` při každém požadavku.

Pro první test přidejte vzdálený MCP server do MCP Inspectoru nebo do vývojářské
konfigurace klienta URL výše. Očekávaný průchod je:

1. klient otevře WorkOS přihlášení a souhlas,
2. `list_my_children` vrátí jen křestní jména a interní ID vlastních dětí,
3. `preview_excuse` vrátí přesný náhled a desetiminutové potvrzení,
4. po výslovném potvrzení rodiče `create_excuse` uloží dávku atomicky,
5. opakování stejného zápisu vrátí původní výsledek bez duplicit.

Pro tento pilot není potřeba samostatný skill ani klientský plugin. MCP je
společná integrační vrstva pro kompatibilní klienty; případný veřejný ChatGPT
plugin může později tento endpoint zabalit a projít publikační kontrolou.

## Convex

Každé dlouhodobé prostředí má vlastní Convex projekt. Do konkrétního deploymentu
patří `PUSH_INTERNAL_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` a
`VAPID_SUBJECT`. Vercel dostane jen odpovídající `CONVEX_DEPLOY_KEY`,
`CONVEX_URL`, interní tajemství a veřejnou polovinu VAPID páru.

Vercel spouští `pnpm build:vercel`. Je-li přítomný `CONVEX_DEPLOY_KEY`, nejprve
nasadí Convex a jeho URL předá Next.js buildu jako `CONVEX_URL`. Feature preview
bez samostatného deploy klíče backend nenasazuje a nesmí dostat produkční
proměnné.

## Slack

Moderní Slack Incoming Webhook je svázaný s kanálem při vytvoření. Kanál nelze
bezpečně přepínat polem v payloadu, proto se používají dva různé webhooky:

- `Preview (develop)` → `#omluvenky-dev`
- `Production` → `#omluvenky`

Webhooky obsahují credential a vždy musí být ve Vercelu typu `Sensitive`.

## Budoucí staging

Pro dlouhodobý staging přidejte samostatnou `staging` větev a doménu, nový
Convex projekt, vlastní WorkOS prostředí/projekt, nový interní secret, VAPID pár,
cookie heslo a Slack webhook/kanál. Ve Vercelu použijte custom environment,
pokud jej tarif podporuje; jinak branch-specific `Preview (staging)`. Staging
nesmí dostat žádnou hodnotu z developu ani produkce a používá jen deterministická
testovací data.
