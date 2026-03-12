# Architecture de paiement extensible

## Principe

Le frontend client ne doit jamais confirmer lui-meme un paiement de dette.

Le flux recommande est:

1. Le client choisit un moyen de paiement sur le portail.
2. Le frontend appelle un backend securise pour creer une intention de paiement.
3. Le backend appelle un provider externe:
   - Mobile Money
   - carte bancaire
   - Visa / Mastercard
4. Le provider notifie le backend via webhook.
5. Le backend verifie la signature du webhook et le statut reel du paiement.
6. Seulement apres confirmation, le backend ecrit:
   - `payments/{paymentId}`
   - mise a jour transactionnelle de `debts/{debtId}`
   - eventuellement `audit_logs/{logId}`

## Contraintes de securite

- Ne jamais stocker PAN, CVV, numero complet de carte ou secrets provider dans Firestore.
- Stocker uniquement:
  - `provider`
  - `providerReference`
  - `status`
  - `amount`
  - `clientId`
  - `debtId`
  - timestamps
- Le secret webhook et les cles API restent cote backend uniquement.

## Collections recommandees

Une extension propre peut ajouter plus tard:

- `payment_intents/{intentId}`
- `payment_webhook_events/{eventId}`

Exemple minimal pour `payment_intents/{intentId}`:

```json
{
  "clientId": "cl-003",
  "debtId": "db-001",
  "amount": 25,
  "currency": "USD",
  "provider": "card_gateway",
  "status": "pending",
  "providerReference": "pi_123456",
  "createdAt": "2026-03-11T10:00:00.000Z"
}
```

## Responsabilites

- Frontend:
  - initier la demande
  - afficher l'etat du paiement
  - ne jamais ecrire directement dans `payments` pour un client
- Backend:
  - creer l'intention
  - appeler le provider
  - verifier les callbacks
  - mettre a jour `debts` et `payments` de maniere atomique

## Tests a faire plus tard avec backend

1. Paiement initie puis confirme par webhook.
2. Paiement initie puis echoue.
3. Webhook duplique: aucune double ecriture.
4. Montant confirme different du montant attendu: rejet.
5. Dette deja soldee: refus d'ecriture.
