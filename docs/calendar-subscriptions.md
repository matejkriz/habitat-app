# Odběry kalendářů

Pod kalendářem rodičů i zaměstnanců je možnost **Odebírat v mém kalendáři**.
Po zobrazení odkazů si lze přidat dva společné kalendáře pouze pro čtení:

- **Habitat**: názvy programu dne a mimořádná uzavření z `closedDays`.
- **Habitat jídelníček**: skutečně objednaná jídla uložená synchronizací v aplikaci.

Události jsou celodenní, bez alarmů a neblokují čas jako zaneprázdněný.
Export zahrnuje posledních 90 dní a následujících 548 dní, bez ohledu na měsíc
otevřený v aplikaci. Neobsahuje docházku, děti, omluvenky, počty porcí,
finance ani učitelské reporty. Změny se projeví při dalším načtení odběru;
interval řídí kalendářová služba. Odběr není určen pro naléhavá upozornění.

## Odkazy a přístup

`GET /api/calendars/<token>/habitat.ics` a `.../jidelnicek.ics` vrací iCalendar.
Google a Outlook používají HTTPS adresu, Apple lze otevřít přes `webcal:`.
Jde o odběr URL; jednorázový import staženého souboru nepřebírá budoucí změny.

Každý uživatel má vlastní dvojici odkazů, ale obsah je společný pro Habitat.
Držitel odkazu smí číst daný feed bez WorkOS session. Odkazy se nevytvářejí
při pouhém renderování stránky a nejsou ukládány do browser storage.
Obnovení zneplatní oba předchozí odkazy; uživatel si musí odběry přidat znovu.
Zneplatnění nebo odstranění uživatele zastaví další načítání. Dříve stažené
události může být potřeba odstranit v klientovi.

V `calendarSubscriptions` je náhodný nonce, SHA-256 hash tokenu a účelový
HMAC identifikátor podpisového klíče. Token se
odvozuje HMAC-SHA256 z nonce a stávajícího serverového `PUSH_INTERNAL_SECRET`
s odděleným účelovým prefixem. Není potřeba nová proměnná. Secret se do URL
ani klienta neposílá. Změna tohoto interního secretu zneplatní původní odkazy;
při dalším zobrazení odběrových odkazů se automaticky vytvoří nová dvojice.
Odběrové URL jsou přístupové údaje: nevkládat do sdílených logů nebo reportů.

## Publikování a výpadky

Při autorizovaném načtení Convex transakce sestaví aktuální snapshot a v
`calendarFeedEvents` uchová pouze publikovaná pole, revizi a případné zrušení.
Původní data nemění. Zrušení již publikované události se vrací pod stejným UID
s `STATUS:CANCELLED` a vyšší `SEQUENCE`; návrat programu obnoví stejné UID.
Úprava finance nebo počtu jídel nezvyšuje revizi. Záznamy mimo exportované
období se nevracejí; historie publikovaných revizí zůstává uložená.

Autorizace se kontroluje i před `304 Not Modified`, veřejná CDN cache se
nepoužívá. Výpadek vrací `503` s možností opakování, nikdy úspěšný prázdný
kalendář. Endpoint má samostatnou výjimku z WorkOS login redirectu a povoluje
pouze oba známé typy kalendáře.

Nasazení používá běžný `pnpm build:vercel`, který nejprve nasadí Convex schema
a funkce do odpovídajícího prostředí. Develop a produkce mají oddělené tokeny
i zdrojová data. Samostatný cron nebo Google účet není potřeba.
