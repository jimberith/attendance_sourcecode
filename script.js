document.addEventListener("DOMContentLoaded", () => {
  const API_BASE = "https://attendance-backend-7m9r.onrender.com";

  const offlineScreen = document.getElementById("offlineScreen");
  const loadingOverlay = document.getElementById("loadingOverlay");

  function setLoading(on) {
    loadingOverlay.classList.toggle("hidden", !on);
  }

  function updateOnlineUI() {
    offlineScreen.classList.toggle("hidden", navigator.onLine);
  }

  window.addEventListener("online", updateOnlineUI);
  window.addEventListener("offline", updateOnlineUI);
  updateOnlineUI();

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

  function setToken(token) { localStorage.setItem("token", token); }
  function getToken() { return localStorage.getItem("token"); }
  function clearToken() { localStorage.removeItem("token"); }

  function setUser(user) { localStorage.setItem("user", JSON.stringify(user)); }
  function getUser() { return JSON.parse(localStorage.getItem("user") || "null"); }
  function clearUser() { localStorage.removeItem("user"); }

  async function apiFetch(path, options = {}) {
    try {
      const token = getToken();
      const headers = { ...(options.headers || {}) };

      if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
      if (token) headers.Authorization = "Bearer " + token;

      const res = await fetch(API_BASE + path, { ...options, headers });
      const text = await res.text();

      try { return JSON.parse(text); }
      catch { return { success: false, message: "Invalid server JSON", raw: text }; }
    } catch (err) {
      return { success: false, message: "Network error: " + err.message };
    }
  }

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

  function applyLocksUI() {
    const user = getUser();
    if (!user) return;

    const locks = user.locks || {};

    const saveProfileBtn = document.getElementById("saveProfileBtn");
    const registerFaceBtn = document.getElementById("registerFaceBtn");
    const uploadLabel = document.getElementById("uploadPhotoLabel");
    const profilePicInput = document.getElementById("profilePicInput");

    if (saveProfileBtn) saveProfileBtn.disabled = !!locks.profileUpdateLocked;
    if (registerFaceBtn) registerFaceBtn.disabled = !!locks.faceRegisterLocked;

    if (uploadLabel) uploadLabel.classList.toggle("locked", !!locks.photoUploadLocked);
    if (profilePicInput) profilePicInput.disabled = !!locks.photoUploadLocked;
  }

  let authMode = "login";
  const showLoginTab = document.getElementById("showLoginTab");
  const showSignupTab = document.getElementById("showSignupTab");
  const signupFields = document.getElementById("signupFields");
  const loginFields = document.getElementById("loginFields");
  const submitAuthBtn = document.getElementById("submitAuthBtn");
  const authTitle = document.getElementById("authTitle");

  function setAuthMode(mode) {
    authMode = mode;
    showLoginTab.classList.toggle("active", mode === "login");
    showSignupTab.classList.toggle("active", mode === "signup");
    signupFields.classList.toggle("hidden", mode !== "signup");
    loginFields.classList.toggle("hidden", mode !== "login");
    submitAuthBtn.textContent = mode === "login" ? "Login" : "Signup";
    authTitle.textContent = mode === "login" ? "Login" : "Signup";
  }

  showLoginTab.addEventListener("click", () => setAuthMode("login"));
  showSignupTab.addEventListener("click", () => setAuthMode("signup"));
  setAuthMode("login");

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
    loadApp();
  }

  function logout() {
    clearToken();
    clearUser();
    loadApp();
  }

  document.getElementById("logoutBtn").addEventListener("click", logout);
  submitAuthBtn.addEventListener("click", () => authMode === "login" ? login() : signup());

  document.getElementById("menuBtn").addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

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

    const studentClassSelect = document.getElementById("studentClassSelect");
    const adminAttendanceClassSelect = document.getElementById("adminAttendanceClassSelect");

    if (studentClassSelect) {
      studentClassSelect.innerHTML = "";
      cachedClasses.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        studentClassSelect.appendChild(opt);
      });
    }

    if (adminAttendanceClassSelect) {
      adminAttendanceClassSelect.innerHTML = "";
      cachedClasses.forEach(c => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        adminAttendanceClassSelect.appendChild(opt);
      });
    }

    return cachedClasses;
  }

  async function loadSubjects() {
    const data = await apiFetch("/subjects");
    if (!data.success) return [];

    cachedSubjects = (data.subjects || []).map(s => s.name);

    const subjectsView = document.getElementById("subjectsView");
    if (subjectsView) {
      subjectsView.innerHTML = cachedSubjects.map((s, i) => `${i + 1}. <b>${s}</b>`).join("<br/>");
    }

    return cachedSubjects;
  }

  document.getElementById("enrollBtn")?.addEventListener("click", async () => {
    const className = document.getElementById("studentClassSelect").value;
    if (!className) return;

    setLoading(true);
    const data = await apiFetch("/enroll", {
      method: "POST",
      body: JSON.stringify({ className })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    setUser(data.user);
    refreshHeader();
  });

  const STATUS_ORDER = ["Present", "Absent", "On Duty (O/D)", "Leave"];

  function statusClass(status) {
    if (status === "Present") return "present";
    if (status === "Absent") return "absent";
    if (status === "On Duty (O/D)") return "od";
    if (status === "Leave") return "leave";
    return "none";
  }

  function nextStatus(cur) {
    const idx = STATUS_ORDER.indexOf(cur);
    if (idx === -1) return "Present";
    return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
  }

  async function loadAdminAttendanceButtons() {
    const className = document.getElementById("adminAttendanceClassSelect")?.value;
    const date = document.getElementById("adminAttendanceDate")?.value;
    const container = document.getElementById("adminAttendanceButtons");
    if (!container) return;

    if (!className || !date) {
      container.innerHTML = "";
      return;
    }

    if (!cachedUsers.length) await loadUsersForAdmin();

    const students = cachedUsers.filter(u => u.enrolledClass === className && u.role === "student");

    const data = await apiFetch("/owner/attendance/by-date", {
      method: "POST",
      body: JSON.stringify({ className, date })
    });

    const map = new Map();
    if (data.success && data.records) data.records.forEach(r => map.set(r.rollNumber, r.status));

    container.innerHTML = "";

    students.forEach(s => {
      const current = map.get(s.rollNumber) || "";

      const btn = document.createElement("button");
      btn.className = "student-btn";
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
          method: "POST",
          body: JSON.stringify({
            rollNumber: s.rollNumber,
            className,
            status: newStatus,
            date
          })
        });
      });

      container.appendChild(btn);
    });
  }

  document.getElementById("adminAttendanceClassSelect")?.addEventListener("change", loadAdminAttendanceButtons);
  document.getElementById("adminAttendanceDate")?.addEventListener("change", loadAdminAttendanceButtons);

  async function loadStudentAttendance() {
    const data = await apiFetch("/attendance");
    const box = document.getElementById("attendanceView");
    if (!box) return;

    if (!data.success || !data.records?.length) {
      box.innerHTML = "No attendance";
      return;
    }

    box.innerHTML = data.records
      .map(r => `<b>${r.date}</b> | ${r.className} | <b>${r.status}</b>`)
      .join("<br/>");
  }

  async function loadResults(type = "internal") {
    const data = await apiFetch("/results");
    const box = document.getElementById("resultsView");
    if (!box) return;

    if (!data.success || !data.records?.length) {
      box.innerHTML = "No results";
      return;
    }

    box.innerHTML = data.records.map(r => {
      let value = 0;
      if (type === "internal") value = r.internal || 0;
      if (type === "assessment") value = r.assessment || 0;
      if (type === "exam") value = r.exam || 0;

      return `<b>${r.subject}</b> : ${value} / 100`;
    }).join("<br/>");
  }

  document.querySelectorAll("#resultsPage .results-tabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#resultsPage .results-tabs .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      loadResults(btn.dataset.type);
    });
  });

  async function loadCGPA() {
    const data = await apiFetch("/cgpa");
    if (data.success) {
      document.getElementById("cgpaText").textContent = Number(data.cgpa || 0).toFixed(2);
    }
  }

  document.getElementById("downloadPdfBtn")?.addEventListener("click", () => {
    window.open(API_BASE + "/marksheet/pdf", "_blank");
  });

  function loadProfileUI() {
    const user = getUser();
    if (!user) return;

    document.getElementById("editName").value = user.name || "";
    document.getElementById("editRoll").value = user.rollNumber || "";
    document.getElementById("genderSelect").value = user.gender || "";
    document.getElementById("phoneInput").value = user.phone || "";
    document.getElementById("dobInput").value = user.dob || "";
    document.getElementById("addressInput").value = user.address || "";
    document.getElementById("editPassword").value = "";

    document.getElementById("profileInfoView").innerHTML =
      `<b>${user.name}</b><br/>Roll: ${user.rollNumber}<br/>${user.role}<br/>${user.enrolledClass || "-"}`;

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

    applyLocksUI();
  }

  document.getElementById("profilePicInput")?.addEventListener("change", async (e) => {
    const user = getUser();
    if (!user) return;

    if (user?.locks?.photoUploadLocked) return msg("Photo upload locked", "Blocked");

    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      setLoading(true);
      const data = await apiFetch("/profile/photo", {
        method: "POST",
        body: JSON.stringify({ profilePic: reader.result })
      });
      setLoading(false);

      if (!data.success) return msg(data.message, "Error");

      setUser(data.user);
      loadProfileUI();
      msg("Photo updated", "Done");
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("saveProfileBtn")?.addEventListener("click", async () => {
    const user = getUser();
    if (!user) return;

    if (user?.locks?.profileUpdateLocked) return msg("Profile update locked", "Blocked");

    const name = document.getElementById("editName").value.trim();
    const rollNumber = document.getElementById("editRoll").value.trim();
    const phone = document.getElementById("phoneInput").value.trim();
    const gender = document.getElementById("genderSelect").value;
    const dob = document.getElementById("dobInput").value;
    const address = document.getElementById("addressInput").value;
    const password = document.getElementById("editPassword").value.trim();

    setLoading(true);
    const data = await apiFetch("/profile/update", {
      method: "POST",
      body: JSON.stringify({ name, rollNumber, phone, gender, dob, address, password })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    setUser(data.user);
    refreshHeader();
    loadProfileUI();
    msg("Profile updated", "Done");
  });

  async function registerFaceCamera() {
    const user = getUser();
    if (!user) return;

    if (user?.locks?.faceRegisterLocked) return msg("Face register locked", "Blocked");

    if (!user.enrolledClass) return msg("Enroll first", "Error");
    if (!navigator.mediaDevices?.getUserMedia) return msg("Camera not supported", "Error");

    let stream = null;
    let video = null;

    const stopCamera = () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      if (video) {
        video.srcObject = null;
        video.remove();
      }
    };

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });

      video = document.createElement("video");
      video.autoplay = true;
      video.playsInline = true;
      video.style.position = "fixed";
      video.style.left = "-9999px";
      document.body.appendChild(video);

      video.srcObject = stream;

      await new Promise(resolve => video.onloadedmetadata = resolve);
      await new Promise(r => setTimeout(r, 600));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.95));

      stopCamera();

      if (!blob) return msg("Capture failed", "Error");

      const formData = new FormData();
      formData.append("image", blob, "face.jpg");

      setLoading(true);
      const data = await apiFetch("/face/enroll", {
        method: "POST",
        body: formData
      });
      setLoading(false);

      if (!data.success) return msg(data.message, "Error");

      setUser(data.user);
      loadProfileUI();
      msg("Face registered", "Done");
    } catch (err) {
      stopCamera();
      msg("Camera error", "Error");
    }
  }

  document.getElementById("registerFaceBtn")?.addEventListener("click", registerFaceCamera);

  async function refreshStats() {
    const att = await apiFetch("/attendance");
    const subs = await apiFetch("/subjects");
    const res = await apiFetch("/results");

    document.getElementById("attStat").textContent = att.success ? att.records.length : 0;
    document.getElementById("subStat").textContent = subs.success ? subs.subjects.length : 0;
    document.getElementById("resStat").textContent = res.success ? res.records.length : 0;
  }

  async function addClass() {
    const name = document.getElementById("newClassName").value.trim();
    if (!name) return;

    setLoading(true);
    const data = await apiFetch("/owner/class", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    document.getElementById("newClassName").value = "";
    await loadClasses();
  }

  async function addSubject() {
    const name = document.getElementById("newSubjectName").value.trim();
    if (!name) return;

    setLoading(true);
    const data = await apiFetch("/owner/subject", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    setLoading(false);

    if (!data.success) return msg(data.message, "Error");

    document.getElementById("newSubjectName").value = "";
    await loadSubjects();
  }

  document.getElementById("addClassBtn")?.addEventListener("click", addClass);
  document.getElementById("addSubjectBtn")?.addEventListener("click", addSubject);

  function rolePillClass(role){
    if(role === "owner") return "owner";
    if(role === "staff") return "staff";
    return "student";
  }

  function renderUsersAdmin() {
    const view = document.getElementById("allUsersView");
    if (!view) return;

    view.innerHTML = cachedUsers.map(u => `
      <div class="user-card">
        <div class="user-title">
          <div>
            <b>${u.name}</b><br/>
            <span class="muted small">Roll: ${u.rollNumber} | Class: ${u.enrolledClass || "-"}</span>
          </div>
          <span class="role-pill ${rolePillClass(u.role)}">${u.role.toUpperCase()}</span>
        </div>

        <div class="user-actions">
          <button class="btn btn-alt" data-action="role" data-roll="${u.rollNumber}">
            ${u.role === "staff" ? "Make Student" : "Make Staff"}
          </button>

          <button class="btn btn-main" data-action="unlock" data-roll="${u.rollNumber}">
            Unlock Actions
          </button>

          <button class="btn btn-danger" data-action="lock" data-roll="${u.rollNumber}">
            Lock Actions
          </button>
        </div>
      </div>
    `).join("");

    view.querySelectorAll("button[data-action]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const roll = btn.dataset.roll;
        const action = btn.dataset.action;

        if(action === "role"){
          setLoading(true);
          const data = await apiFetch("/owner/user/role", {
            method:"POST",
            body: JSON.stringify({ rollNumber: roll })
          });
          setLoading(false);
          if(!data.success) return msg(data.message, "Error");
          await loadUsersForAdmin();
        }

        if(action === "unlock"){
          setLoading(true);
          const data = await apiFetch("/owner/user/unlock-actions", {
            method:"POST",
            body: JSON.stringify({ rollNumber: roll })
          });
          setLoading(false);
          if(!data.success) return msg(data.message, "Error");
          await loadUsersForAdmin();
        }

        if(action === "lock"){
          setLoading(true);
          const data = await apiFetch("/owner/user/lock-actions", {
            method:"POST",
            body: JSON.stringify({ rollNumber: roll })
          });
          setLoading(false);
          if(!data.success) return msg(data.message, "Error");
          await loadUsersForAdmin();
        }
      });
    });
  }

  navItems.forEach(btn => {
    btn.addEventListener("click", async () => {
      const page = btn.dataset.page;
      openPage(page);

      const user = getUser();
      if (!user) return;

      if (page === "attendancePage") {
        if (user.role === "student") await loadStudentAttendance();
        else {
          const d = document.getElementById("adminAttendanceDate");
          if (d && !d.value) d.value = new Date().toISOString().split("T")[0];
          await loadAdminAttendanceButtons();
        }
      }

      if (page === "resultsPage") {
        await loadResults("internal");
        await loadCGPA();
      }

      if (page === "profilePage") {
        loadProfileUI();
      }

      if (page === "adminUsersPage") {
        await loadUsersForAdmin();
      }

      if (page === "adminSetupPage") {
        await loadSubjects();
      }

      await refreshStats();
    });
  });

  async function loadApp() {
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
    applyLocksUI();

    if (me.user.role === "owner" || me.user.role === "staff") {
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
    openPage("dashboardPage");
  }

  loadApp();
});
