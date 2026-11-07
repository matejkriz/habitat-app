# Synchronizace objednaných jídel

Convex každých 30 minut načte skutečné objednávky z eJídelníčku pro dnešek a
následujících 27 kalendářních dnů. Synchronizace je pouze čtecí: v jídelně
nevytváří, nemění ani neruší objednávky.

## Přihlašovací údaje

Údaje patří do **Convex Dashboard → příslušný deployment → Settings → Environment
Variables**. Nastavení developu a produkce je samostatné.

| Proměnná | Hodnota |
| --- | --- |
| `EJIDELNICEK_USERNAME` | Přihlašovací jméno účtu jídelny. |
| `EJIDELNICEK_PASSWORD` | Heslo stejného účtu. |
| `EJIDELNICEK_SYNC_ENABLED` | `true` pro zapnutí; ostatní hodnoty synchronizaci vypnou. |

Nejdříve nastavte jméno a heslo, potom zapněte synchronizaci. Bez zapnutí se
žádný požadavek do jídelny neposílá. Chybějící přihlašovací údaje se hlásí jako
chyba konfigurace a existující jídla zůstanou zachovaná.

Přihlašovací údaje se neukládají do repozitáře, `.env.example`, Vercelu, tabulek
aplikace ani proměnných `NEXT_PUBLIC_*`. Nevkládejte je do argumentů CLI příkazů,
argumentů Convex funkcí, komentářů nebo chatu. Interní action je čte přímo ze
serverového prostředí; plánovač předává pouze číslo pokusu. Hodnoty jsou dostupné
správcům s příslušným přístupem ke Convex deploymentu, nikoli uživatelům aplikace.

Klient přijímá přihlašovací údaje pouze v paměti. Cookies zůstávají v paměti
daného běhu. Kód nevypisuje heslo, jméno, cookies, těla HTTP odpovědí ani původní
texty síťových chyb. Při změně hesla upravte proměnnou v Convexu; další běh
už použije novou hodnotu.

## Co se přepisuje

Zdroj počtů je autentizovaná odpověď pro konkrétní den, nikoli nuly obsažené ve
veřejné měsíční nabídce. Z textů jídel se uloží polévka a skutečně objednané
varianty oběda, počet je součtem jejich porcí. Počet objednaných jídel se nadále
posílá a zobrazuje pouze řediteli.

Synchronizace mění jen jídlo a počet porcí. Název dne, útrata a učitelské reporty
zůstávají zachované. Pozdější úspěšný běh přepíše i ručně upravené jídlo nebo
počet podle skutečné objednávky; ruční změnu provedenou během načítání dat daný
běh přeskočí.

Potvrzený publikovaný den s nulovým počtem porcí uloží počet `0` a odstraní text
jídla. Nepublikovaný den se nemění. Chyba přihlášení, neúplná odpověď nebo
neplatný formát nepředstavují nulovou objednávku a nesmažou poslední platná data.

Jde o interní rozhraní webu jídelny. Změna jeho formátu může vyžadovat úpravu
klienta. Adresa jídelny je pevná HTTPS adresa; přesměrování mimo stejný origin
se odmítají.

## Kontrola běhu

Cron a jeho výsledky jsou v Convex Dashboardu. Funkce synchronizace i zápisu
jsou interní, bez veřejného endpointu. Tabulka `mealSyncState` zaznamenává čas
pokusu a posledního úspěchu, počty zpracovaných dnů a bezpečný kód poslední
chyby. Neobsahuje přihlašovací údaje ani surové HTTP odpovědi.

Kódy chyb jsou `AUTH` (přihlášení), `NETWORK` (spojení), `PROTOCOL` (formát dat),
`CONFIG` (konfigurace) a `INTERNAL` (zpracování). Síťová chyba se nejvýše dvakrát
zopakuje s odstupem jedné a pěti minut. Ostatní chyby čekají na další pravidelný
běh. Opakované načtení stejné objednávky nevytváří další auditní změny jídla.
