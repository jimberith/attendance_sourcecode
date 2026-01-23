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
  // Fetch helper
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

      try { return JSON.parse(text); }
      catch { return { success: false, message: "Invalid server JSON" }; }
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
  setAuthMode("login");

  // ======================
  // Signup / Login / Logout
  // ======================
  async function signup() {
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

  document.getElementById("logoutBtn").addEventListener("click", logout);

  submitAuthBtn.addEventListener("click", () => {
    if (authMode === "login") login();
    else signup();
  });

  // Sidebar menu
  document.getElementById("menuBtn").addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  // ======================
  // Cached data
  // ======================
  let cachedUsers = [];
  let cachedClasses = [];
  let cachedSubjects = [];

  async function loadUsersForAdmin() {
    const data = await apiFetch("/owner/users");
    if (!data.success) return [];
    cachedUsers = data.users || [];
    renderUsersAdmin();
    return cachedUsers;
  }

  async function loadClasses() {
    const data = await apiFetch("/classes");
    if (!data.success) return [];

    cachedClasses = (data.classes || []).map(c => c.name);

    ["studentClassSelect", "adminAttendanceClassSelect", "marksClassSelect"].forEach(id => {
      const sel = document.getElementById(id);
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

  async function loadSubjects() {
    const data = await apiFetch("/subjects");
    if (!data.success) return [];

    cachedSubjects = (data.subjects || []).map(s => s.name);

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

    return cachedSubjects;
  }

  // ======================
  // Enroll
  // ======================
  document.getElementById("enrollBtn").addEventListener("click", async () => {
    const className = document.getElementById("studentClassSelect").value;

    setLoading(true);
    const data = await apiFetch("/enroll", {
      method: "POST",
      body: JSON.stringify({ className })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    const me = await apiFetch("/me");
    if (me.success) setUser(me.user);

    refreshHeader();
    msg("Enrolled ✅", "Success");
  });

  // ======================
  // Attendance cycle buttons (ADMIN)
  // ======================
  const STATUS_ORDER = ["Present", "Absent", "On Duty (O/D)", "Leave"];

  function statusClass(status){
    if(status === "Present") return "present";
    if(status === "Absent") return "absent";
    if(status === "On Duty (O/D)") return "od";
    if(status === "Leave") return "leave";
    return "none";
  }

  function nextStatus(cur){
    const idx = STATUS_ORDER.indexOf(cur);
    if(idx === -1) return "Present";
    return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
  }

  async function loadAdminAttendanceButtons(){
    const className = document.getElementById("adminAttendanceClassSelect").value;
    const date = document.getElementById("adminAttendanceDate").value;
    const container = document.getElementById("adminAttendanceButtons");

    container.innerHTML = "Loading...";

    if(!cachedUsers.length) await loadUsersForAdmin();

    const students = cachedUsers.filter(u =>
      u.enrolledClass === className && u.role !== "owner"
    );

    const data = await apiFetch("/owner/attendance/by-date", {
      method: "POST",
      body: JSON.stringify({ className, date })
    });

    const map = new Map();
    if(data.success && data.records){
      data.records.forEach(r => map.set(r.rollNumber, r.status));
    }

    container.innerHTML = "";

    if(students.length === 0){
      container.innerHTML = "No students enrolled in this class.";
      return;
    }

    students.forEach(s => {
      const current = map.get(s.rollNumber) || "";

      const btn = document.createElement("button");
      btn.className = "student-btn";
      btn.dataset.roll = s.rollNumber;
      btn.dataset.status = current;

      btn.innerHTML = `
        <div><b>${s.name}</b></div>
        <div class="muted small">Roll: ${s.rollNumber}</div>
        <div class="badge ${statusClass(current)}">${current || "Not Marked"}</div>
      `;

      btn.addEventListener("click", async () => {
        const newStatus = nextStatus(btn.dataset.status || "");
        btn.dataset.status = newStatus;

        const badge = btn.querySelector(".badge");
        badge.className = `badge ${statusClass(newStatus)}`;
        badge.textContent = newStatus;

        await apiFetch("/owner/attendance", {
          method:"POST",
          body: JSON.stringify({ rollNumber:s.rollNumber, className, status:newStatus, date })
        });
      });

      container.appendChild(btn);
    });
  }

  document.getElementById("adminAttendanceClassSelect").addEventListener("change", loadAdminAttendanceButtons);
  document.getElementById("adminAttendanceDate").addEventListener("change", loadAdminAttendanceButtons);

  // ======================
  // Student attendance view
  // ======================
  async function loadStudentAttendance(){
    const data = await apiFetch("/attendance");
    const box = document.getElementById("attendanceView");
    if(!data.success || !data.records.length){
      box.innerHTML = "No attendance";
      return;
    }
    box.innerHTML = data.records
      .map(r => `<b>${r.date}</b> | ${r.className} | <b>${r.status}</b>`)
      .join("<br/>");
  }

  // ======================
  // Results tabs (Student)
  // ======================
  document.getElementById("resultsBtn").addEventListener("click", () => {
    document.getElementById("resultsTabs").classList.toggle("hidden");
  });

  async function loadResults(type){
    const data = await apiFetch("/results");
    const box = document.getElementById("resultsView");

    if(!data.success || !data.records.length){
      box.innerHTML = "No results available.";
      return;
    }

    box.innerHTML = data.records.map(r => {
      let value = 0;
      if(type === "internal") value = r.internal;
      if(type === "assessment") value = r.assessment;
      if(type === "exam") value = r.exam;

      return `
        <div style="padding:10px;border-bottom:1px solid #e5e7eb;">
          <b>${r.subject}</b><br/>
          ${type.toUpperCase()}: <b>${value}</b><br/>
          Total: <b>${r.total}</b>/100
        </div>
      `;
    }).join("");
  }

  document.querySelectorAll("#resultsTabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#resultsTabs .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadResults(btn.dataset.type);
    });
  });

  // ======================
  // Marks upload (Admin)
  // ======================
  async function loadStudentsForMarksClass(){
    const className = document.getElementById("marksClassSelect").value;
    const sel = document.getElementById("marksStudentSelect");
    sel.innerHTML = "";

    if(!cachedUsers.length) await loadUsersForAdmin();

    const list = cachedUsers.filter(u => u.enrolledClass === className && u.role !== "owner");
    list.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.rollNumber;
      opt.textContent = `${u.name} (${u.rollNumber})`;
      sel.appendChild(opt);
    });
  }
  document.getElementById("marksClassSelect").addEventListener("change", loadStudentsForMarksClass);

  document.getElementById("saveMarksBtn").addEventListener("click", async () => {
    const className = document.getElementById("marksClassSelect").value;
    const rollNumber = document.getElementById("marksStudentSelect").value;
    const subject = document.getElementById("subjectSelect").value;

    const internal = Number(document.getElementById("internalMarks").value || 0);
    const assessment = Number(document.getElementById("assessmentMarks").value || 0);
    const exam = Number(document.getElementById("examMarks").value || 0);

    if(internal < 0 || internal > 30) return msg("Internal must be 0-30","Warning");
    if(assessment < 0 || assessment > 20) return msg("Assessment must be 0-20","Warning");
    if(exam < 0 || exam > 50) return msg("Exam must be 0-50","Warning");

    setLoading(true);
    const data = await apiFetch("/owner/marks", {
      method:"POST",
      body: JSON.stringify({ rollNumber, className, subject, internal, assessment, exam })
    });
    setLoading(false);

    if(!data.success) return msg(data.message || "Failed","Error");

    msg("Marks saved ✅ (Mail/WhatsApp works only if backend env configured)", "Success");
  });

  // ======================
  // CGPA
  // ======================
  async function loadCGPA(){
    const data = await apiFetch("/cgpa");
    if(data.success){
      document.getElementById("cgpaText").textContent = Number(data.cgpa).toFixed(2);
    }
  }

  // PDF download
  document.getElementById("downloadPdfBtn").addEventListener("click", () => {
    window.open(API_BASE + "/marksheet/pdf", "_blank");
  });

  // ======================
  // Admin Users list (buttons)
  // ======================
  async function setRole(rollNumber, role){
    setLoading(true);
    const data = await apiFetch("/owner/set-role", {
      method:"POST",
      body: JSON.stringify({ rollNumber, role })
    });
    setLoading(false);

    if(!data.success) return msg(data.message, "Error");
    msg(`Role changed to ${role} ✅`, "Success");
    await loadUsersForAdmin();
  }

  async function giveStaffPermission(staffRollNumber, className){
    setLoading(true);
    const data = await apiFetch("/owner/staff-permission", {
      method:"POST",
      body: JSON.stringify({ staffRollNumber, className })
    });
    setLoading(false);

    if(!data.success) return msg(data.message, "Error");
    msg("Staff permission granted ✅", "Success");
  }

  async function viewUserProfile(u){
    msg(
      `Name: ${u.name}\nRoll: ${u.rollNumber}\nEmail: ${u.email}\nRole: ${u.role}\nClass: ${u.enrolledClass || "-"}\nPhone: ${u.phone || "-"}`,
      "User Profile"
    );
  }

  function renderUsersAdmin(){
    const view = document.getElementById("allUsersView");
    if(!view) return;

    const q = (document.getElementById("userSearch").value || "").toLowerCase();
    const roleFilter = document.getElementById("roleFilter").value || "";

    const filtered = cachedUsers.filter(u => {
      const hay = `${u.name} ${u.rollNumber} ${u.enrolledClass || ""}`.toLowerCase();
      const okSearch = !q || hay.includes(q);
      const okRole = !roleFilter || u.role === roleFilter;
      return okSearch && okRole;
    });

    view.innerHTML = "";

    filtered.forEach(u => {
      const card = document.createElement("div");
      card.className = "user-card";

      card.innerHTML = `
        <div class="user-title">
          <div>
            <b>${u.name}</b><br/>
            <span class="muted small">Roll: ${u.rollNumber} | Class: ${u.enrolledClass || "-"}</span>
          </div>
          <span class="role-pill ${u.role}">${u.role.toUpperCase()}</span>
        </div>

        <div class="user-actions">
          <button class="btn btn-alt viewBtn">View</button>
          <button class="btn btn-main staffBtn">Make Staff</button>
          <button class="btn btn-danger studentBtn">Make Student</button>
        </div>

        <div style="margin-top:10px;">
          <label class="tiny-label">Assign Staff to Class</label>
          <select class="classSel"></select>
          <button class="btn btn-main giveBtn">Give Permission</button>
        </div>
      `;

      const sel = card.querySelector(".classSel");
      cachedClasses.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        sel.appendChild(opt);
      });

      card.querySelector(".viewBtn").addEventListener("click", () => viewUserProfile(u));
      card.querySelector(".staffBtn").addEventListener("click", () => setRole(u.rollNumber, "staff"));
      card.querySelector(".studentBtn").addEventListener("click", () => setRole(u.rollNumber, "student"));
      card.querySelector(".giveBtn").addEventListener("click", () => giveStaffPermission(u.rollNumber, sel.value));

      view.appendChild(card);
    });
  }

  document.getElementById("userSearch").addEventListener("input", renderUsersAdmin);
  document.getElementById("roleFilter").addEventListener("change", renderUsersAdmin);

  // ======================
  // Stats
  // ======================
  async function refreshStats(){
    const att = await apiFetch("/attendance");
    const subs = await apiFetch("/subjects");
    const results = await apiFetch("/results");

    document.getElementById("attStat").textContent = att.success ? att.records.length : 0;
    document.getElementById("subStat").textContent = subs.success ? subs.subjects.length : 0;
    document.getElementById("marksStat").textContent = results.success ? results.records.length : 0;
  }

  // ======================
  // Profile loading UI
  // ======================
  function loadProfileUI(){
    const user = getUser();
    if(!user) return;

    document.getElementById("editName").value = user.name || "";
    document.getElementById("editRoll").value = user.rollNumber || "";
    document.getElementById("genderSelect").value = user.gender || "";
    document.getElementById("phoneInput").value = user.phone || "";
    document.getElementById("dobInput").value = user.dob || "";
    document.getElementById("addressInput").value = user.address || "";
    document.getElementById("editPassword").value = "";

    document.getElementById("profileInfoView").innerHTML = `
      <b>${user.name}</b><br/>
      Roll: ${user.rollNumber}<br/>
      Email: ${user.email}<br/>
      Role: ${user.role}<br/>
      Class: ${user.enrolledClass || "Not enrolled"}
    `;

    const img = document.getElementById("profilePicPreview");
    const fallback = document.getElementById("picFallback");
    if(user.profilePic){
      img.src = user.profilePic;
      img.style.display = "block";
      fallback.style.display = "none";
    }else{
      img.style.display = "none";
      fallback.style.display = "flex";
    }
  }

  // photo upload
  document.getElementById("profilePicInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;

      setLoading(true);
      const data = await apiFetch("/profile", {
        method:"POST",
        body: JSON.stringify({ profilePic: base64 })
      });
      setLoading(false);

      if(!data.success) return msg(data.message, "Error");

      setUser(data.user);
      loadProfileUI();
      msg("Profile photo updated ✅", "Updated");
    };
    reader.readAsDataURL(file);
  });

  // update profile
  document.getElementById("saveProfileBtn").addEventListener("click", async () => {
    const name = document.getElementById("editName").value.trim();
    const rollNumber = document.getElementById("editRoll").value.trim();
    const phone = document.getElementById("phoneInput").value.trim();
    const gender = document.getElementById("genderSelect").value;
    const dob = document.getElementById("dobInput").value;
    const address = document.getElementById("addressInput").value;
    const password = document.getElementById("editPassword").value.trim();

    setLoading(true);
    const data = await apiFetch("/profile", {
      method:"POST",
      body: JSON.stringify({ name, rollNumber, phone, gender, dob, address, password })
    });
    setLoading(false);

    if(!data.success) return msg(data.message, "Error");

    setUser(data.user);
    refreshHeader();
    loadProfileUI();
    msg("Profile updated ✅", "Success");
  });

  // ======================
  // Navigation
  // ======================
  navItems.forEach(btn => {
    btn.addEventListener("click", async () => {
      const page = btn.dataset.page;
      openPage(page);

      const user = getUser();
      if(!user) return;

      if(page === "attendancePage"){
        if(user.role === "student"){
          await loadStudentAttendance();
        } else {
          const d = document.getElementById("adminAttendanceDate");
          if(!d.value) d.value = new Date().toISOString().split("T")[0];
          await loadAdminAttendanceButtons();
        }
      }

      if(page === "marksPage"){
        await loadResults("internal");
      }

      if(page === "profilePage"){
        loadProfileUI();
      }

      if(page === "adminUsersPage"){
        await loadUsersForAdmin();
      }

      await refreshStats();
      await loadCGPA();
    });
  });

  // ======================
  // App loader
  // ======================
  async function loadApp(){
    const token = getToken();

    if(!token){
      authSection.classList.remove("hidden");
      homeSection.classList.add("hidden");
      return;
    }

    setLoading(true);
    const me = await apiFetch("/me");
    setLoading(false);

    if(!me.success){
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

    if(me.user.role === "owner" || me.user.role === "staff"){
      adminNavBlock.classList.remove("hidden");
      adminOnly.forEach(x => x.classList.remove("hidden"));
      studentOnly.forEach(x => x.classList.add("hidden"));

      await loadUsersForAdmin();
    } else {
      adminNavBlock.classList.add("hidden");
      adminOnly.forEach(x => x.classList.add("hidden"));
      studentOnly.forEach(x => x.classList.remove("hidden"));
    }

    await loadClasses();
    await loadSubjects();
    await refreshStats();
    await loadCGPA();

    openPage("dashboardPage");
  }

  loadApp();
});
