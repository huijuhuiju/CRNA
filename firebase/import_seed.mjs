/**
 * Imports firebase/seed-data.json after a Firebase project is created.
 * Required environment variables: GOOGLE_APPLICATION_CREDENTIALS, INITIAL_PASSWORD.
 */
import { readFile } from "node:fs/promises";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const serviceAccount = JSON.parse(await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, "utf8"));
const initialPassword = process.env.INITIAL_PASSWORD;
if (!initialPassword) throw new Error("Set INITIAL_PASSWORD before importing accounts.");
initializeApp({ credential: cert(serviceAccount) });

const seed = JSON.parse(await readFile(new URL("./seed-data.json", import.meta.url), "utf8"));
const auth = getAuth();
const db = getFirestore();
const uidByLegacyId = new Map();

for (const user of seed.users) {
  const email = `${user.accountName}@crna.example.com`;
  let authUser;
  try { authUser = await auth.getUserByEmail(email); }
  catch { authUser = await auth.createUser({ email, password: initialPassword, displayName: user.displayName }); }
  uidByLegacyId.set(user.legacyId, authUser.uid);
  await db.collection("users").doc(authUser.uid).set({
    employeeNo: user.employeeNo, displayName: user.displayName, accountName: user.accountName,
    role: user.role, employedOn: user.employedOn, probationPassed: user.probationPassed,
    isActive: user.isActive, createdAt: Timestamp.now(), updatedAt: Timestamp.now()
  }, { merge: true });
}

for (const application of seed.applications) {
  await db.collection("applications").doc(application.legacyId).set({
    ...application,
    applicantId: uidByLegacyId.get(application.applicantLegacyId),
    submittedById: uidByLegacyId.get(application.submittedByLegacyId),
    approvedById: application.approvedByLegacyId ? uidByLegacyId.get(application.approvedByLegacyId) : null,
    migratedAt: Timestamp.now()
  }, { merge: true });
}
console.log(`Imported ${seed.users.length} users and ${seed.applications.length} applications.`);
