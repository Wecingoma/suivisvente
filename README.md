# MarcherVente

Application web de gestion commerciale pour suivre les ventes, les dettes clients, les paiements partiels et les rapports de recouvrement.

## Stack

- Frontend: React 19 + TypeScript + Tailwind CSS 4 + shadcn/ui
- Backend: Firebase Cloud Functions + Express
- Base de donnees: Cloud Firestore
- Authentification: Firebase Auth avec roles (`admin`, `vendeur`, `gestionnaire`)
- Export: CSV cote frontend, extension PDF/Excel prevue cote backend

## Fonctionnalites couvertes

- Connexion avec comptes de demonstration par role
- Gestion clients: ajout, modification, suppression, recherche
- Gestion produits: stock, prix, statut, historique de mouvements
- Gestion ventes multi-lignes
- Creation automatique d'une dette si une vente n'est pas totalement reglee
- Gestion des remboursements echelonnes
- Recalcul automatique du solde restant et du statut de dette
- Historique des ventes et paiements par client
- Dashboard avec KPIs de ventes, encaissements et dettes
- Rapports `jour / semaine / mois / complet`

## Comptes de demonstration

- `admin@marchervente.app` / `admin123`
- `gestion@marchervente.app` / `manager123`
- `vendeur@marchervente.app` / `seller123`

## Installation

### 1. Frontend

```bash
pnpm install
cp .env.example .env
pnpm dev
```

### 2. Backend Firebase Functions

Depuis le dossier racine:

```bash
cd firebase/functions
pnpm install
```

### 3. Emulateurs Firebase

Depuis `firebase/functions`:

```bash
pnpm serve
```

### 4. Seed des donnees

Depuis `firebase/functions`:

```bash
pnpm seed
```

## Commandes utiles

Depuis la racine:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```

Depuis `firebase/functions`:

```bash
pnpm serve
pnpm deploy
pnpm seed
```

## Variables d'environnement

Le frontend utilise les variables presentes dans `.env.example`:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=
```

## Structure du projet

```text
src/
  components/
    ui/
  lib/
    app-state.ts
    business-rules.ts
    demo-data.ts
    format.ts
  App.tsx
  main.tsx
  types.ts

firebase/functions/src/
  config/
  controllers/
  middleware/
  models/
  services/
  utils/
  index.js
  seed.js
```

## Regles metier appliquees

- Une vente peut contenir plusieurs lignes.
- Une dette est creee uniquement si la vente n'est pas completement payee.
- Une dette peut recevoir plusieurs paiements.
- Un paiement ne peut jamais depasser le montant restant.
- `reste a payer = dette initiale - somme des paiements`.
- Quand le reste atteint `0`, le statut devient `soldee`.
- Le stock diminue a la validation d'une vente.
- Chaque operation importante est historisee dans `audit_logs`.

La logique frontend centralisee se trouve dans [business-rules.ts](/home/john-heshima-b/Documents/All_WECINGOMA/devFolder/marcherVente/MarcherVente/src/lib/business-rules.ts).

## Collections Firestore

Le projet utilise les collections suivantes:

- `users`
- `clients`
- `products`
- `sales`
- `sale_items`
- `debts`
- `payments`
- `stock_movements`
- `audit_logs`

## Fichiers importants

- Architecture: [architecture.md](/home/john-heshima-b/Documents/All_WECINGOMA/devFolder/marcherVente/MarcherVente/docs/architecture.md)
- Regles Firestore: [firestore.rules](/home/john-heshima-b/Documents/All_WECINGOMA/devFolder/marcherVente/MarcherVente/firestore.rules)
- Index Firestore: [firestore.indexes.json](/home/john-heshima-b/Documents/All_WECINGOMA/devFolder/marcherVente/MarcherVente/firestore.indexes.json)
- Seed frontend: [demo-data.ts](/home/john-heshima-b/Documents/All_WECINGOMA/devFolder/marcherVente/MarcherVente/src/lib/demo-data.ts)
- Seed Firebase: [seed.js](/home/john-heshima-b/Documents/All_WECINGOMA/devFolder/marcherVente/MarcherVente/firebase/functions/src/seed.js)

## Etat actuel

- Le frontend est immediatement executable et fonctionnel en mode demonstration.
- Le backend Firebase expose deja les endpoints metier critiques pour clients, produits, ventes, paiements, dashboard et rapports.
- La prochaine etape naturelle est de brancher les vues React sur l'API Firebase au lieu du store local `useCommercialApp`.
# suivisvente
