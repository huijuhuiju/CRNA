# Firebase migration package

## Collections

- `users`: valid accounts, role, personnel identifier, employment data.
- `applications`: long-leave request, dates, plan, status, approval metadata.
- `applicationStatusHistory`: immutable audit trail.
- `courseSchedules`: uploaded CV course schedules.

## Setup

1. Create a Firebase project and enable **Authentication / Email-Password**, **Cloud Firestore**, and **Hosting**.
2. Deploy `firestore.rules` and `firestore.indexes.json` using Firebase CLI.
3. Copy `firebase-config.example.js` to `firebase-config.js` and paste the web-app configuration shown in Firebase Console.
4. Create a service-account JSON file locally; do not commit it.
5. Run `INITIAL_PASSWORD='temporary-password' node firebase/import_seed.mjs` with `GOOGLE_APPLICATION_CREDENTIALS` pointing to that JSON file.
6. Require every user to reset the temporary password on first sign-in.

The export intentionally omits password hashes. Firebase Authentication owns passwords; Firestore stores role and profile data only.
