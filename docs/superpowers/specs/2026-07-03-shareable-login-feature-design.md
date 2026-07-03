# Shareable Diagrams and Login Feature Design

## Goal

Add sharing and optional account storage without charging users. Guest users can try the app with browser storage and temporary share links. Signed-in users can keep more diagrams in Firestore and create permanent share links.

## User Tiers

### Guest Users

- Can keep up to 3 diagrams in browser storage.
- Can create public share links.
- Guest share links expire after 30 days.
- Guest diagrams remain browser-local unless shared.
- When the user reaches 3 diagrams, show a friendly sign-in prompt:
  - "Sign in with Google to keep more diagrams and access them across browsers."
  - Avoid paid-upgrade language because the app is free.

### Signed-In Users

- Sign in with Google using Firebase Authentication.
- Can keep up to 100 diagrams per account.
- Diagrams are saved in Firestore.
- Can create public share links that do not expire by default.
- Can still export `.cell` files for local backup.

## Firestore Data Model

Use separate collections for private diagrams and public share snapshots.

```txt
/users/{uid}/diagrams/{diagramId}
/shares/{shareId}
```

Private user diagram document:

```ts
interface UserDiagramDocument {
  ownerUid: string;
  name: string;
  source: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Public share document:

```ts
interface ShareDocument {
  ownerUid?: string;
  source: string;
  title: string;
  createdAt: Timestamp;
  expiresAt?: Timestamp;
  sourceDiagramId?: string;
}
```

Guest shares omit `ownerUid`, store a source snapshot, and include `expiresAt`.

Signed-in shares store a source snapshot, include `ownerUid`, and omit `expiresAt` unless a future UI allows expiring links.

## Share Behavior

Use snapshot shares for the first implementation.

- A share link shows the diagram as it existed when shared.
- Editing the original diagram does not silently change the shared version.
- A future action can support "Update shared link" if users want to refresh a snapshot.

Share URL shape:

```txt
/share/{shareId}
```

The share view should be read-only and should not require login.

## Storage and Sync Behavior

The current local repository remains useful:

- Guest mode stores diagrams in browser storage with a limit of 3.
- Signed-in mode syncs diagrams to Firestore with a limit of 100.
- On first sign-in, ask whether to move local diagrams into the account if local diagrams exist.
- Avoid saving every keystroke directly to Firestore. Use debounced saves or explicit save points to control write volume.

## Security Rules

Firestore rules must enforce:

- Users can read/write only their own `/users/{uid}/diagrams/*`.
- Users cannot create more than 100 diagrams.
- Anyone can read valid `/shares/{shareId}` documents.
- Guest share documents must include `expiresAt`.
- Signed-in share documents must have `ownerUid == request.auth.uid`.
- Shared source size should be capped to prevent abuse.

App Check should be considered after the first working implementation to reduce automated abuse.

## Open Source Deployment

Do not hardcode the production Firebase config in source files.

Commit:

```txt
.env.example
firebase.json
firestore.rules
firestore.indexes.json
```

Do not commit:

```txt
.env.local
.env.production.local
```

Vite environment variables:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
```

Firebase web config is not a server secret, but security must come from Firebase Auth, Firestore Security Rules, usage limits, and later App Check.

## Legal Pages

Add simple public pages before enabling hosted sharing:

- Terms of Service
- Privacy Policy

The privacy policy should explain:

- Browser-local diagrams stay in the user's browser unless imported, exported, signed in, or shared.
- Signed-in diagrams are stored in Firebase under the user's account.
- Public share links can be viewed by anyone with the link.
- Guest share links expire after 30 days.
- Google sign-in account information is used for authentication and ownership.

The terms should explain:

- The service is free and provided without uptime guarantees.
- Users are responsible for content they create and share.
- The project may apply limits to protect the free service.
- Abusive or illegal content can be removed.

## Implementation Phases

1. Add Firebase config scaffolding and no-op provider boundary.
2. Add Google sign-in and account state UI.
3. Adjust guest diagram limit from 10 to 3.
4. Add signed-in Firestore diagram repository with 100-diagram limit.
5. Add local-to-account import prompt after first sign-in.
6. Add share creation and copy-link UI.
7. Add read-only `/share/{shareId}` route.
8. Add Terms and Privacy pages.
9. Add Firestore rules tests or emulator-backed verification.

## Open Questions

- Should signed-in users be able to revoke/delete a permanent share link?
- Should signed-in users be able to choose a 30-day expiring link as well?
- Should account deletion also delete all user diagrams and owned share snapshots?
