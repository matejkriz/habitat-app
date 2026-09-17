# Zápis reportů do produkce

Použij existující rozhraní detailu dne. Nevytvářej pro běžný import nové tabulky, nenasazuj lokální Convex kód a neprováděj přímý import do tabulek, který by obešel aplikační funkci a audit.

## Cíl a přístup

- Team `matej-kriz`, projekt `habitat-app-production`, výchozí produkční deployment.
- CLI selektor vždy `--deployment matej-kriz:habitat-app-production:prod`.
- Při ověření 12. 9. 2026 se tento cíl přeložil na deployment `courteous-ox-141`. Před zápisem ověř skutečné rozlišení selektoru; změnu jména vyhodnoť podle aktuální konfigurace produkční appky, nikoli automatickým přepnutím na jiný projekt.
- Lokální `CONVEX_DEPLOYMENT` patří projektu `habitat-app`. Samotné `--prod` by vybralo produkční deployment tohoto jiného projektu. Nepřebírej ani lokální `CONVEX_URL` či vývojový secret.

Přihlášení ke Convex CLI je na tomto počítači dostupné. Neopisuj přístupový token do skillu ani do logů. Pomocí CLI lze z explicitně vybrané produkce načíst `PUSH_INTERNAL_SECRET` příkazem `env get`; spusť jej pouze v pomocném procesu se zachyceným stdout a ponech hodnotu v paměti. Nezobrazuj stdout nástrojem, nevkládej hodnotu do příkazové řádky ani ji neukládej do souboru. Produkční URL načti z metadat funkčních specifikací pro stejný selektor.

Pro samotná volání můžeš použít `ConvexHttpClient` z instalovaného balíčku `convex/browser`, s URL ověřené produkce a produkčním secretem v argumentech. Rozhraní vyžaduje aplikační secret i při administrátorském přístupu přes CLI. Pokud credentials nejsou dostupné, zachovej připravené reporty lokálně jako nezapsané a přesně popiš chybějící přístup; nezkoušej přepnout prostředí.

`recordedById` je aplikační `users.id` skutečného uživatele, který import autorizoval, s rolí `DIRECTOR`. Ověř uloženou konfiguraci proti produkčnímu uživateli. Není to Slack ID autorky, Convex `_id` ani libovolný nalezený ředitel. Pokud identitu nelze určit z již známého kontextu a účtu, vyžádej si jen toto chybějící přiřazení; nevymýšlej autora auditu.

Čtecí kontrolu cíle a aktuálního rozhraní lze provést bez nasazení:

```sh
node node_modules/convex/bin/main.js data --deployment matej-kriz:habitat-app-production:prod
node node_modules/convex/bin/main.js function-spec --deployment matej-kriz:habitat-app-production:prod
```

Nepoužívej `--push` nebo `deploy`. Starší checkout nemusí implementaci detailů dne vůbec obsahovat, i když je v produkci již nasazená. To není důvod k nasazení tohoto checkoutu.

## Existující funkce

Ověřený kontrakt:

```ts
// Čtení vrací { name, expense, report }; neexistující report je null.
client.query("db:getDayDetails", {
  secret,
  date: dateTimestamp,
  includeReport: true,
});

// Zápis vrací null; úspěch následně ověř čtením.
client.mutation("db:saveDayDetails", {
  secret,
  date: dateTimestamp,
  recordedById,
  report: combinedCleanContent,
});
```

`saveDayDetails` má nepovinné argumenty `name`, `expense`, `report`. Import posílá pouze `report` a tři povinné argumenty výše. Vynecháním `name` a `expense` zachováš existující název i náklady dne; neposílej za ně `null`. `report: null` nebo `report: ""` existující report maže a není součástí běžného importu.

Funkce sama založí či aktualizuje `dayDetails`, uloží text do `dayReports` podle shodného číselného `date` a přidá auditní záznam. V produkci je jeden výsledný report pro daný den, nikoli samostatný záznam pro každou Slack zprávu. Očištěný Markdown včetně odkazů na fotoalba zapisuj beze změny do textového pole `report`. Aplikace jej vykresluje jako Markdown; před uložením jej nepřeváděj na HTML. Původní texty, zdrojová ID, metadata médií a zdůvodnění dat ponech lokálně; nevkládej je jako JSON do textového pole `report`.

Aktuální limit reportu je `900 * 1024` bajtů UTF-8. Počítej bajty například pomocí `TextEncoder`, nikoli počet znaků. Nadlimitní text nezkracuj automaticky; ponech jej lokálně s uvedením důvodu.

## Datum musí odpovídat appce

Rozlišení slov „dnes“ a „včera“ používá Europe/Prague. Uložení dne jako číselného klíče má ale samostatnou konvenci, kterou musí dodržet import i appka.

Při ověření implementace `lib/day-details.ts` používala `parseDayDate(dateKey)` výraz `new Date(dateKey + "T00:00:00")`, tedy půlnoc v časovém pásmu serverového procesu. Funkce `saveDayDetails` timestamp sama nenormalizuje. Nepoužívej automaticky `Date.parse(dateKey)`, lokální půlnoc tohoto Macu ani půlnoc Europe/Prague.

Před prvním zápisem ověř aktuální parser, navazující převod v `lib/db.ts` a časové pásmo produkčního runtime. Porovnej výsledný timestamp s existujícími daty stejného dne, pokud jsou dostupná. Prázdná tabulka sama konvenci neprokazuje. Pokud runtime nebo převod nejde ověřit, připrav obsah lokálně a pojmenuj chybějící údaj; nehádej timestamp.

Pro potvrzený server v UTC použij `Date.UTC(rok, mesic - 1, den)`; pro potvrzený jiný runtime spočítej jeho půlnoc s příslušnými pravidly letního času. Konvenci a výsledný `dateTimestamp` ulož do stavu synchronizace. Samostatně ověř platnost kalendářního data a obousměrný převod na původní klíč dne.

## Jeden obsah pro jeden den

Pro každé datum sestav seznam všech známých místních reportů s `status: resolved`, nenulovým datem a neprázdným `content`, nejen novinek z poslední dávky. Zachovej jejich zdrojovou identitu, chronologické pořadí podle odeslání a pořadí aktivit. Spoj doplňky pomocí odstavců, bez opakování již zahrnutých úseků. Zachovej související odkazy z `content` všech částí včetně samostatných řádků s fotoalby; identickou URL v rámci dne zbytečně neopakuj a zachovej její věcný kontext. Nedělej nový souhrn a nepřidávej autorské podpisy. Vygenerovaný `title` reportu nenahrazuje `name` dne.

Neurčené a konfliktní reporty zůstanou lokálně. Nepřiřazuj je ke dni odeslání jen proto, aby šly uložit.

## Kontrola existujícího obsahu a opakování

Před každým zápisem načti den s `includeReport: true` a porovnej aktuální text, zamýšlený text a `lastVerifiedContent` z lokálního stavu pro stejný cíl a datum:

1. Stejný aktuální a zamýšlený obsah přeskoč jako již synchronizovaný. Nevytvářej zbytečný auditní záznam.
2. Při prvním importu dne bez existujícího reportu ulož připravený obsah.
3. Existující report aktualizuj automaticky jen tehdy, když přesně odpovídá poslední ověřené verzi zapsané tímto importem. Přepočítej celý obsah daného dne ze známých zdrojů; nepřilepuj novou dávku k již agregovanému textu.
4. Jiný existující obsah nebo zmizení dříve ověřeného reportu ber jako možnou ruční změnu. Zachovej jej a ulož konkrétní návrh do stavu `conflict`; automaticky jej nepřepisuj ani neobnovuj. Pokračuj nezávislými dny.
5. Bez lokální historie nikdy nepokládej rozdílný existující text za vlastnictví importu. Předchozí zdroje nejprve dohledávej; nejsou-li dostupné, ponech konflikt ke kontrole.

Funkce neobsahuje atomickou kontrolu očekávané původní verze. Čtení před zápisem a po něm není zámek; nepouštěj několik zapisujících importů současně a při zjištěné souběžné změně zastav zpracování dotčeného dne. Neprezentuj tento postup jako záruku proti souběžné editaci v appce.

U změny data již zapsaného reportu eviduj původní i nový den. Automaticky nemaž ani nestěhuj starý obsah; připrav konkrétní opravu, aby nezůstala nepozorovaná duplicita.

## Ověření a částečná selhání

Před voláním ulož záměr a výchozí stav dne lokálně. Po úspěchu načti `getDayDetails` znovu. Ověř přesnou shodu `report` včetně všech zamýšlených URL a zachování `name` a `expense`. Teprve pak zaznamenej `lastVerifiedContent`, `verifiedAt` a stav `verified`.

Při timeoutu zápisu nejdřív proveď čtení. Shodný text znamená, že se záměr už projevil; nepřidávej ho podruhé. Původní nezměněný stav dovoluje jeden opakovaný pokus. Rozdíl je konflikt, ne důvod k bezpodmínečnému přepsání. Při nedostupném čtení ponech stav `unverified`; po opakované chybě `failed` a pokračuj dalšími nezávislými dny. Tyto dny znovu prověř při příštím importu bez ohledu na kurzor Slacku.

Přímé volání Convexu neprochází Next.js server action, která volá `revalidatePath`. Zpětné čtení prokazuje uložení v databázi, nikoli okamžité překreslení již otevřené stránky. Ověřuj UI samostatně, pokud uživatel požaduje viditelnost v kalendáři.

Kontrakt byl ověřen 12. 9. 2026 proti produkčnímu `function-spec` a hlavní větvi repozitáře: [Convex funkce](https://github.com/matejkriz/habitat-app/blob/main/convex/db.ts), [validace a parser dne](https://github.com/matejkriz/habitat-app/blob/main/lib/day-details.ts), [server actions a oprávnění](https://github.com/matejkriz/habitat-app/blob/main/app/actions/day-details.ts). Při změně rozhraní ověř aktuální nasazené chování.
