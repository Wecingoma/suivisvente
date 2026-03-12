# Migration du role `client`

## Objectif

Ajouter un acces client authentifie sans casser les collections existantes `users` et `clients`.

## Liaison `uid -> clientId`

La liaison appliquee par l'application est:

- `users/{uid}.role = "client"`
- `users/{uid}.clientId = "<id-du-document-clients>"`

En bootstrap automatique, si un utilisateur Firebase Auth se connecte avec une adresse email qui correspond a `clients/{clientId}.email`, l'application cree ou complete `users/{uid}` avec:

```json
{
  "role": "client",
  "clientId": "<clientId>"
}
```

## Plan de migration pour les clients existants

1. Completer `clients/{clientId}.email` pour chaque client devant acceder au portail.
2. Creer un compte Firebase Auth avec la meme adresse email.
3. Au premier login, l'application fera la liaison automatique si `users/{uid}` n'existe pas encore.
4. Si vous voulez preprovisionner manuellement:

```json
// users/{uid}
{
  "fullName": "Nom du client",
  "email": "client@example.com",
  "role": "client",
  "clientId": "cl-003",
  "isActive": true,
  "authProvider": "password"
}
```

## Cas retrocompatibles

- Les comptes `admin`, `gestionnaire` et `vendeur` continuent de fonctionner.
- Les collections `clients` et `users` ne changent pas de nom.
- `clientId` est optionnel pour les roles staff.
- Si un compte `client` n'a pas encore de `clientId`, le dashboard client affiche un message d'association manquante.

## Tests de migration

1. Ajouter `email` sur un client existant.
2. Creer un compte Firebase Auth avec la meme adresse.
3. Se connecter avec ce compte.
4. Verifier que `users/{uid}` est cree avec `role: "client"` et le bon `clientId`.
5. Verifier que le client ne voit que ses dettes et paiements.
