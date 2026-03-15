# Migration SaaS Multi-tenant

## 1. Analyse de la structure actuelle

Le socle actuel est deja propre pour une migration progressive:

- le frontend React centralise la logique Firestore dans `src/lib/app-state.ts`
- les roles sont deja resolus depuis `users/{uid}`
- un portail client existe deja avec liaison `users.clientId -> clients/{clientId}`
- la logique metier principale est concentree dans les transactions `createSale` et `addPayment`
- les regles Firestore existent deja et protegent une partie des acces par role

Points importants observes dans ce repo:

- les collections actives sont `users`, `clients`, `products`, `sales`, `sale_items`, `debts`, `payments`, `stock_movements`, `audit_logs`
- les roles actuels sont `admin`, `gestionnaire`, `vendeur`, `client`
- l'application lit aujourd'hui les collections sans filtre par entreprise
- `payments` est deja le systeme de paiement des dettes clients, donc il ne faut pas le casser

Conclusion:

La bonne strategie n'est pas une re-ecriture. Il faut ajouter une couche `businessId` transversale, conserver les collections existantes, et introduire les nouveaux concepts SaaS autour d'elles.

## 2. Plan pour transformer l'application en SaaS sans casser l'existant

Phase 1. Ajouter les nouveaux concepts sans impacter les flux actuels

- creer `businesses`, `plans`, `subscriptions`, `subscription_payments`, `payment_sessions`
- ajouter `businessId` de facon optionnelle dans les documents existants
- etendre les roles supportes au niveau securite et backend
- preparer les Cloud Functions pour le bootstrap tenant, les paiements et la migration

Phase 2. Migration douce des donnees existantes

- creer un premier `businesses/{businessId}` pour l'entreprise historique
- affecter `users/{uid}.businessId`
- backfiller `businessId` sur `clients`, `products`, `sales`, `sale_items`, `debts`, `payments`, `stock_movements`, `audit_logs`
- garder les documents legacy sans `businessId` lisibles temporairement pendant la migration

Phase 3. Activation applicative

- ajouter le filtre `businessId` dans les requetes Firestore du frontend
- injecter `businessId` automatiquement a la creation de tous les documents
- ajouter les routes SaaS `super_admin` et `owner`
- activer les paiements externes via backend + webhook

Phase 4. Durcissement

- une fois la migration complete, rendre `businessId` obligatoire sur toutes les nouvelles ecritures
- supprimer progressivement les tolerances legacy dans les regles

## 3. Structure Firestore SaaS complete

### Collections coeur

`businesses/{businessId}`

```json
{
  "name": "Boutique Nzambe",
  "ownerUid": "uid123",
  "plan": "free",
  "status": "active",
  "createdAt": "timestamp"
}
```

`users/{uid}`

```json
{
  "email": "owner@business.com",
  "fullName": "Owner Name",
  "role": "owner",
  "businessId": "biz_001",
  "clientId": null,
  "status": "active",
  "isActive": true,
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

### Collections metier existantes avec extension minimale

`clients`, `products`, `sales`, `sale_items`, `debts`, `payments`, `stock_movements`, `audit_logs`

Champ ajoute:

```json
{
  "businessId": "biz_001"
}
```

### Collections SaaS abonnement

`plans/{planId}`

```json
{
  "name": "Pro",
  "monthlyPrice": 49,
  "currency": "USD",
  "features": ["multi-users", "reports", "payments"],
  "active": true
}
```

`subscriptions/{subscriptionId}`

```json
{
  "businessId": "biz_001",
  "planId": "pro",
  "status": "active",
  "startedAt": "timestamp",
  "expiresAt": "timestamp",
  "renewedAt": "timestamp"
}
```

`subscription_payments/{paymentId}`

```json
{
  "businessId": "biz_001",
  "subscriptionId": "sub_001",
  "amount": 49,
  "currency": "USD",
  "provider": "card",
  "providerReference": "ext_ref",
  "status": "confirmed",
  "createdAt": "timestamp"
}
```

### Collection technique paiement

`payment_sessions/{sessionId}`

```json
{
  "businessId": "biz_001",
  "kind": "customer_payment",
  "clientId": "cl_001",
  "debtId": "db_001",
  "amount": 100,
  "currency": "USD",
  "provider": "mobile_money",
  "status": "pending",
  "providerSessionId": "prov_123",
  "checkoutUrl": "https://provider/checkout",
  "createdAt": "timestamp"
}
```

## 4. Modifications minimales des collections existantes

Changement minimal recommande:

- `users`: ajouter `businessId`, `status`
- `clients`: ajouter `businessId`
- `products`: ajouter `businessId`
- `sales`: ajouter `businessId`
- `sale_items`: ajouter `businessId`
- `debts`: ajouter `businessId`
- `payments`: ajouter `businessId`
- `stock_movements`: ajouter `businessId`
- `audit_logs`: ajouter `businessId`

Important:

- aucun renommage de collection existante
- aucun renommage brutal du role legacy `admin`
- aucune suppression de champ existant
- `payments` reste le paiement des dettes clients
- `subscription_payments` reste separe pour la facturation SaaS

## 5. Plan de migration des donnees

Ordre recommande:

1. Creer le business principal legacy.
2. Attacher tous les `users` internes a ce `businessId`.
3. Executer un backfill sur toutes les collections metier.
4. Deployer le frontend qui ecrit `businessId` sur tous les nouveaux documents.
5. Deployer les regles durcies quand plus aucun document critique n'est legacy.

Approche automatique:

- utiliser `bootstrapBusiness` pour creer une entreprise et son owner
- utiliser `migrateLegacyBusinessData` pour injecter `businessId` sur l'existant
- conserver une tolerance dans les regles pour les documents sans `businessId` pendant la phase transitoire

Risque a surveiller:

Tant que certains documents legacy n'ont pas `businessId`, l'isolation parfaite n'est pas mathematiquement garantie si plusieurs tenants sont onboardes avant la fin du backfill. Il faut donc migrer vite les donnees historiques avant l'ouverture large du SaaS.

## 6. Firestore Security Rules SaaS

Les regles mises a jour dans `firestore.rules` implementent:

- isolation par `businessId` pour les documents scopes
- acces `super_admin` global
- acces `owner`, `manager`, `seller` et aliases legacy `admin`, `gestionnaire`, `vendeur`
- acces client restreint a ses propres dettes et paiements
- compatibilite temporaire pour les documents legacy sans `businessId`

Limite volontaire:

Les regles restent backward-compatible. Elles ne forcent pas encore `businessId` partout tant que la migration n'est pas terminee.

## 7. Architecture multi-tenant

Architecture cible:

`Auth user -> users/{uid} -> businessId -> toutes les requetes Firestore filtrees par businessId`

Principes:

- chaque utilisateur applicatif est rattache a une entreprise
- toutes les donnees metier portent `businessId`
- les Cloud Functions prennent `businessId` comme contexte metier
- le frontend ne doit jamais lire une collection brute sans filtre tenant une fois la migration active

Point d'injection ideal dans ce repo:

- `src/lib/app-state.ts` pour filtrer tous les `onSnapshot`
- helper central dans `src/lib/multitenant.ts`

## 8. Gestion des roles

Roles SaaS cibles:

- `super_admin`: administration plateforme
- `owner`: proprietaire de l'entreprise
- `manager`: gestion d'entreprise
- `seller`: operations commerciales
- `client`: portail dette client

Compatibilite legacy:

- `admin` est conserve comme alias legacy de `owner/admin business`
- `gestionnaire` est conserve comme alias legacy de `manager`
- `vendeur` est conserve comme alias legacy de `seller`

Strategie recommandee:

- ne pas migrer brutalement les roles en base
- supporter les deux vocabulaires pendant une phase de compatibilite
- normaliser plus tard cote UI si necessaire

## 9. Code backend Firebase necessaire

Le squelette ajoute dans `functions/src/index.ts` couvre:

- `bootstrapBusiness`: creation entreprise + owner + subscription free
- `createPaymentSession`: creation session de paiement externe
- `confirmPayment`: verification de session
- `paymentWebhook`: confirmation asynchrone fournisseur
- `migrateLegacyBusinessData`: backfill `businessId`

Modules backend ajoutes:

- `functions/src/tenant.ts`: controle d'acces tenant + bootstrap + migration
- `functions/src/payment-providers/base.ts`: abstraction provider
- `functions/src/payment-providers/mock.ts`: provider de demonstration

Important:

- aucune donnee de carte n'est stockee
- le backend ne fait transiter que des references de session et statuts
- le webhook est la source de verite finale

## 10. Structure des routes frontend

Structure cible recommandee sans re-ecriture:

- `/login`
- `/register-business`
- `/app/dashboard`
- `/app/clients`
- `/app/products`
- `/app/sales`
- `/app/debts`
- `/app/payments`
- `/client/dashboard`
- `/client/payments`
- `/admin/saas`
- `/admin/businesses`
- `/admin/subscriptions`

Dans ce repo, l'application est encore pilotee par un `screen` local dans `src/App.tsx`. Pour minimiser le risque:

- conserver ce mecanisme d'abord
- introduire les nouvelles vues SaaS comme nouveaux `screen`
- migrer vers React Router seulement si cela devient necessaire

## 11. Architecture paiement extensible

Architecture retenue:

`frontend -> Cloud Functions -> provider externe -> webhook -> Firestore`

Abstractions:

- `paymentProviders`
- `createPaymentSession`
- `confirmPayment`
- `paymentWebhook`

Separation stricte:

- `payments`: paiements de dettes clients
- `subscription_payments`: paiements d'abonnements SaaS
- `payment_sessions`: couche technique commune

Providers a brancher plus tard:

- Mobile Money local
- Stripe / Checkout carte
- passerelle bancaire

## 12. Dashboard SaaS

Vue `super_admin` recommandee:

- nombre total d'entreprises
- nombre total d'utilisateurs
- nombre total de clients
- MRR / revenus plateforme
- abonnements actifs
- businesses suspendus
- businesses en trial

Sources Firestore:

- `businesses`
- `users`
- `clients`
- `subscriptions`
- `subscription_payments`

Implementation minimale conseillee:

- agreger via Cloud Functions ou documents de stats materialises
- eviter les scans complets Firestore dans le frontend admin

## Fichiers ajoutes ou modifies

- `firestore.rules`
- `firestore.indexes.json`
- `src/lib/multitenant.ts`
- `functions/src/index.ts`
- `functions/src/tenant.ts`
- `functions/src/payment-providers/base.ts`
- `functions/src/payment-providers/mock.ts`

## Recommandation de mise en production

Ordre de deploiement le plus sur:

1. deployer les Functions et les nouvelles collections SaaS
2. creer le business legacy
3. lancer la migration `businessId`
4. deployer ensuite les changements frontend qui filtrent les requetes par `businessId`
5. enfin durcir les regles pour rendre `businessId` obligatoire
