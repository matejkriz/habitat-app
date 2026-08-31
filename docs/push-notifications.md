# Push notifikace

Push odběr je uložený pro konkrétního uživatele a zařízení. Typy odběrů jsou
vedené jako témata, takže lze později přidat schválení omluvenky pro rodiče nebo
hromadnou zprávu bez změny formátu zařízení.

## Konfigurace

Vygenerujte samostatný VAPID pár pro každé prostředí:

```bash
pnpm exec web-push generate-vapid-keys --json
```

Na straně Next.js nastavte:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="vygenerovaný veřejný klíč"
PUSH_INTERNAL_SECRET="dlouhá náhodná hodnota"
```

V Convex deploymentu nastavte stejný veřejný klíč a stejné interní tajemství,
plus soukromý VAPID klíč. Soukromý klíč nepatří do Next.js ani do proměnných s
prefixem `NEXT_PUBLIC_`.

```bash
pnpm exec convex env set --deployment <deployment> PUSH_INTERNAL_SECRET
pnpm exec convex env set --deployment <deployment> VAPID_SUBJECT
pnpm exec convex env set --deployment <deployment> VAPID_PUBLIC_KEY
pnpm exec convex env set --deployment <deployment> VAPID_PRIVATE_KEY
```

Hodnoty předejte přes standardní vstup, aby se neuložily do historie shellu.
Před každým příkazem ověřte jméno cílového deploymentu; bez `--deployment`
příkaz používá lokálně vybraný deployment.

Po změně `NEXT_PUBLIC_VAPID_PUBLIC_KEY` je nutný nový produkční build. Web Push
funguje pouze přes HTTPS; na iOS/iPadOS musí mít uživatel PWA přidanou na plochu.
Klient registruje statický service worker bez offline precache; `localhost` je
pro service worker považovaný za bezpečný kontext.

## Spolehlivost

Při vzniku omluvenky se vytvoří idempotentní notifikační událost a samostatná
doručení pro aktivní zařízení ředitelů. Neúspěšná doručení se opakují s
prodlužujícími se intervaly až desetkrát. Pravidelná úloha navíc:

- doplní událost, pokud mezi uložením omluvenky a zařazením notifikace došlo k
  výpadku; trvalý kurzor po obnovení naváže od posledního dokončeného průchodu,
- znovu zařadí doručení, které zůstalo rozpracované po pádu workeru,
- odstraní expirovaný odběr po odpovědi push služby `404` nebo `410`.

Push služba potvrzuje převzetí zprávy, ne její skutečné zobrazení operačním
systémem. Zařízení může zobrazení potlačit například při vypnutých systémových
notifikacích. Provozní stav lze sledovat v tabulce `notificationDeliveries`.
