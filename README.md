# MarcherVente

Application web de gestion commerciale basee sur React, Firebase Auth et Cloud Firestore.

## Stack

- Frontend: React 19 + TypeScript + Tailwind CSS 4
- Authentification: Firebase Auth
- Base de donnees: Cloud Firestore
- Roles applicatifs: stockes dans la collection `users` (`admin`, `gestionnaire`, `vendeur`)

## Fonctionnement actuel

- La connexion passe par Firebase Auth.
- Les profils utilisateur sont synchronises dans Firestore `users`.
- La liste des utilisateurs de l'admin vient uniquement de Firestore.
- Les changements de role et de statut utilisateur ecrivent directement dans `users/{uid}`.
- Les regles d'acces reposent sur [firestore.rules](/home/john-heshima-b/Documents/All_WECINGOMA/devFolder/marcherVente/MarcherVente/firestore.rules).

## Installation

```bash
pnpm install
pnpm dev
```

## Variables d'environnement

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_ENABLE_FIREBASE_AUTH=true
VITE_USE_FIREBASE_EMULATORS=false
VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
VITE_FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
```

## Collections Firestore

- `users`
- `clients`
- `products`
- `sales`
- `sale_items`
- `debts`
- `payments`
- `stock_movements`
- `audit_logs`

## Commandes utiles

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
```
