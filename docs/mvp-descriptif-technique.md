# MVP "Meet & Move" – Descriptif technique

## Objectif
Livrer un MVP en 8 à 10 semaines avec un budget nul (hors coûts d'infrastructure) et une équipe réduite (1 full-stack ou binôme front/back).

## Scope fonctionnel
### User stories
- **US-1** : Création de compte (email, Apple, Google).
- **US-2** : Dépôt d'une activité (titre, description, catégorie, géolocalisation précise OSM, nombre maximum de participants, créneaux multiples, prix 0 € ou don libre).
- **US-3** : Visualisation des activités dans un rayon de 30 km (vue carte/liste) avec filtres (date, catégorie, places restantes).
- **US-4** : Réservation d'une place avec annulation possible jusqu'à H-24.
- **US-5** : Notification push 2 h avant le rendez-vous avec rappel du lieu et des participants.
- **US-6** : Scan d'un QR code généré par l'organisateur pour valider la présence (calcul du taux de no-show).
- **US-7** : Notation post-événement (1 à 5 étoiles + commentaire modéré).
- **US-8** : Tableau de bord organisateur (liste d'événements, participants, export CSV des emails).

### Back-office admin (web)
- Modération des événements et signalements.
- Statistiques : nombre d'événements, nombre de participants, taux de no-show, rétention D7/D30.

## Architecture cible « serverless first »
### Front mobile
- **Stack** : Flutter 3.22 (code base unique iOS/Android).
- **Packages clés** : flutter_riverpod, go_router, google_maps_flutter + fallback OSM, firebase_auth, cloud_firestore, firebase_storage, firebase_messaging, firebase_dynamic_links, qr_flutter, mobile_scanner.
- **CI/CD** : GitHub Actions → Tests + build → Firebase App Distribution (beta Toulouse).

### Back-end
- **Auth** : Firebase Auth (email, Google, Apple).
- **Base** : Cloud Firestore (règles de sécurité fines).
- **Cloud Functions (Node 20)** :
  - `createEvent` : vérifie la géolocalisation, les créneaux et le slug unique.
  - `bookSlot` : transaction Firestore (décrément places, gère waiting list).
  - `cancelBooking` : remboursement si paiement, remonte la file d'attente.
  - `generateQR` : HMAC(eventId + userId + timestamp).
  - `checkIn` : vérifie le hash, marque la présence, déclenche la demande d'avis.
- **Cloud Tasks + Scheduled Functions** : rappels push, clôture automatique H+2, archivage.
- **Storage** : images d'événements compressées (800 px) via Cloudinary (webhook) ou Firebase Extensions.
- **Monitoring** : Crashlytics, Performance Monitoring, Sentry.

### Paiement (option activable via Remote Config)
- Stripe Connect Express (compte virtuel par organisateur).
- Cloud Function `createConnectedAccount` (KYC léger).
- PaymentIntent côté app, webhook `checkout.session.completed` → marque "payé".
- Frais : 1,4 % + 0,25 € (Stripe) + 0,6 € plateforme (désactivé pour le MVP).

## Modèle de données (Firestore)
```
users
├─ uid
├─ name, avatarUrl, bio, tel, notifToken, ratingMean, ratingCount, createdAt

events
├─ eventId
├─ title, description, category, priceCents, currency
├─ geoPoint, addressName, addressJson
├─ slots[] : {startAt, endAt, maxPlaces, bookedPlaces}
├─ hostId (ref user)
├─ images[]
├─ status : draft | published | cancelled | finished
├─ createdAt, updatedAt

bookings
├─ bookingId
├─ userId, eventId, slotIndex
├─ status : booked | cancelled | checkedIn
├─ paymentIntentId (nullable)
├─ createdAt, checkedInAt

reviews
├─ reviewId
├─ eventId, reviewerId, revieweeId
├─ stars, comment, moderatedAt

reports (collection modération)
```

### Règles Firestore
- Les événements sont publics en lecture ; seuls leurs organisateurs peuvent les éditer.
- Une réservation ne peut être créée que si `bookedPlaces < maxPlaces` (règles + transaction).

## API externes
- Nominatim OSM (géocodage, cache Redis 24 h via Cloud Run).
- SendGrid (emails transactionnels).
- Notion API (back-office statistiques partagé investisseurs).

## Cycle de vie des données
1. Création événement → Firestore + resize image → publication → carte/liste.
2. Réservation → Cloud Function transaction → push "places restantes" aux autres.
3. J-2 : Cloud Task → push "rappel".
4. Jour J : organisateur visualise les réservations + QR unique (renouvelé toutes les 5 min).
5. Check-in → mise à jour booking → demande d'avis 30 min après.
6. J+1 : Cloud Function archive l'événement → BigQuery.

## Sécurité & RGPD
- Pseudonymisation par défaut, export des données personnelles à la demande (Callable Function).
- Suppression automatique après 2 ans d'inactivité (Cloud Scheduler).
- Chiffrement en transit (TLS 1.3) et au repos (AES-256).
- Prévision V2 : chiffrement côté client des messages.

## Performance & coûts (estimation 1000 MAU)
- Firestore : 1,2 M lectures, 300 k écritures / mois → ~18 €.
- Functions : 2 M invocations, 400 GB-s → ~6 €.
- Auth + Storage + FCM → ~5 €.
- Total infra : ~30 €/mois (hors Stripe).

## Tests & qualité
- 70 % de couverture Jest sur les Cloud Functions.
- Golden tests Flutter (captures) sur les PR.
- Beta fermée : 100 utilisateurs (liste d'attente Notion + code d'invitation).
- Tracking : Mixpanel (signup, create, book, checkin, review) + BigQuery.

## Roadmap micro-tech
- **S1** : setup Firebase, Auth, création/liste d'événements.
- **S2** : géolocalisation, carte, réservation, règles de sécurité.
- **S3** : push, rappels, QR code, check-in.
- **S4** : notation, back-office Notion, modération.
- **S5** : paiement Stripe, CI/CD, beta fermée.
- **S6** : analytics, A/B onboarding, polish UI, corrections.
- **S7** : soft-launch TestFlight + Google Internal Testing, recrutement ambassadeurs.
- **S8** : collecte KPI (rétention D7 > 25 %, no-show < 15 %), deck seed.

## Dettes techniques & next steps
- Migration possible vers Supabase si >10 k MAU.
- Passage en Clean Architecture + codegen avec plus de ressources.
- Ajout d'un chat temps réel (V2).
- Export ICS et intégration calendrier natif.
