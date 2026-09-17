# Formát lokálních importů

Výchozí úložiště je `data/slack-reports/` v kořeni aktuálního checkoutu. Při vytvoření ověř vyloučení tohoto adresáře z Gitu. Neumisťuj skutečné zprávy, osobní údaje, přílohy ani album URL do verzovaných souborů skillu.

Nejdřív prohlédni existující importy a jejich manifesty. Navazuj na ně bez vytváření duplicit zpráv nebo reportů. První skutečný vzorek je v podadresáři `2026-09-12-first-import`, pokud byl do aktuálního checkoutu přenesen. Je lokální a není zaručeno, že existuje v jiném worktree.

## Soubory

- `messages.json` ukládá `{ schemaVersion: 1, messages: [...] }`. Každá zpráva má stabilní `id`, `teamId`, `channelId`, řetězcový `messageTs`, autora, `sentAt`, lokální čas, `timeZone`, nezměněný text, metadata příloh a externí odkazy. `editedAt: null` s `editedAtAvailable: false` znamená nezjištěný čas editace, nikoli potvrzení, že editace nebyla.
- `reports.json` ukládá `{ schemaVersion: 2, reports: [...] }`. Pole reportu jsou popsaná níže. Verze 2 přidala očištěný `content` a `cleaning`.
- `manifest.json` popisuje načtený rozsah podle časů odeslání, parametry dotazu, stránkování, zkontrolovaná vlákna, počty, omezení úplnosti, použitou verzi čištění a čas posledního úspěšného importu. Nenahrazuj původní rozsah novým tvrzením o úplnosti bez odpovídajícího čtení.
- `raw-channel-response.json` a `raw-thread-responses.json` jsou neupravené odpovědi konektoru. Při dalších načteních zachovej předchozí odpovědi v samostatných souborech nebo bězích s časovým označením. Formátovaná odpověď konektoru není původní Slack API JSON; metadata, která konektor nevrátil, nevymýšlej.
- `CLEANED.md` je čitelný přehled s dny a očištěnými obsahy. `IMPORT.md` z prvního vzorku uchovává přehled s originály. Aktualizuj příslušný náhled při změně dat, nevytvářej jiné verze stejného přehledu bez důvodu.

## Report

| Pole | Význam |
|---|---|
| `id` | Stabilní ID. Zachovej existující identifikátory. U nového reportu vycházej ze zdrojové zprávy; při rozdělení jedné zprávy na více reportů přidej stabilní identifikátor části. |
| `date` | Den `YYYY-MM-DD` v Europe/Prague, nebo `null`. |
| `status` | `resolved` nebo `needs_review`; stav vyřešení data, nikoli schválení člověkem. |
| `title`, `titleGenerated` | Stručný věcný název a informace, že jej vytvořil model. |
| `kind` | Například `daily_report`, `daily_supplement`, `trip_photo_report`, `multi_day_photo_collection`. |
| `content` | Očištěný obsah v Markdownu včetně souvisejících odkazů, zejména fotoalb, určený pro čtení a zápis do pole report v produkčním kalendáři. |
| `originalText` | Spojené původní texty v pořadí zdrojových zpráv. Čištění toto pole nemění. |
| `sourceMessageIds`, `sourceMessages` | ID a kopie zdrojových zpráv se zachovaným původem, autorem, textem, časy a metadaty. Při rozdělení zprávy na více dní popiš v `grouping.reason`, které úseky patří k danému reportu. |
| `externalLinks` | Metadata zachovaných odkazů, například na alba. Nenahrazují odkazy přímo v `content`. Nezaměňuj identitu alba s potvrzeným datem jeho pořízení; neurčené vazby ponech ke kontrole. |
| `dateResolution` | `method`, `timeZone`, `referenceMessageId`, `referenceSentAt`, přesné `evidence`, stručné `reason`, `humanReviewed`. |
| `grouping` | `method` a vysvětlení spojení nebo rozdělení v `reason`. |
| `notes` | Omezení a souvislosti importu, ne text pro kalendář. |
| `cleaning` | `rulesVersion: 3`, `method: codex_semantic_edit`, `humanReviewed: false` a `notes` o významově důležitých vynechaných úsecích. Existující ruční potvrzení zachovej. |

Čištění již importovaných reportů je doplnění `content` a `cleaning`. Ostatní pole zachovej, dokud úloha výslovně neřeší jejich opravu. Nejisté dřívější aktivity mohou zůstat dostupné jen v originálu s vysvětlením v poznámce; nedávej je do `content` hlavního dne.

Použij autentický permalink ze Slacku, pokud je dostupný. Pokud máš pouze sestavený navigační odkaz z ID, označ jej jako sestavený a nevydávej ho za ověřený permalink. Uchovej ID zprávy vždy.

## Opakování a opravy

Najdi existující zprávy podle stabilních ID napříč dostupnými importy. Porovnávej text i přílohy, protože čas editace nemusí být dostupný. Nezměněné zprávy nemusíš znovu interpretovat. Při novém kontextu, úpravě zdroje nebo pravidel čištění přepočítej pouze dotčené reporty.

Verze čištění 2 zachovává související odkazy také v `content`; verze 3 přidává Markdownové odkazy a členění pro čitelnost. Při příštím importu v požadovaném období zkontroluj i reporty čištěné starší verzí, přestože Slack zdroj zůstal nezměněný. Chybějící odkazy obnov z originálů a `externalLinks` podle doložené vazby ke dni; ostatní věcný obsah zachovej a přeformátuj podle aktuálních pravidel Markdownu. Změnu zahrň do běžné synchronizace s kontrolou konfliktů. Samotná úprava skillu data ani produkci nemění. `lastVerifiedContent` ponech beze změny až do ověřeného zápisu nového obsahu.

Ruční změny a potvrzení mají přednost před opakovaným automatickým zpracováním. Jestliže změna zdroje odporuje ruční opravě, uchovej stávající hodnotu a zvlášť návrh s důvodem ke kontrole. ID se nemění jen kvůli opravě data.

Zkontroluj, že opakovaný import stejného vstupu nevytváří nové reporty. U jednoho reportu z více zpráv ověř úplnost všech zdrojových částí. U jedné zprávy rozdělené do více dní ověř, že se konkrétní aktivita neduplikuje a nespadla do nesprávného dne.

## Stav produkční synchronizace

Sdílený `data/slack-reports/production-sync.json` eviduje stav podle cílového deploymentu a dne. Udržuj jej odděleně od kurzoru čtení Slacku, aby částečně neúspěšný zápis šel zopakovat bez nových zpráv.

Ulož `schemaVersion`, přesný `deploymentSelector`, ověřený `deploymentName`, konvenci timestampu dne a ověřené `recordedById`. Pro každý den uchovej lokální `date`, odeslaný `dateTimestamp`, ID zahrnutých reportů a zdrojových zpráv, zamýšlený čistý obsah, stav a případné vysvětlení chyby. Až po zpětném načtení ulož `lastVerifiedContent` a `verifiedAt`. Stavy rozlišuj jako `pending`, `verified`, `conflict`, `failed` a `unverified`. Neznámý výsledek volání není potvrzený neúspěch ani úspěch.

Více lokálních reportů jednoho dne může odpovídat jedinému produkčnímu textu. Ve stavu zachovej jejich seznam; datum není náhrada za zdrojovou identitu. Ve sdíleném stavu ani ve skillu neukládej přístupové tokeny nebo `PUSH_INTERNAL_SECRET`. Postup řešení shody, změn a konfliktů je v [production-sync.md](production-sync.md).
