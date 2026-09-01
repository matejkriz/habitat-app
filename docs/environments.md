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
| `WORKOS_CLIENT_ID` | Encrypted | pouze server | Production / Preview (`develop`) | Client ID samostatného WorkOS prostředí. |
| `WORKOS_API_KEY` | Sensitive | pouze server | Production / Preview (`develop`) | `sk_live_...` v produkci, `sk_test_...` na developu. |
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
| develop | `https://developapp.habitatzbraslav.cz` | `https://developapp.habitatzbraslav.cz/callback` | `https://developapp.habitatzbraslav.cz/login` |
| production | `https://app.habitatzbraslav.cz` | `https://app.habitatzbraslav.cz/callback` | `https://app.habitatzbraslav.cz/login` |

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
