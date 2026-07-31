import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updatePassword } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
import { firebaseConfig } from "./firebase/firebase-config.js";

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const loginDomain = "crna-61e20.firebaseapp.com";
const authEmail = (account) => { const value = String(account).trim(); return value.includes("@") ? value : `${value.toLowerCase()}@${loginDomain}`; };
const roleForTitle = (jobTitle) => jobTitle === "技術主任" ? "director" : jobTitle === "系統管理者" ? "admin" : "staff";
const groupForTitle = (jobTitle) => (["麻醉專科護理師", "麻醉訓練專科護理師", "事務員"].includes(jobTitle) ? "clinical" : jobTitle === "護理師" ? "nursing" : jobTitle === "助理員" ? "assistant" : null);
const roleText = (role) => ({ staff: "人員", director: "技術主任", admin: "系統管理者" }[role] || role);
const fallbackJobTitle = (employeeNo, role) => String(employeeNo) === "3851" ? "麻醉專科護理師" : roleText(role);
const profileShape = (uid, data) => ({ uid, id: data.employeeNo, name: data.name, role: data.role, roleText: roleText(data.role), jobTitle: data.jobTitle || fallbackJobTitle(data.employeeNo, data.role), bookingGroup: data.bookingGroup || groupForTitle(data.jobTitle || fallbackJobTitle(data.employeeNo, data.role)), employedAt: data.employedAt, probationPassed: !!data.probationPassed, employmentStatus: data.employmentStatus || (data.active === false ? "離職" : "在職"), active: data.active !== false });

async function profileFor(uid) {
  const profile = await get(ref(database, `users/${uid}`));
  if (!profile.exists()) throw new Error("此帳號尚未完成系統人員資料設定，請聯絡系統管理者。");
  if (profile.val().active === false) throw new Error("此帳號已停用，請聯絡系統管理者。");
  return profileShape(uid, profile.val());
}

async function loadData() {
  const [userData, applicationData, calendarsData, legacyCalendarData, historyData, courseData] = await Promise.all([get(ref(database, "users")), get(ref(database, "applications")), get(ref(database, "settings/hospitalCalendars")).catch(() => ({ val: () => null })), get(ref(database, "settings/hospitalCalendar/115")).catch(() => ({ val: () => null })), get(ref(database, "leaveHistory")).catch(() => ({ val: () => null })), get(ref(database, "courseSchedules")).catch(() => ({ val: () => null }))]);
  const users = userData.val() || {}, applications = applicationData.val() || {}, currentProfile = users[auth.currentUser?.uid];
  if (["director", "admin"].includes(currentProfile?.role)) { const hu = Object.entries(users).find(([, profile]) => String(profile.employeeNo) === "3851"); if (hu && hu[1].jobTitle !== "麻醉專科護理師") await update(ref(database), { [`users/${hu[0]}/jobTitle`]: "麻醉專科護理師", [`users/${hu[0]}/bookingGroup`]: "clinical", [`users/${hu[0]}/updatedAt`]: new Date().toISOString() }).catch(error => console.warn("職稱同步將於下次主管操作時重試", error)); }
  const calendars = calendarsData.val() || {}; if (!calendars[115] && legacyCalendarData.val()) calendars[115] = legacyCalendarData.val();
  return { accounts: Object.entries(users).map(([uid, data]) => profileShape(uid, data)), applications: Object.entries(applications).map(([id, data]) => ({ id, ...data })), hospitalCalendars: calendars, leaveHistory: Object.entries(historyData.val() || {}).map(([id, data]) => ({ id, ...data })), courseSchedules: courseData.val() || {} };
}

async function syncApplications(applications) {
  if (!auth.currentUser) return;
  const currentProfile = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
  const manager = ["director", "admin"].includes(currentProfile.role);
  const writable = manager ? applications : applications.filter((application) => (application.applicantId || application.userId) === auth.currentUser.uid && ["pending", "cancelled"].includes(application.status));
  const changes = {};
  writable.forEach((application) => { const { id, ...data } = application; changes[`applications/${id}`] = { ...data, updatedAt: new Date().toISOString() }; });
  if (!Object.keys(changes).length) return;
  await update(ref(database), changes);
}

async function syncLeaveHistory(applications) {
  const approved = applications.filter((application) => application.status === "approved");
  if (!approved.length) return;
  if (!auth.currentUser) return;
  const currentProfile = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
  if (!["director", "admin"].includes(currentProfile.role)) return;
  const users = (await get(ref(database, "users"))).val() || {}, changes = {};
  approved.forEach((application) => {
    const person = users[application.userId] || {};
    changes[`leaveHistory/${application.id}`] = { userId: application.userId, name: application.user || person.name || "未設定", employeeNo: person.employeeNo || "", plan: application.plan, start: application.start, end: application.end, days: application.days, requestedStart: application.requestedStart || application.start, requestedEnd: application.requestedEnd || application.end, requestedDays: application.requestedDays || application.days, actualEditedAt: application.actualEditedAt || null, actualEditedBy: application.actualEditedBy || null, approvedAt: application.approvedAt || application.updatedAt || new Date().toISOString(), source: "system" };
  });
  await update(ref(database), changes);
}

async function createEmployee({ name, employeeNo, jobTitle, password, employedAt, probationPassed }) {
  if (!auth.currentUser) throw new Error("請先以主管帳號登入。");
  const secondaryName = "employee-provisioning";
  const secondary = getApps().find((item) => item.name === secondaryName) || initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondary);
  let credential;
  try { credential = await createUserWithEmailAndPassword(secondaryAuth, authEmail(employeeNo), password); }
  finally { if (!credential) await signOut(secondaryAuth).catch(() => {}); }
  const profile = { name, employeeNo, role: roleForTitle(jobTitle), jobTitle, bookingGroup: groupForTitle(jobTitle), employedAt: employedAt || null, probationPassed: !!probationPassed, employmentStatus: "在職", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await set(ref(database, `users/${credential.user.uid}`), profile);
  await signOut(secondaryAuth);
  return credential.user.uid;
}

async function bulkCreateEmployees(entries, hospitalCalendar) {
  const results = [];
  for (const entry of entries) {
    try { await createEmployee(entry); results.push({ employeeNo: entry.employeeNo, ok: true }); }
    catch (error) { results.push({ employeeNo: entry.employeeNo, ok: false, error: error.code || error.message }); }
  }
  if (hospitalCalendar) await set(ref(database, "settings/hospitalCalendar/115"), { ...hospitalCalendar, updatedAt: new Date().toISOString() }).catch(error => console.warn("行事曆同步未完成，不影響人員帳號匯入", error));
  return results;
}

async function updateEmploymentStatus(uid, employmentStatus) { const enabled = employmentStatus !== "離職"; await update(ref(database, `users/${uid}`), { employmentStatus, active: enabled, updatedAt: new Date().toISOString() }); }
async function updateEmployee(uid, { name, jobTitle, employedAt, employmentStatus }) { const status = employmentStatus || "在職"; await update(ref(database, `users/${uid}`), { name, jobTitle, role: roleForTitle(jobTitle), bookingGroup: groupForTitle(jobTitle), employedAt, employmentStatus: status, active: status !== "離職", updatedAt: new Date().toISOString() }); }
async function removeEmployee(uid) { await update(ref(database, `users/${uid}`), { employmentStatus: "deleted", active: false, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }
async function saveCourseSchedule(year, schedule) { if (!auth.currentUser) throw new Error("請先登入主管帳號。"); const data = { ...schedule, year: Number(year), uploadedBy: auth.currentUser.uid, uploadedAt: new Date().toISOString() }; await set(ref(database, `courseSchedules/${year}`), data); return data; }
async function saveHospitalCalendar(year, calendar) { const data = { ...calendar, year: Number(year), updatedAt: new Date().toISOString() }; await update(ref(database), { [`settings/hospitalCalendars/${year}`]: data, [`settings/hospitalCalendar/${year}`]: data }); }
async function deleteLongLeaveApplication(id) {
  if (!auth.currentUser) throw new Error("請先登入主管帳號。");
  const profile = (await get(ref(database, `users/${auth.currentUser.uid}`))).val() || {};
  if (!["director", "admin"].includes(profile.role)) throw new Error("只有主管可刪除申請。");
  const now = new Date().toISOString();
  await update(ref(database), {
    [`applications/${id}/status`]: "deleted",
    [`applications/${id}/deletedAt`]: now,
    [`applications/${id}/deletedBy`]: profile.name || auth.currentUser.uid,
    [`leaveHistory/${id}/deleted`]: true,
    [`leaveHistory/${id}/deletedAt`]: now
  });
}
async function uploadHospitalCalendarPdf(year, file) { if (!auth.currentUser) throw new Error("請先以主管帳號登入。"); if (!file || file.type !== "application/pdf") throw new Error("請選擇 PDF 格式的院方行事曆。"); const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); const path = `hospitalCalendars/${year}/${Date.now()}_${safeName}`; const target = storageRef(storage, path); await uploadBytes(target, file, { contentType: "application/pdf" }); return { fileName: file.name, pdfUrl: await getDownloadURL(target), storagePath: path, uploadedAt: new Date().toISOString() }; }
async function updateEmploymentDates(entries) { const users = (await get(ref(database, "users"))).val() || {}, changes = {}, existing = Object.entries(users); entries.forEach(entry => { const match = existing.find(([, person]) => String(person.employeeNo).toUpperCase() === String(entry.employeeNo).toUpperCase()); if (match && entry.employedAt) changes[`users/${match[0]}/employedAt`] = entry.employedAt; }); await update(ref(database), changes); return { updated: Object.keys(changes).length, total: entries.length }; }

async function changeOwnPassword(newPassword) {
  if (!auth.currentUser) throw new Error("請先登入後再修改密碼。");
  if (typeof newPassword !== "string" || newPassword.length < 6) throw new Error("新密碼至少需要 6 個字元。");
  await updatePassword(auth.currentUser, newPassword);
}

window.firebaseBackend = { enabled: true, async login(account, password) { const credential = await signInWithEmailAndPassword(auth, authEmail(account), password); return profileFor(credential.user.uid); }, logout: () => signOut(auth), loadData, syncApplications, syncLeaveHistory, createEmployee, bulkCreateEmployees, updateEmploymentStatus, updateEmployee, removeEmployee, updateEmploymentDates, changeOwnPassword, saveCourseSchedule, saveHospitalCalendar, uploadHospitalCalendarPdf };
window.firebaseBackend.deleteLongLeaveApplication = deleteLongLeaveApplication;
window.dispatchEvent(new Event("firebase-ready"));
