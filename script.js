document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://attendance-backend-f8ay.onrender.com";

  // ======================
  // Offline + Loading
  // ======================
  const offlineScreen = document.getElementById("offlineScreen");
  const loadingOverlay = document.getElementById("loadingOverlay");

  function setLoading(on) {
    if (on) loadingOverlay.classList.remove("hidden");
    else loadingOverlay.classList.add("hidden");
  }

  function updateOnlineUI() {
    if (navigator.onLine) offlineScreen.classList.add("hidden");
    else offlineScreen.classList.remove("hidden");
  }
  window.addEventListener("online", updateOnlineUI);
  window.addEventListener("offline", updateOnlineUI);
  updateOnlineUI();

  // ======================
  // Popup
  // ======================
  const popupOverlay = document.getElementById("popupOverlay");
  const popupTitle = document.getElementById("popupTitle");
  const popupMessage = document.getElementById("popupMessage");
  const popupOkBtn = document.getElementById("popupOkBtn");

  function msg(message, title = "Message") {
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    popupOverlay.classList.remove("hidden");
  }
  popupOkBtn.addEventListener("click", () => popupOverlay.classList.add("hidden"));
  popupOverlay.addEventListener("click", (e) => {
    if (e.target === popupOverlay) popupOverlay.classList.add("hidden");
  });

  // ======================
  // Token + Session
  // ======================
  function setToken(token) { localStorage.setItem("token", token); }
  function getToken() { return localStorage.getItem("token"); }
  function clearToken() { localStorage.removeItem("token"); }

  function setUser(user) { localStorage.setItem("user", JSON.stringify(user)); }
  function getUser() { return JSON.parse(localStorage.getItem("user")); }
  function clearUser() { localStorage.removeItem("user"); }

  async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (token) headers.Authorization = "Bearer " + token;

    const res = await fetch(API_BASE + path, { ...options, headers });
    return await res.json();
  }

  // ======================
  // UI Base
  // ======================
  const authSection = document.getElementById("authSection");
  const homeSection = document.getElementById("homeSection");
  const sidebar = document.getElementById("sidebar");
  const adminNavBlock = document.getElementById("adminNavBlock");

  const pages = document.querySelectorAll(".page");
  const navItems = document.querySelectorAll(".nav-item");
  const adminOnly = document.querySelectorAll(".admin-only");
  const studentOnly = document.querySelectorAll(".student-only");

  function openPage(pageId) {
    pages.forEach(p => p.classList.add("hidden"));
    const target = document.getElementById(pageId);
    target.classList.remove("hidden");

    navItems.forEach(b => b.classList.remove("active"));
    document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add("active");
    sidebar.classList.remove("open");
  }

  // ======================
  // Header refresh
  // ======================
  function refreshHeader() {
    const user = getUser();
    document.getElementById("welcomeText").textContent = `Welcome, ${user.name}`;
    document.getElementById("roleText").textContent = `Role: ${user.role.toUpperCase()}`;
    document.getElementById("enrolledPill").textContent =
      user.enrolledClass ? `Class: ${user.enrolledClass}` : "Not Enrolled";
  }

  // ======================
  // Signup / Login
  // ======================
  async function signup() {
    if (!navigator.onLine) return msg("Internet required", "Offline");

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const rollNumber = document.getElementById("rollNumber").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!name || !email || !rollNumber || !password) return msg("Fill all fields", "Warning");

    setLoading(true);
    const data = await apiFetch("/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, rollNumber, password })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    setToken(data.token);
    setUser(data.user);
    msg("Signup successful ✅", "Success");
    loadApp();
  }

  async function login() {
    if (!navigator.onLine) return msg("Internet required", "Offline");

    const loginId = document.getElementById("loginId").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!loginId || !password) return msg("Fill all fields", "Warning");

    setLoading(true);
    const data = await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ loginId, password })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    setToken(data.token);
    setUser(data.user);
    msg("Login successful ✅", "Success");
    loadApp();
  }

  function logout() {
    clearToken();
    clearUser();
    msg("Logged out ✅", "Logout");
    loadApp();
  }

  // ======================
  // Load Me
  // ======================
  async function loadMe() {
    const data = await apiFetch("/me");
    if (!data.success) return null;
    setUser(data.user);
    return data.user;
  }

  // ======================
  // Admin data loaders
  // ======================
  async function loadUsersForAdmin() {
    const data = await apiFetch("/owner/users");
    if (!data.success) return [];

    const users = data.users;

    const allUsersView = document.getElementById("allUsersView");
    if (allUsersView) {
      allUsersView.innerHTML = users.map(u =>
        `<b>${u.name}</b><br/>Roll: ${u.rollNumber ?? "-"}<br/>${u.role}<br/>${u.enrolledClass ?? "Not enrolled"}<br/><br/>`
      ).join("");
    }

    const students = users.filter(u => u.role === "student");

    const attendanceStudentSelect = document.getElementById("attendanceStudentSelect");
    const marksStudentSelect = document.getElementById("marksStudentSelect");

    [attendanceStudentSelect, marksStudentSelect].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = "";
      students.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.rollNumber;
        opt.textContent = `${s.name} (Roll: ${s.rollNumber})`;
        sel.appendChild(opt);
      });
    });

    return users;
  }

  async function loadClasses() {
    const data = await apiFetch("/classes");
    if (!data.success) return [];

    const classes = data.classes.map(c => c.name);

    const studentClassSelect = document.getElementById("studentClassSelect");
    const attendanceClassSelect = document.getElementById("attendanceClassSelect");

    [studentClassSelect, attendanceClassSelect].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = "";
      classes.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });
    });

    return classes;
  }

  async function loadSubjects() {
    const data = await apiFetch("/subjects");
    if (!data.success) return [];

    const subjects = data.subjects.map(s => s.name);

    const subjectSelect = document.getElementById("subjectSelect");
    if (subjectSelect) {
      subjectSelect.innerHTML = "";
      subjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        subjectSelect.appendChild(opt);
      });
    }

    const subjectsView = document.getElementById("subjectsView");
    if (subjectsView) {
      subjectsView.innerHTML = subjects.map((x, i) => `${i + 1}. <b>${x}</b>`).join("<br/>");
    }

    return subjects;
  }

  // ======================
  // Enrollment
  // ======================
  async function enroll() {
    const className = document.getElementById("studentClassSelect").value;

    setLoading(true);
    const data = await apiFetch("/enroll", {
      method: "POST",
      body: JSON.stringify({ className })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    await loadMe();
    refreshHeader();
    msg("Enrolled ✅", "Success");
  }

  // ======================
  // Attendance + Calendar + %
  // ======================
  function formatMonthValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function buildCalendar(year, month, records) {
    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";

    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const daysInMonth = last.getDate();
    const startDay = first.getDay();

    const map = new Map();
    records.forEach(r => map.set(r.date, r.status));

    for (let i = 0; i < startDay; i++) {
      const d = document.createElement("div");
      d.className = "day mutedday";
      grid.appendChild(d);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const status = map.get(dateStr);

      const d = document.createElement("div");
      d.className = "day";
      d.textContent = day;

      if (status === "Present") d.classList.add("present");
      if (status === "Absent") d.classList.add("absent");
      if (status === "On Duty (O/D)") d.classList.add("od");
      if (status === "Leave") d.classList.add("leave");

      d.addEventListener("click", () => {
        msg(status ? `${dateStr}\n${status}` : `${dateStr}\nNo Attendance`, "Calendar");
      });

      grid.appendChild(d);
    }
  }

  function calculatePercentage(records, start, end) {
    const s = new Date(start);
    const e = new Date(end);

    const filtered = records.filter(r => {
      const d = new Date(r.date);
      return d >= s && d <= e;
    });

    if (filtered.length === 0) return 0;

    const attended = filtered.filter(r => r.status === "Present" || r.status === "On Duty (O/D)").length;
    return Math.round((attended / filtered.length) * 100);
  }

  async function loadStudentAttendanceAndCalendar() {
    const data = await apiFetch("/attendance");
    const box = document.getElementById("attendanceView");

    if (!data.success || data.records.length === 0) {
      box.innerHTML = "No attendance";
    } else {
      box.innerHTML = data.records
        .map(r => `<b>${r.date}</b> | ${r.className} | <b>${r.status}</b>`)
        .join("<br/>");
    }

    const monthPicker = document.getElementById("monthPicker");
    if (!monthPicker.value) monthPicker.value = formatMonthValue(new Date());
    const [yy, mm] = monthPicker.value.split("-").map(Number);
    buildCalendar(yy, mm - 1, data.records);

    // Load admin range from backend (fallback to month)
    let rangeStart = "";
    let rangeEnd = "";

    const user = getUser();
    if (user.role === "owner") {
      const r = await apiFetch("/owner/range");
      if (r.success) {
        rangeStart = r.range.start || "";
        rangeEnd = r.range.end || "";
      }
    } else {
      // student can still view range set by admin
      // use /owner/range not allowed, so fallback:
      // use current month for student
    }

    if (!rangeStart || !rangeEnd) {
      const startFallback = new Date(yy, mm - 1, 1);
      const endFallback = new Date();
      rangeStart = startFallback.toISOString().split("T")[0];
      rangeEnd = endFallback.toISOString().split("T")[0];
    }

    const pct = calculatePercentage(data.records, rangeStart, rangeEnd);
    document.getElementById("attPercent").textContent = `${pct}%`;
    document.getElementById("attRangeText").textContent = `${rangeStart} → ${rangeEnd}`;
  }

  // ======================
  // Owner: Attendance / Marks / Range
  // ======================
  async function saveAttendance() {
    const rollNumber = document.getElementById("attendanceStudentSelect").value;
    const className = document.getElementById("attendanceClassSelect").value;
    const status = document.getElementById("attendanceStatus").value;
    const date = new Date().toISOString().split("T")[0];

    setLoading(true);
    const data = await apiFetch("/owner/attendance", {
      method: "POST",
      body: JSON.stringify({ rollNumber, className, status, date })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");
    msg("Attendance saved ✅", "Saved");
  }

  async function saveMarks() {
    const rollNumber = document.getElementById("marksStudentSelect").value;
    const subject = document.getElementById("subjectSelect").value;
    const marks = Number(document.getElementById("marksValue").value);

    if (isNaN(marks) || marks < 0 || marks > 100) return msg("Enter marks 0-100", "Warning");

    setLoading(true);
    const data = await apiFetch("/owner/marks", {
      method: "POST",
      body: JSON.stringify({ rollNumber, subject, marks })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    document.getElementById("marksValue").value = "";
    msg("Marks saved ✅", "Saved");
  }

  async function addUser() {
    const name = document.getElementById("newUserName").value.trim();
    const rollNumber = document.getElementById("newUserRoll").value.trim();
    const email = document.getElementById("newUserEmail").value.trim().toLowerCase();
    const password = document.getElementById("newUserPass").value.trim();

    if (!name || !rollNumber || !email || !password) return msg("Fill all fields", "Warning");

    setLoading(true);
    const data = await apiFetch("/owner/add-user", {
      method: "POST",
      body: JSON.stringify({ name, email, rollNumber, password })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    document.getElementById("newUserName").value = "";
    document.getElementById("newUserRoll").value = "";
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newUserPass").value = "";

    msg("Student added ✅", "Success");
    await loadUsersForAdmin();
  }

  async function addClass() {
    const name = document.getElementById("newClassName").value.trim();
    if (!name) return msg("Enter class name", "Warning");

    setLoading(true);
    const data = await apiFetch("/owner/class", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    document.getElementById("newClassName").value = "";
    msg("Class added ✅", "Success");
    await loadClasses();
  }

  async function addSubject() {
    const name = document.getElementById("newSubjectName").value.trim();
    if (!name) return msg("Enter subject name", "Warning");

    setLoading(true);
    const data = await apiFetch("/owner/subject", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    document.getElementById("newSubjectName").value = "";
    msg("Subject added ✅", "Success");
    await loadSubjects();
  }

  async function saveRange() {
    const start = document.getElementById("rangeStart").value;
    const end = document.getElementById("rangeEnd").value;
    if (!start || !end) return msg("Select range dates", "Warning");

    setLoading(true);
    const data = await apiFetch("/owner/range", {
      method: "POST",
      body: JSON.stringify({ start, end })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    msg("Range saved ✅", "Saved");
    await loadStudentAttendanceAndCalendar();
  }

  // ======================
  // Marks view
  // ======================
  async function loadStudentMarks() {
    const data = await apiFetch("/marks");
    const box = document.getElementById("marksView");

    if (!data.success || data.records.length === 0) {
      box.innerHTML = "No marks";
      return;
    }

    box.innerHTML = data.records.map(r => `<b>${r.subject}</b> : ${r.marks}/100`).join("<br/>");
  }

  // ======================
  // Profile UI
  // ======================
  function loadProfileUI() {
    const user = getUser();

    document.getElementById("editName").value = user.name || "";
    document.getElementById("editRoll").value = user.rollNumber || "";
    document.getElementById("editPassword").value = "";

    // No email shown
    document.getElementById("profileInfoView").innerHTML =
      `<b>${user.name}</b><br/>Roll: ${user.rollNumber}<br/>${user.role}<br/>${user.enrolledClass ?? "Not enrolled"}`;

    // pic
    const img = document.getElementById("profilePicPreview");
    const fallback = document.getElementById("picFallback");
    if (user.profilePic) {
      img.src = user.profilePic;
      img.style.display = "block";
      fallback.style.display = "none";
    } else {
      img.style.display = "none";
      fallback.style.display = "flex";
    }
  }

  // Upload photo
  document.getElementById("profilePicInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;

      setLoading(true);
      const data = await apiFetch("/profile", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("editName").value.trim(),
          rollNumber: document.getElementById("editRoll").value.trim(),
          gender: "",
          phone: "",
          dob: "",
          address: "",
          profilePic: base64
        })
      });
      setLoading(false);

      if (!data.success) return msg(data.message, "Error");

      setUser(data.user);
      loadProfileUI();
      msg("Profile photo updated ✅", "Updated");
    };
    reader.readAsDataURL(file);
  });

  async function updateProfile() {
    const name = document.getElementById("editName").value.trim();
    const rollNumber = document.getElementById("editRoll").value.trim();
    const password = document.getElementById("editPassword").value.trim();

    // additional fields
    const gender = document.getElementById("genderSelect")?.value ?? "";
    const phone = document.getElementById("phoneInput")?.value ?? "";
    const dob = document.getElementById("dobInput")?.value ?? "";
    const address = document.getElementById("addressInput")?.value ?? "";

    if (!name || !rollNumber) return msg("Name + Roll required", "Warning");

    setLoading(true);
    const data = await apiFetch("/profile", {
      method: "POST",
      body: JSON.stringify({ name, rollNumber, gender, phone, dob, address, password })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    setUser(data.user);
    refreshHeader();
    loadProfileUI();
    msg("Profile updated ✅", "Updated");
  }

  // ======================
  // Stats
  // ======================
  async function refreshStats() {
    const att = await apiFetch("/attendance");
    const marks = await apiFetch("/marks");
    const subs = await apiFetch("/subjects");

    document.getElementById("attStat").textContent = att.success ? att.records.length : 0;
    document.getElementById("marksStat").textContent = marks.success ? marks.records.length : 0;
    document.getElementById("subStat").textContent = subs.success ? subs.subjects.length : 0;
  }

  // ======================
  // Load app
  // ======================
  async function loadApp() {
    updateOnlineUI();

    const token = getToken();
    if (!token) {
      authSection.classList.remove("hidden");
      homeSection.classList.add("hidden");
      return;
    }

    setLoading(true);
    const me = await apiFetch("/me");
    setLoading(false);

    if (!me.success) {
      clearToken();
      clearUser();
      authSection.classList.remove("hidden");
      homeSection.classList.add("hidden");
      return;
    }

    setUser(me.user);

    authSection.classList.add("hidden");
    homeSection.classList.remove("hidden");
    refreshHeader();

    const user = getUser();

    if (user.role === "owner") {
      adminNavBlock.classList.remove("hidden");
      adminOnly.forEach(x => x.classList.remove("hidden"));
      studentOnly.forEach(x => x.classList.add("hidden"));

      await loadUsersForAdmin();
      await loadClasses();
      await loadSubjects();

      // show range box for owner
      const adminRangeBox = document.getElementById("adminRangeBox");
      adminRangeBox.classList.remove("hidden");

      // load saved range
      const r = await apiFetch("/owner/range");
      if (r.success) {
        document.getElementById("rangeStart").value = r.range.start || "";
        document.getElementById("rangeEnd").value = r.range.end || "";
      }
    } else {
      adminNavBlock.classList.add("hidden");
      adminOnly.forEach(x => x.classList.add("hidden"));
      studentOnly.forEach(x => x.classList.remove("hidden"));
    }

    await loadClasses();
    await refreshStats();
    openPage("dashboardPage");
  }

  // ======================
  // Events
  // ======================
  document.getElementById("signupBtn").addEventListener("click", signup);
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("logoutBtn").addEventListener("click", logout);

  document.getElementById("menuBtn").addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  navItems.forEach(btn => {
    btn.addEventListener("click", async () => {
      const page = btn.dataset.page;
      openPage(page);

      const user = getUser();

      if (page === "attendancePage" && user.role === "student") {
        await loadStudentAttendanceAndCalendar();
      }

      if (page === "marksPage" && user.role === "student") {
        await loadStudentMarks();
      }

      if (page === "profilePage") {
        loadProfileUI();
        if (user.role === "student") {
          // month picker init
          const monthPicker = document.getElementById("monthPicker");
          if (!monthPicker.value) monthPicker.value = formatMonthValue(new Date());
          await loadStudentAttendanceAndCalendar();
        }
      }

      await refreshStats();
    });
  });

  document.getElementById("enrollBtn").addEventListener("click", enroll);
  document.getElementById("addUserBtn").addEventListener("click", addUser);
  document.getElementById("addClassBtn").addEventListener("click", addClass);
  document.getElementById("addSubjectBtn").addEventListener("click", addSubject);

  document.getElementById("saveAttendanceBtn").addEventListener("click", saveAttendance);
  document.getElementById("saveMarksBtn").addEventListener("click", saveMarks);
  document.getElementById("saveProfileBtn").addEventListener("click", updateProfile);

  document.getElementById("saveRangeBtn")?.addEventListener("click", saveRange);

  // Start
  loadApp();
});
