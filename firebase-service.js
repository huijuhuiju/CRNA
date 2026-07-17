import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase/firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const loginDomain = "crna-61e20.firebaseapp.com";
const authEmail = (account) => {
  const value = String(account).trim();
  return value.includes("@") ? value : `${value.toLowerCase()}@${loginDomain}`;
};
const roleText = (role) => ({ staff: "麻醉專師", director: "技術主任", admin: "系統管理者" }[role] || role);

async function profileFor(uid) {
  const profile = await get(ref(database, `users/${uid}`));
  if (!profile.exists()) throw new Error("此帳號尚未完成系統人員資料設定，請聯絡系統管理者。");
  const data = profile.val();
  if (data.active === false) throw new Error("此帳號已停用，請聯絡系統管理者。");
  return { uid, id: data.employeeNo, name: data.name, role: data.role, roleText: roleText(data.role), employedAt: data.employedAt, probationPassed: !!data.probationPassed };
}

async function loadData() {
  const [userData, applicationData] = await Promise.all([get(ref(database, "users")), get(ref(database, "applications"))]);
  const users = userData.val() || {};
  const applications = applicationData.val() || {};
  return {
    accounts: Object.entries(users).map(([uid, data]) => ({ uid, id: data.employeeNo, name: data.name, role: data.role, roleText: roleText(data.role), employedAt: data.employedAt, probationPassed: !!data.probationPassed, active: data.active !== false })),
    applications: Object.entries(applications).map(([id, data]) => ({ id, ...data }))
  };
}

async function syncApplications(applications) {
  if (!auth.currentUser) return;
  const changes = {};
  applications.forEach((application) => {
    const { id, ...data } = application;
    changes[`applications/${id}`] = { ...data, updatedAt: new Date().toISOString() };
  });
  await update(ref(database), changes);
}

async function createEmployee({ name, employeeNo, role, password, employedAt, probationPassed }) {
  if (!auth.currentUser) throw new Error("請先以主管帳號登入。");
  const secondaryName = "employee-provisioning";
  const secondary = getApps().find((item) => item.name === secondaryName) || initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondary);
  const credential = await createUserWithEmailAndPassword(secondaryAuth, authEmail(employeeNo), password);
  await set(ref(database, `users/${credential.user.uid}`), {
    name, employeeNo, role, employedAt: employedAt || null, probationPassed: !!probationPassed, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  });
  await signOut(secondaryAuth);
  return credential.user.uid;
}

window.firebaseBackend = {
  enabled: true,
  async login(employeeNo, password) {
    const credential = await signInWithEmailAndPassword(auth, authEmail(employeeNo), password);
    return profileFor(credential.user.uid);
  },
  logout: () => signOut(auth),
  loadData,
  syncApplications,
  createEmployee
};
window.dispatchEvent(new Event("firebase-ready"));
