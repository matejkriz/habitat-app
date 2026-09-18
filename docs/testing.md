# Praktické testování Habitatu

## Při běžném vývoji

`pnpm check` spustí typecheck, lint a Vitest. Totéž dělá GitHub workflow
`Checks` pro PR a změny na `main` / `develop`, bez přístupu k produkčním datům.
Workflow začne fungovat po pushnutí těchto souborů. Povinný status check v ochraně
branche se nastavuje zvlášť v GitHubu.

`pnpm test:coverage` vytváří report v `coverage/index.html`. Není stanovený
procentní limit: důležitější jsou konkrétní scénáře než počet vykonaných řádků.
Generované Convex soubory, konfigurace a samotné testy se nepočítají.

- Čistá pravidla: uzávěrka, překryvy omluvenek, obědy a kalendář.
- `tests/data-flows.test.ts`: skutečné serverové akce → skutečný DB adaptér →
  Convex funkce přes `convex-test`. Nahrazené je přihlášení, Next revalidace,
  Slack a HTTP transport; databázové chování, validace a dotazy běží skutečně
  v lokálním testovacím backendu. Nejde o síťový ani browser test.
- Komponenty: zachování formuláře při chybě, opakování požadavku, načítání,
  přepínání dne během zápisu a viditelná chyba místo falešně prázdného seznamu.
- Běžné fixture používají `Europe/Prague`. Test uzávěrky navíc spouští samostatné
  Node procesy v UTC i Praze, v létě, zimě a při změně času.

## Pět browser průchodů

`pnpm test:e2e` používá Chromium a skutečné serverové akce i Convex. Žádné API
se v těchto testech nemockuje. Testuje podání a schválení omluvenky včetně oběda,
uložení docházky po obnovení stránky a přiřazení dítěte rodiči s izolací rodin.
Další dva průchody ověřují příspěvek do fondu, individuální útratu a přepočet
po změně docházky i uložení učitelského reportu a jeho čtení rodičem po reloadu.
Odmítnutí rodičovského zápisu reportu navíc ověřuje integrační test přes skutečnou
serverovou akci, DB adaptér a lokální Convex.

Potřebuje **izolovaný testovací Convex**, nasazené změny tohoto checkoutu,
WorkOS staging a povolený existující přepínač vývojových identit. Testy zapisují
omluvenky, docházku a nové dítě. Nespouštět proti produkci ani sdíleným ostrým
záznamům. Použij development seed (`pnpm seed:dev`) na správném testovacím cíli.
Seed obnovuje profily a vazby, ale nemaže staré omluvenky či docházku; pro opakovaný
běh použij čistý testovací deployment nebo nové vhodné datum bez jiných omluvenek.

1. Spusť aplikaci s WorkOS staging konfigurací nebo použij její testovací Preview.
   Na Preview musí být povolen přepínač vývojových identit podle `lib/dev-persona.ts`.
2. Nainstaluj prohlížeč: `pnpm exec playwright install chromium`.
3. Ulož přihlášení přes běžný WorkOS formulář (účtem `dev@habitatzbraslav.cz`):

   ```sh
   mkdir -p .playwright
   pnpm exec playwright open --save-storage=.playwright/auth.json https://ADRESA-TESTOVACI-APLIKACE
   ```

   Po přihlášení ověř přepínač „Testovací identita“ a zavři okno. Session je tajná;
   složka `.playwright` je v `.gitignore`. Po vypršení session postup opakuj.
4. Spusť testy proti témuž originu a zvol minulý školní den bez uzavírky, bez dne
   bez oběda a bez existujících omluvenek Žofie a bez zadané výletní útraty:

   ```sh
   E2E_BASE_URL=https://ADRESA-TESTOVACI-APLIKACE \
   E2E_TEST_DATABASE=true E2E_DATE=2026-09-17 pnpm test:e2e
   ```

Testy vyžadují viditelný vývojový přepínač; nepřidávají žádnou cestu obcházející
přihlášení. Selhání ukládá screenshot a trace do ignorovaných složek. CI zatím
ověřuje, že se pět testů načte; skutečné E2E se spouští ručně s testovací session.

## Ručně po změnách přihlášení, push nebo PWA

- Přihlášení a odhlášení na telefonu; po vypršení session se lze znovu přihlásit.
- Nová omluvenka se řediteli ukáže i po obnovení stránky.
- Instalovaná PWA přijme push; kliknutí otevře omluvenky.
- Po novém nasazení jde aktualizační banner zavřít i použít k načtení nové verze.

## Co zatím není garantované

`convex-test` nenahrazuje reálnou síť ani souběh klientů na nasazeném backendu.
Neověřujeme skutečné doručení WorkOS e-mailu, Slack zprávy ani push na iOS.
Idempotence rodičovského formuláře platí při opakování stejného podání ve stejné
otevřené stránce. Změna obsahu nebo otevření nového formuláře vytvoří nové podání;
formuláře otevřené před nasazením zachovávají kompatibilitu bez této ochrany.
Neděláme plošné snapshoty UI, zátěžové testy ani rozsáhlou browser matici.

Test fondu vytváří vlastní dítě s příspěvkem 1 000 Kč, přiřazuje ho Róze a ponechá
ho v testovacích datech. Pro další běh zvol jiné datum bez výletní útraty. Test
reportu připisuje unikátní text k existujícímu testovacímu reportu.
