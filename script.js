document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://attendance-backend-7m9r.onrender.com";

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
  function getUser() { return JSON.parse(localStorage.getItem("user") || "null"); }
  function clearUser() { localStorage.removeItem("user"); }

  // ======================
  // Safe Fetch Wrapper
  // ======================
  async function apiFetch(path, options = {}) {
    try {
      const token = getToken();
      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
      };
      if (token) headers.Authorization = "Bearer " + token;

      const res = await fetch(API_BASE + path, { ...options, headers });
      const text = await res.text();

      try {
        return JSON.parse(text);
      } catch {
        return { success: false, message: "Invalid server response" };
      }
    } catch (err) {
      return { success: false, message: "Network error: " + err.message };
    }
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
    document.getElementById(pageId).classList.remove("hidden");

    navItems.forEach(b => b.classList.remove("active"));
    document.querySelector(`.nav-item[data-page="${pageId}"]`)?.classList.add("active");
    sidebar.classList.remove("open");
  }

  // ======================
  // Header refresh
  // ======================
  function refreshHeader() {
    const user = getUser();
    if (!user) return;
    document.getElementById("welcomeText").textContent = `Welcome, ${user.name}`;
    document.getElementById("roleText").textContent = `Role: ${user.role.toUpperCase()}`;
    document.getElementById("enrolledPill").textContent =
      user.enrolledClass ? `Class: ${user.enrolledClass}` : "Not Enrolled";
  }

  // ======================
  // Auth Tabs
  // ======================
  let authMode = "login";

  const showLoginTab = document.getElementById("showLoginTab");
  const showSignupTab = document.getElementById("showSignupTab");
  const signupFields = document.getElementById("signupFields");
  const loginFields = document.getElementById("loginFields");
  const submitAuthBtn = document.getElementById("submitAuthBtn");
  const authTitle = document.getElementById("authTitle");

  function setAuthMode(mode) {
    authMode = mode;
    if (mode === "login") {
      showLoginTab.classList.add("active");
      showSignupTab.classList.remove("active");
      signupFields.classList.add("hidden");
      loginFields.classList.remove("hidden");
      submitAuthBtn.textContent = "Login";
      authTitle.textContent = "Login";
    } else {
      showSignupTab.classList.add("active");
      showLoginTab.classList.remove("active");
      signupFields.classList.remove("hidden");
      loginFields.classList.add("hidden");
      submitAuthBtn.textContent = "Signup";
      authTitle.textContent = "Signup";
    }
  }

  showLoginTab.addEventListener("click", () => setAuthMode("login"));
  showSignupTab.addEventListener("click", () => setAuthMode("signup"));

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

    if (!data.success) return msg(data.message || "Signup failed", "Error");

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

    if (!data.success) return msg(data.message || "Login failed", "Error");

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

  submitAuthBtn.addEventListener("click", () => {
    if (authMode === "login") login();
    else signup();
  });

  setAuthMode("login");

  // ======================
  // Admin cache
  // ======================
  let cachedUsers = [];
  let cachedClasses = [];
  let cachedSubjects = [];

  // ======================
  // Load Classes
  // ======================
  async function loadClasses() {
    const data = await apiFetch("/classes");
    if (!data.success) return [];

    cachedClasses = data.classes.map(c => c.name);

    const studentClassSelect = document.getElementById("studentClassSelect");
    const adminAttendanceClassSelect = document.getElementById("adminAttendanceClassSelect");

    [studentClassSelect, adminAttendanceClassSelect].forEach(sel => {
      if (!sel) return;
      sel.innerHTML = "";
      cachedClasses.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });
    });

    return cachedClasses;
  }

  // ======================
  // Load Subjects
  // ======================
  async function loadSubjects() {
    const data = await apiFetch("/subjects");
    if (!data.success) return [];

    cachedSubjects = data.subjects.map(s => s.name);

    const subjectSelect = document.getElementById("subjectSelect");
    if (subjectSelect) {
      subjectSelect.innerHTML = "";
      cachedSubjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        subjectSelect.appendChild(opt);
      });
    }

    const subjectsView = document.getElementById("subjectsView");
    if (subjectsView) {
      subjectsView.innerHTML = cachedSubjects.map((x, i) => `${i + 1}. <b>${x}</b>`).join("<br/>");
    }

    return cachedSubjects;
  }

  // ======================
  // Load Users (Admin)
  // ======================
  async function loadUsersForAdmin() {
    const data = await apiFetch("/owner/users");
    if (!data.success) return [];

    cachedUsers = data.users || [];

    renderUsersAdminList(cachedUsers);
    return cachedUsers;
  }

  function rolePillClass(role) {
    if (role === "owner") return "owner";
    if (role === "staff") return "staff";
    return "student";
  }

  function renderUsersAdminList(users) {
    const allUsersView = document.getElementById("allUsersView");
    if (!allUsersView) return;

    const search = document.getElementById("userSearch")?.value?.trim().toLowerCase() || "";
    const roleFilter = document.getElementById("roleFilter")?.value || "";

    const filtered = users.filter(u => {
      const hay = `${u.name} ${u.rollNumber} ${u.enrolledClass ?? ""}`.toLowerCase();
      const okSearch = !search || hay.includes(search);
      const okRole = !roleFilter || u.role === roleFilter;
      return okSearch && okRole;
    });

    if (filtered.length === 0) {
      allUsersView.innerHTML = `<div class="box">No users found.</div>`;
      return;
    }

    allUsersView.innerHTML = filtered.map(u => `
      <div class="user-card">
        <div class="user-title">
          <div>
            <b>${u.name}</b><br/>
            <span class="muted small">Roll: ${u.rollNumber ?? "-"} | Class: ${u.enrolledClass ?? "-"}</span>
          </div>
          <span class="role-pill ${rolePillClass(u.role)}">${(u.role || "student").toUpperCase()}</span>
        </div>

        <div class="user-actions">
          <button class="btn btn-alt" data-view-user="${u.rollNumber}">View Profile</button>
          <button class="btn btn-main" data-make-staff="${u.rollNumber}">Make STAFF</button>
          <button class="btn btn-danger" data-make-student="${u.rollNumber}">Make STUDENT</button>
        </div>
      </div>
    `).join("");
  }

  // ======================
  // Enrollment (Student)
  // ======================
  async function enroll() {
    const className = document.getElementById("studentClassSelect").value;

    setLoading(true);
    const data = await apiFetch("/enroll", {
      method: "POST",
      body: JSON.stringify({ className })
    });
    setLoading(false);

    if (!data.success) return msg(data.message || "Enroll failed", "Error");

    const me = await apiFetch("/me");
    if (me.success) setUser(me.user);

    refreshHeader();
    msg("Enrolled ✅", "Success");
  }

  // ======================
  // Attendance Calendar
  // ======================
  function formatMonthValue(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  function buildCalendar(year, month, records) {
    const grid = document.getElementById("calendarGrid");
    if (!grid) return;

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

  function calculatePercentage(records) {
    if (!records || records.length === 0) return 0;
    const attended = records.filter(r => r.status === "Present" || r.status === "On Duty (O/D)").length;
    return Math.round((attended / records.length) * 100);
  }

  async function loadStudentAttendanceAndCalendar() {
    const data = await apiFetch("/attendance");
    const box = document.getElementById("attendanceView");

    if (!data.success || !data.records || data.records.length === 0) {
      box.innerHTML = "No attendance";
    } else {
      box.innerHTML = data.records
        .map(r => `<b>${r.date}</b> | ${r.className} | <b>${r.status}</b>`)
        .join("<br/>");
    }

    const monthPicker = document.getElementById("monthPicker");
    if (monthPicker && !monthPicker.value) monthPicker.value = formatMonthValue(new Date());

    const [yy, mm] = (monthPicker?.value || formatMonthValue(new Date())).split("-").map(Number);
    buildCalendar(yy, mm - 1, data.records || []);

    const pct = calculatePercentage(data.records || []);
    document.getElementById("attPercent").textContent = `${pct}%`;
    document.getElementById("attRangeText").textContent = `This month`;
  }

  // ======================
  // Marks View
  // ======================
  async function loadStudentMarks() {
    const data = await apiFetch("/marks");
    const box = document.getElementById("marksView");

    if (!data.success || !data.records || data.records.length === 0) {
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
    if (!user) return;

    document.getElementById("editName").value = user.name || "";
    document.getElementById("editRoll").value = user.rollNumber || "";
    document.getElementById("editPassword").value = "";

    document.getElementById("profileInfoView").innerHTML =
      `<b>${user.name}</b><br/>Roll: ${user.rollNumber ?? "-"}<br/>${user.role}<br/>${user.enrolledClass ?? "Not enrolled"}`;

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
          gender: document.getElementById("genderSelect").value,
          phone: document.getElementById("phoneInput").value,
          dob: document.getElementById("dobInput").value,
          address: document.getElementById("addressInput").value,
          profilePic: base64
        })
      });
      setLoading(false);

      if (!data.success) return msg(data.message || "Upload failed", "Error");

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

    const gender = document.getElementById("genderSelect").value;
    const phone = document.getElementById("phoneInput").value;
    const dob = document.getElementById("dobInput").value;
    const address = document.getElementById("addressInput").value;

    if (!name || !rollNumber) return msg("Name + Roll required", "Warning");

    setLoading(true);
    const data = await apiFetch("/profile", {
      method: "POST",
      body: JSON.stringify({ name, rollNumber, gender, phone, dob, address, password })
    });
    setLoading(false);

    if (!data.success) return msg(data.message || "Update failed", "Error");

    setUser(data.user);
    refreshHeader();
    loadProfileUI();
    msg("Profile updated ✅", "Updated");
  }

  // ======================
  // Admin Attendance Button Mode
  // ======================
  const STATUS_ORDER = ["Present", "Absent", "On Duty (O/D)", "Leave"];

  function statusToBadgeClass(status){
    if(status === "Present") return "present";
    if(status === "Absent") return "absent";
    if(status === "On Duty (O/D)") return "od";
    if(status === "Leave") return "leave";
    return "none";
  }

  function nextStatus(current){
    const idx = STATUS_ORDER.indexOf(current);
    if(idx === -1) return "Present";
    return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
  }

  async function loadAdminAttendanceButtons() {
    const container = document.getElementById("adminAttendanceButtons");
    if(!container) return;

    const className = document.getElementById("adminAttendanceClassSelect").value;
    const date = document.getElementById("adminAttendanceDate").value || new Date().toISOString().split("T")[0];

    if(!cachedUsers.length) await loadUsersForAdmin();

    const students = cachedUsers.filter(u =>
      (u.role === "student" || u.role === "staff") && u.enrolledClass === className
    );

    if(students.length === 0){
      container.innerHTML = "No users enrolled in this class.";
      return;
    }

    container.innerHTML = "Loading attendance...";

    // requires backend route
    const data = await apiFetch("/owner/attendance/by-date", {
      method:"POST",
      body: JSON.stringify({ className, date })
    });

    const map = new Map();
    if(data.success && data.records){
      data.records.forEach(r => map.set(r.rollNumber, r.status));
    }

    container.innerHTML = "";

    students.forEach(s => {
      const currentStatus = map.get(s.rollNumber) || "";

      const btn = document.createElement("button");
      btn.className = "student-btn";
      btn.dataset.roll = s.rollNumber;
      btn.dataset.status = currentStatus;

      btn.innerHTML = `
        <div><b>${s.name}</b></div>
        <div class="muted small">Roll: ${s.rollNumber}</div>
        <div class="badge ${statusToBadgeClass(currentStatus)}">
          ${currentStatus || "Not Marked"}
        </div>
      `;

      btn.addEventListener("click", async () => {
        const cur = btn.dataset.status || "";
        const status = nextStatus(cur);

        btn.dataset.status = status;
        btn.querySelector(".badge").className = `badge ${statusToBadgeClass(status)}`;
        btn.querySelector(".badge").textContent = status;

        const save = await apiFetch("/owner/attendance", {
          method:"POST",
          body: JSON.stringify({ rollNumber:s.rollNumber, className, status, date })
        });

        if(!save.success){
          msg(save.message || "Failed to save attendance", "Error");
        }
      });

      container.appendChild(btn);
    });
  }

  // ======================
  // Add Student (Owner)
  // ======================
  async function addUser() {
    const name = document.getElementById("newUserName").value.trim();
    const rollNumber = document.getElementById("newUserRoll").value.trim();
    const email = document.getElementById("newUserEmail").value.trim().toLowerCase();
    const password = document.getElementById("newUserPass").value.trim();

    if (!name || !rollNumber || !email || !password) return msg("Fill all fields", "Warning");

    setLoading(true);
    const data = await apiFetch("/owner/add-user", {
      method:"POST",
      body: JSON.stringify({ name, rollNumber, email, password })
    });
    setLoading(false);

    if (!data.success) return msg(data.message || "Failed to add user", "Error");

    document.getElementById("newUserName").value = "";
    document.getElementById("newUserRoll").value = "";
    document.getElementById("newUserEmail").value = "";
    document.getElementById("newUserPass").value = "";

    msg("Student added ✅", "Success");
    await loadUsersForAdmin();
  }

  // ======================
  // Setup: Add Class / Subject
  // ======================
  async function addClass() {
    const name = document.getElementById("newClassName").value.trim();
    if(!name) return msg("Enter class name", "Warning");

    setLoading(true);
    const data = await apiFetch("/owner/class", {
      method:"POST",
      body: JSON.stringify({ name })
    });
    setLoading(false);

    if(!data.success) return msg(data.message || "Failed", "Error");

    document.getElementById("newClassName").value = "";
    msg("Class added ✅", "Success");
    await loadClasses();
  }

  async function addSubject() {
    const name = document.getElementById("newSubjectName").value.trim();
    if(!name) return msg("Enter subject name", "Warning");

    setLoading(true);
    const data = await apiFetch("/owner/subject", {
      method:"POST",
      body: JSON.stringify({ name })
    });
    setLoading(false);

    if(!data.success) return msg(data.message || "Failed", "Error");

    document.getElementById("newSubjectName").value = "";
    msg("Subject added ✅", "Success");
    await loadSubjects();
  }

  // ======================
  // Stats
  // ======================
  async function refreshStats() {
    const att = await apiFetch("/attendance");
    const marks = await apiFetch("/marks");
    const subs = await apiFetch("/subjects");

    document.getElementById("attStat").textContent = att.success ? (att.records?.length || 0) : 0;
    document.getElementById("marksStat").textContent = marks.success ? (marks.records?.length || 0) : 0;
    document.getElementById("subStat").textContent = subs.success ? (subs.subjects?.length || 0) : 0;
  }

  // ======================
  // Load App
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

    if (user.role === "owner" || user.role === "staff") {
      adminNavBlock.classList.remove("hidden");
      adminOnly.forEach(x => x.classList.remove("hidden"));
      studentOnly.forEach(x => x.classList.add("hidden"));

      await loadUsersForAdmin();
      await loadClasses();
      await loadSubjects();

      const d = document.getElementById("adminAttendanceDate");
      if (d && !d.value) d.value = new Date().toISOString().split("T")[0];

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
  // Sidebar + Nav
  // ======================
  document.getElementById("menuBtn").addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  navItems.forEach(btn => {
    btn.addEventListener("click", async () => {
      const page = btn.dataset.page;
      openPage(page);

      const user = getUser();

      if(page === "attendancePage"){
        if(user.role === "student"){
          await loadStudentAttendanceAndCalendar();
        }else{
          await loadAdminAttendanceButtons();
        }
      }

      if(page === "marksPage" && user.role === "student"){
        await loadStudentMarks();
      }

      if(page === "profilePage"){
        loadProfileUI();
        const monthPicker = document.getElementById("monthPicker");
        if(monthPicker && !monthPicker.value) monthPicker.value = formatMonthValue(new Date());
        await loadStudentAttendanceAndCalendar();
      }

      if(page === "adminUsersPage"){
        await loadUsersForAdmin();
      }

      await refreshStats();
    });
  });

  // ======================
  // Events
  // ======================
  document.getElementById("logoutBtn").addEventListener("click", logout);

  document.getElementById("enrollBtn").addEventListener("click", enroll);
  document.getElementById("saveMarksBtn").addEventListener("click", () => msg("Owner Marks Save requires backend route", "Info"));
  document.getElementById("saveProfileBtn").addEventListener("click", updateProfile);

  document.getElementById("addUserBtn").addEventListener("click", addUser);
  document.getElementById("addClassBtn").addEventListener("click", addClass);
  document.getElementById("addSubjectBtn").addEventListener("click", addSubject);

  // Admin attendance refresh triggers
  document.getElementById("adminAttendanceClassSelect")?.addEventListener("change", loadAdminAttendanceButtons);
  document.getElementById("adminAttendanceDate")?.addEventListener("change", loadAdminAttendanceButtons);

  // Users filter search
  document.getElementById("userSearch")?.addEventListener("input", () => renderUsersAdminList(cachedUsers));
  document.getElementById("roleFilter")?.addEventListener("change", () => renderUsersAdminList(cachedUsers));

  // Delegated click actions for user cards
  document.addEventListener("click", async (e) => {
    const viewRoll = e.target?.dataset?.viewUser;
    const makeStaff = e.target?.dataset?.makeStaff;
    const makeStudent = e.target?.dataset?.makeStudent;

    // View Profile (backend required)
    if(viewRoll){
      const data = await apiFetch(`/owner/user/${viewRoll}`);
      if(!data.success) return msg(data.message || "Backend route missing", "Error");

      const u = data.user;
      msg(
        `Name: ${u.name}\nRoll: ${u.rollNumber}\nRole: ${u.role}\nClass: ${u.enrolledClass ?? "-"}\nPhone: ${u.phone ?? "-"}\nGender: ${u.gender ?? "-"}\nDOB: ${u.dob ?? "-"}`,
        "User Profile"
      );
    }

    // Make Staff (backend required)
    if(makeStaff){
      const monitorClass = prompt("Enter class to monitor (example: A / CSE-A / IT-B)");
      if(!monitorClass) return;

      const data = await apiFetch(`/owner/user/${makeStaff}/role`, {
        method:"POST",
        body: JSON.stringify({ role:"staff", monitorClass })
      });

      if(!data.success) return msg(data.message || "Backend route missing", "Error");
      msg("Role updated to STAFF ✅", "Success");
      await loadUsersForAdmin();
    }

    // Make Student (backend required)
    if(makeStudent){
      const data = await apiFetch(`/owner/user/${makeStudent}/role`, {
        method:"POST",
        body: JSON.stringify({ role:"student", monitorClass:"" })
      });

      if(!data.success) return msg(data.message || "Backend route missing", "Error");
      msg("Role updated to STUDENT ✅", "Success");
      await loadUsersForAdmin();
    }
  });

  // Start
  loadApp();
});
