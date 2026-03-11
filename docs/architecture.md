# Architecture MarcherVente

## Vue d'ensemble

MarcherVente repose sur deux briques:

- `src/`: application React + TypeScript
- `Firebase Auth` + `Cloud Firestore`: authentification, profils, roles et donnees metier

## Donnees utilisateur

- L'authentification est geree par Firebase Auth.
- Le profil applicatif est stocke dans `users/{uid}`.
- Le role utilise par l'application est lu en priorite depuis Firestore.
- Un admin peut modifier `role` et `isActive` directement dans Firestore.

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

## Securite

Les regles sont definies dans [firestore.rules](/home/john-heshima-b/Documents/All_WECINGOMA/devFolder/marcherVente/MarcherVente/firestore.rules).

Le role courant est resolu depuis le document `users/{uid}` avant tout fallback vers le token Auth.
