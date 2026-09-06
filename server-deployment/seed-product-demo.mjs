const API = process.env.DEMO_SEED_API_URL || "http://localhost:4000";
const DEMO = "دمو";
const ADMIN_PHONE = process.env.SEED_SUPER_ADMIN_PHONE;
const ADMIN_PASSWORD = process.env.SEED_SUPER_ADMIN_PASSWORD;

if (process.env.DEMO_SEED_ENABLED === "false") {
  console.log("Demo seed is disabled.");
  process.exit(0);
}

if (!ADMIN_PHONE || !ADMIN_PASSWORD) {
  throw new Error("SEED_SUPER_ADMIN_PHONE and SEED_SUPER_ADMIN_PASSWORD are required");
}

const login = await fetch(`${API}/authentication/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ phoneNo: ADMIN_PHONE, password: ADMIN_PASSWORD }),
}).then(async (r) => {
  if (!r.ok) throw new Error(`Login failed: ${r.status} ${await r.text()}`);
  return r.json();
});

const token = login.result.token.accessToken;
const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const report = { created: {}, skipped: {}, failed: [] };

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${text.slice(0, 500)}`);
  return body;
}

function rows(response) {
  const result = response?.result ?? response;
  return result?.data ?? result?.contracts ?? (Array.isArray(result) ? result : []);
}

async function createMissing({ area, listPath, match, createPath, payloads }) {
  let existing = [];
  try { existing = rows(await api(listPath)); } catch (error) { report.failed.push({ area, phase: "list", error: error.message }); }
  report.created[area] = 0;
  report.skipped[area] = 0;
  for (const payload of payloads) {
    if (existing.some((item) => match(item, payload))) {
      report.skipped[area]++;
      continue;
    }
    try {
      const result = await api(createPath, { method: "POST", body: JSON.stringify(payload) });
      report.created[area]++;
      existing.push(result?.result ?? result);
    } catch (error) {
      report.failed.push({ area, name: payload.name || payload.title || payload.subject || payload.propertyNo, error: error.message });
    }
  }
  return existing;
}

const users = rows(await api("/users?page=0&size=100"));
const admin = users.find((user) => user.phoneNo === ADMIN_PHONE) || users[0];
if (!admin?.id) throw new Error("No local admin user found");

await createMissing({
  area: "indicators",
  listPath: "/indicator?page=0&size=100",
  createPath: "/indicator",
  match: (a, b) => a.key === b.key,
  payloads: [
    { title: "شماره پرونده دمو", format: "APK-${counter}", key: "inspection", counter: 1001 },
    { title: "شماره تسک دمو", format: "TSK-${counter}", key: "tasks", counter: 101 },
    { title: "شماره تیکت دمو", format: "TKT-${counter}", key: "ticket", counter: 201 },
    { title: "شماره ممیزی دمو", format: "AUD-${counter}", key: "audit", counter: 301 },
    { title: "شماره دستور پرداخت دمو", format: "PAY-${counter}", key: "paymentOrder", counter: 401 },
    { title: "شماره دستور پرداخت", format: "PAY-${counter}", key: "payment-order", counter: 501 },
    { title: "شماره نامه", format: "LTR-${counter}", key: "letter", counter: 601 },
  ],
});

const buyers = await createMissing({
  area: "buyers",
  listPath: "/buyers?page=0&size=100",
  createPath: "/buyers",
  match: (a, b) => a.name === b.name || a.nationalCode === b.nationalCode,
  payloads: [
    { name: `${DEMO}: شرکت فولاد البرز`, type: "legal", userId: admin.id, nationalCode: "14001234001", postalCode: "3419911111", contactNo: ["02833331101"], address: "قزوین، شهر صنعتی البرز", metadata: { nameEn: "Alborz Steel Co.", demo: true, segment: "صنایع فلزی" }, branches: [] },
    { name: `${DEMO}: صنایع غذایی دشت قزوین`, type: "legal", userId: admin.id, nationalCode: "14001234002", postalCode: "3419922222", contactNo: ["02833332202"], address: "قزوین، شهرک صنعتی کاسپین", metadata: { nameEn: "Qazvin Dasht Food Industries", demo: true, segment: "صنایع غذایی" }, branches: [] },
    { name: `${DEMO}: بازرگانی سپهر خاورمیانه`, type: "legal", userId: admin.id, nationalCode: "14001234003", postalCode: "3419933333", contactNo: ["02188770003"], address: "تهران، خیابان ولیعصر", metadata: { nameEn: "Sepehr Middle East Trading", demo: true, segment: "بازرگانی" }, branches: [] },
    { name: `${DEMO}: پتروشیمی آریا نوین`, type: "legal", userId: admin.id, nationalCode: "14001234004", postalCode: "7519944444", contactNo: ["07733334404"], address: "بوشهر، منطقه ویژه اقتصادی", metadata: { nameEn: "Arya Novin Petrochemical", demo: true, segment: "نفت و گاز" }, branches: [] },
    { name: `${DEMO}: توسعه تجهیزات پارس`, type: "legal", userId: admin.id, nationalCode: "14001234005", postalCode: "3419955555", contactNo: ["02833335505"], address: "قزوین، خیابان دانشگاه", metadata: { nameEn: "Pars Equipment Development", demo: true, segment: "تجهیزات" }, branches: [] },
    { name: `${DEMO}: محمد رضایی`, type: "natural", userId: admin.id, nationalCode: "0076543210", postalCode: "3419966666", contactNo: ["09121234567"], address: "قزوین، مینودر", metadata: { nameEn: "Mohammad Rezaei", demo: true, segment: "مشتری حقیقی" }, branches: [] },
  ],
});

const projects = await createMissing({
  area: "projects",
  listPath: "/project?page=0&size=100",
  createPath: "/project",
  match: (a, b) => a.name === b.name,
  payloads: [
    { name: `${DEMO}: استقرار نظام مدیریت کیفیت`, statuses: [{ name: "برنامه‌ریزی", order: 1 }, { name: "در حال انجام", order: 2 }, { name: "بازبینی", order: 3 }, { name: "انجام‌شده", order: 4 }], members: [admin.id], labels: [] },
    { name: `${DEMO}: توسعه خدمات بازرسی استان`, statuses: [{ name: "باز", order: 1 }, { name: "در حال انجام", order: 2 }, { name: "بسته", order: 3 }], members: [admin.id], labels: [] },
    { name: `${DEMO}: آماده‌سازی ارائه محصول`, statuses: [{ name: "برای انجام", order: 1 }, { name: "در حال انجام", order: 2 }, { name: "تکمیل", order: 3 }], members: [admin.id], labels: [] },
    { name: `${DEMO}: دیجیتال‌سازی دبیرخانه`, statuses: [{ name: "تحلیل", order: 1 }, { name: "اجرا", order: 2 }, { name: "تحویل", order: 3 }], members: [admin.id], labels: [] },
  ],
});

const demoProjects = projects.filter((p) => p?.name?.includes(DEMO));
for (const project of demoProjects) {
  if (!project.statuses?.length) {
    try {
      await api(`/project/${project.id}`, { method: "PATCH", body: JSON.stringify({ name: project.name, members: [admin.id], labels: [], statuses: [{ name: "برای انجام", order: 1 }, { name: "در حال انجام", order: 2 }, { name: "بازبینی", order: 3 }, { name: "انجام‌شده", order: 4 }] }) });
      project.statuses = [{ name: "برای انجام" }, { name: "در حال انجام" }, { name: "بازبینی" }, { name: "انجام‌شده" }];
    } catch (error) { report.failed.push({ area: "projects", name: project.name, phase: "add-statuses", error: error.message }); }
  }
}
const taskTemplates = [
  ["تکمیل ماتریس فرایندها", "برنامه‌ریزی", 25, 2],
  ["بازبینی چک‌لیست بازرسی COI", "در حال انجام", 60, 3],
  ["آماده‌سازی گزارش مدیریتی ماهانه", "بازبینی", 85, 2],
  ["تطبیق قالب قرارداد پرسنل", "انجام‌شده", 100, 1],
  ["ثبت شاخص‌های کیفیت خدمات", "در حال انجام", 45, 3],
  ["کنترل اقلام تحویلی پروژه", "برای انجام", 10, 2],
  ["مرور نامه‌های نیازمند پاسخ", "اجرا", 70, 2],
  ["آماده‌سازی جلسه معرفی محصول", "تکمیل", 100, 1],
];
await createMissing({
  area: "projectTasks",
  listPath: "/project-task?page=0&size=200",
  createPath: "/project-task",
  match: (a, b) => a.title === b.title,
  payloads: taskTemplates.map((t, i) => ({
    title: `${DEMO}: ${t[0]}`,
    description: "رکورد نمایشی برای معرفی قابلیت مدیریت پروژه و پیگیری پیشرفت.",
    status: t[1], assignee: admin.id, deadline: new Date(Date.now() + (i + 2) * 86400000).toISOString(),
    priority: t[3], project: demoProjects[i % demoProjects.length]?.id, progress: t[2], labels: [],
    isConfidential: false,
  })).filter((p) => p.project),
});

await createMissing({
  area: "tickets",
  listPath: "/tickets?page=0&size=100",
  createPath: "/tickets",
  match: (a, b) => a.subject === b.subject,
  payloads: [
    ["پیگیری کالیبراسیون تجهیزات", 3, "quality"], ["اصلاح اطلاعات پرونده بازرسی", 2, "inspection"],
    ["درخواست گزارش مالی پروژه", 2, "finance"], ["بررسی دسترسی کاربر جدید", 1, "support"],
    ["پاسخ به نامه مشتری", 3, "secretariat"], ["تمدید قرارداد بازرس", 2, "hr"],
  ].map(([subject, priority], i) => ({ subject: `${DEMO}: ${subject}`, indicatorKey: "ticket", content: "این تیکت برای نمایش کارتابل پیگیری و اولویت‌بندی ایجاد شده است.", priority, assignee: admin.id, deadlinedAt: new Date(Date.now() + (i + 1) * 86400000).toISOString() })),
});

await createMissing({
  area: "courses",
  listPath: "/education/courses?page=0&size=100",
  createPath: "/education/courses",
  match: (a, b) => a.title === b.title,
  payloads: [
    { title: `${DEMO}: آشنایی با ISO 9001`, instructor: "مهندس سارا احمدی", startDate: "2026-09-10T05:30:00.000Z", endDate: "2026-09-11T12:30:00.000Z", time: "09:00 تا 16:00", place: "سالن آموزش قزوین", status: "notStarted", users: [admin.id] },
    { title: `${DEMO}: اصول نمونه‌برداری کالا`, instructor: "مهندس علی اکبری", startDate: "2026-09-01T05:30:00.000Z", endDate: "2026-09-03T12:30:00.000Z", time: "09:00 تا 16:00", place: "کارگاه فنی", status: "started", users: [admin.id] },
    { title: `${DEMO}: ایمنی بازرسی در محل`, instructor: "دکتر مریم شریفی", startDate: "2026-08-10T05:30:00.000Z", endDate: "2026-08-12T12:30:00.000Z", time: "08:30 تا 15:30", place: "مرکز آموزش", status: "ended", users: [admin.id] },
  ],
});

await createMissing({
  area: "contracts",
  listPath: "/contract?page=0&size=100",
  createPath: "/contract",
  match: (a, b) => a.contractNo === b.contractNo,
  payloads: ["active", "pending", "draft"].map((status, i) => ({
    userId: admin.id, contractNo: `APK-DEMO-1405-00${i + 1}`, damages: "طبق مفاد قرارداد و آیین‌نامه‌های شرکت",
    signDate: new Date(2026, 7, 20 + i).toISOString(), jobs: [], startDate: new Date(2026, 8, 1).toISOString(),
    endDate: new Date(2027, 7, 31).toISOString(), period: 12, salaryType: "monthly", workplace: "دفتر مرکزی آتیه پژوهان کیفیت",
    bankAccountNumber: `010000000000${i + 1}`, bankName: "بانک ملت", bankBranch: "قزوین مرکزی", salaryAmount: 250000000 + i * 30000000, status, approvers: [],
  })),
});

await createMissing({
  area: "audits",
  listPath: "/audit?page=0&size=100",
  createPath: "/audit",
  match: (a, b) => a.auditNo === b.auditNo,
  payloads: [
    ["ممیزی داخلی فرایند بازرسی", "APK-AUD-DEMO-001", "فرایندی", true],
    ["ممیزی مستندات منابع انسانی", "APK-AUD-DEMO-002", "مستندات", true],
    ["ممیزی تجهیزات و کالیبراسیون", "APK-AUD-DEMO-003", "تجهیزات", false],
    ["ممیزی رضایت مشتریان", "APK-AUD-DEMO-004", "مشتریان", false],
  ].map(([title, auditNo, category, state], i) => ({ title: `${DEMO}: ${title}`, changeDescription: "نمونه برنامه ممیزی برای نمایش ماژول مدیریت کیفیت", auditNo, category, reviewNumber: `REV-${i + 1}`, date: new Date(Date.now() + (i + 3) * 86400000).toISOString(), state, producerId: admin.id, seconderId: admin.id, approverId: admin.id, users: [admin.id], userGroups: [] })),
});

let branchId;
try {
  const branchResponse = await api("/branch?page=0&size=100");
  branchId = rows(branchResponse)[0]?.id;
} catch {}

if (!branchId) {
  try {
    const createdBranch = await api("/branch", {
      method: "POST",
      body: JSON.stringify({
        name: "qazvin-head-office",
        title: "دفتر مرکزی قزوین",
        managerId: admin.id,
      }),
    });
    branchId = (createdBranch?.result ?? createdBranch)?.id;
  } catch (error) {
    report.failed.push({ area: "branches", phase: "create", error: error.message });
  }
}

if (branchId) {
  await createMissing({
    area: "properties",
    listPath: "/property?page=0&size=100",
    createPath: "/property",
    match: (a, b) => a.propertyNo === b.propertyNo,
    payloads: [
      ["تجهیزات آزمایشگاهی", "APK-DEMO-EQ-001", "ترازوی دیجیتال", "SARTORIUS-001", 480000000],
      ["تجهیزات بازرسی", "APK-DEMO-EQ-002", "ضخامت‌سنج التراسونیک", "UT-2026-002", 920000000],
      ["رایانه", "APK-DEMO-IT-003", "لپ‌تاپ کارشناسی", "LAP-2026-003", 650000000],
      ["تجهیزات اداری", "APK-DEMO-OF-004", "ویدئو پروژکتور", "VP-2026-004", 310000000],
    ].map(([type, propertyNo, model, serialNumber, purchasePrice]) => ({ type, propertyNo, model, manufacturer: "تأمین‌کننده دمو", serialNumber, purchaseDate: "2026-03-21T00:00:00.000Z", purchasePrice, currentValue: Math.round(purchasePrice * .85), depreciationRate: 15, location: { building: "ساختمان مرکزی", branchId, floor: "طبقه 3", room: "واحد فنی" }, supplierName: "شرکت تجهیزات سنجش دمو", technicalSpecifications: "دارای گواهی کالیبراسیون معتبر" })),
  });
} else {
  report.failed.push({ area: "properties", phase: "prerequisite", error: "No branch exists; property records were not fabricated with an invalid branchId." });
}

const definitions = rows(await api("/process-definitions/list?page=0&size=100"));
const existingInstances = rows(await api("/process-instances?page=0&size=500"));
report.created.instances = 0;
report.skipped.instances = 0;
for (const definition of definitions.filter((d) => d.displayable)) {
  const currentCount = existingInstances.filter((i) => i.processDefinitionKey === definition.key).length;
  if (definition.useCN) continue;
  const desired = definition.key.includes("Sampling") ? 3 : 2;
  for (let i = currentCount; i < desired; i++) {
    const customer = buyers[(report.created.instances + i) % Math.max(buyers.length, 1)];
    const parameters = {
      demo: true,
      demoTitle: `${DEMO}: ${definition.name} - پرونده ${i + 1}`,
      description: "پرونده نمایشی ایجادشده برای معرفی قابلیت‌های سامانه APK",
      customerId: customer?.id,
      customerName: customer?.name,
      requesterName: "واحد توسعه بازار آتیه پژوهان کیفیت",
      referenceNo: `APK-DEMO-${definition.key}-${String(i + 1).padStart(2, "0")}`,
      requestedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    };
    try {
      await api(`/process-instances/run/${definition.id}`, { method: "POST", body: JSON.stringify({ parameters, checkCredit: false, amount: 0 }) });
      report.created.instances++;
    } catch (error) {
      report.failed.push({ area: "instances", name: definition.key, error: error.message });
    }
  }
  if (currentCount >= desired) report.skipped.instances += desired;
}

const verification = {};
for (const [name, path] of Object.entries({
  buyers: "/buyers?page=0&size=200", projects: "/project?page=0&size=200", projectTasks: "/project-task?page=0&size=200",
  tickets: "/tickets?page=0&size=200", courses: "/education/courses?page=0&size=200", contracts: "/contract?page=0&size=200",
  properties: "/property?page=0&size=200", instances: "/process-instances?page=0&size=500",
  audits: "/audit?page=0&size=200",
})) {
  try { verification[name] = rows(await api(path)).length; } catch { verification[name] = null; }
}
report.verification = verification;
report.generatedAt = new Date().toISOString();
console.log(JSON.stringify(report, null, 2));
if (report.failed.length > 0) process.exitCode = 1;
