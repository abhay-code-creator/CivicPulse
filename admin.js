const $ = s => document.querySelector(s);

let complaints = [];


/* =========================================================
   TOAST
   ========================================================= */

function toast(msg) {
  const t = $("#toast");

  t.textContent = msg;
  t.classList.add("show");

  setTimeout(() => {
    t.classList.remove("show");
  }, 2400);
}


/* =========================================================
   THEME
   ========================================================= */

$("#themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");

  $("#themeBtn").textContent =
    document.body.classList.contains("dark")
      ? "☀"
      : "☾";
});


/* =========================================================
   PASSWORD VISIBILITY
   ========================================================= */

const passwordInput = $("#password");
const passwordToggle = $("#passwordToggle");
const eyeIcon = $("#eyeIcon");


function showPasswordToggle() {
  passwordToggle.style.display = "flex";
}


function hidePasswordToggle() {
  passwordToggle.style.display = "none";

  passwordInput.type = "password";

  passwordToggle.setAttribute(
    "aria-label",
    "Show password"
  );

  passwordToggle.setAttribute(
    "title",
    "Show password"
  );
}


/*
 * The eye appears only when the user actually
 * enters/pastes something into the password field.
 *
 * Autofilled passwords do not trigger this input
 * event in many browsers, so the eye stays hidden.
 */

passwordInput.addEventListener("input", () => {

  if (passwordInput.value.length > 0) {
    showPasswordToggle();
  } else {
    hidePasswordToggle();
  }

});


passwordToggle.addEventListener("click", () => {

  if (passwordInput.type === "password") {

    passwordInput.type = "text";

    passwordToggle.setAttribute(
      "aria-label",
      "Hide password"
    );

    passwordToggle.setAttribute(
      "title",
      "Hide password"
    );

    eyeIcon.innerHTML = `
      <path d="M3 3l18 18"></path>
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"></path>
      <path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c6.5 0 10 7 10 7a17.4 17.4 0 0 1-3.2 3.9"></path>
      <path d="M6.6 6.6C3.8 8.3 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.3 3.5-.7"></path>
    `;

  } else {

    passwordInput.type = "password";

    passwordToggle.setAttribute(
      "aria-label",
      "Show password"
    );

    passwordToggle.setAttribute(
      "title",
      "Show password"
    );

    eyeIcon.innerHTML = `
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>
      <circle cx="12" cy="12" r="2.5"></circle>
    `;

  }

});


/* =========================================================
   API HELPER
   ========================================================= */

async function api(url, options = {}) {

  const res = await fetch(url, options);

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok) {

    throw new Error(
      data.message || "Request failed"
    );

  }

  return data;
}


/* =========================================================
   AUTH CHECK
   ========================================================= */

async function checkAuth() {

  try {

    const me =
      await api("/api/admin/me");

    if (me.logged_in) {

      $("#loginOverlay").style.display =
        "none";

      await refreshAll();

    }

  } catch (e) {

    // Keep login screen visible.

  }

}


/* =========================================================
   LOGIN
   ========================================================= */

$("#loginForm").addEventListener(
  "submit",
  async e => {

    e.preventDefault();

    $("#loginError").textContent = "";

    const button =
      $("#loginForm button[type='submit']");

    const originalText =
      button.innerHTML;

    button.disabled = true;

    button.innerHTML = `
      <span class="loading-spinner"></span>
      Signing in…
    `;

    try {

      await api(
        "/api/admin/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            username:
              $("#username").value,

            password:
              $("#password").value
          })
        }
      );

      $("#loginOverlay").style.display =
        "none";

      await refreshAll();

    } catch (err) {

      $("#loginError").textContent =
        err.message;

    } finally {

      button.disabled = false;

      button.innerHTML =
        originalText;

    }

  }
);


/* =========================================================
   LOGOUT
   ========================================================= */

$("#logoutBtn").addEventListener(
  "click",
  async () => {

    try {

      await api(
        "/api/admin/logout",
        {
          method: "POST"
        }
      );

      location.reload();

    } catch (err) {

      toast(err.message);

    }

  }
);


/* =========================================================
   REFRESH
   ========================================================= */

$("#refreshBtn").addEventListener(
  "click",
  async () => {

    const btn =
      $("#refreshBtn");

    btn.classList.add("refreshing");

    btn.innerHTML = `
      ↻ Refreshing…
    `;

    try {

      await refreshAll();

      toast("Dashboard refreshed.");

    } finally {

      btn.classList.remove(
        "refreshing"
      );

      btn.innerHTML =
        "↻ Refresh data";

    }

  }
);


/* =========================================================
   SEARCH / FILTERS
   ========================================================= */

[
  "#search",
  "#filterStatus",
  "#filterCategory"
].forEach(selector => {

  $(selector).addEventListener(
    "input",
    loadComplaints
  );

});


/* =========================================================
   REFRESH EVERYTHING
   ========================================================= */

async function refreshAll() {

  await Promise.all([
    loadStats(),
    loadComplaints()
  ]);

}


/* =========================================================
   LOAD STATS
   ========================================================= */

async function loadStats() {

  const d =
    await api("/api/stats");

  const o =
    d.overall || {};


  $("#mTotal").textContent =
    o.total || 0;

  $("#mSubmitted").textContent =
    o.submitted || 0;

  $("#mAssigned").textContent =
    o.assigned || 0;

  $("#mProgress").textContent =
    o.in_progress || 0;

  $("#mResolved").textContent =
    o.resolved || 0;


  /* -------------------------------------------------------
     Daily activity
     ------------------------------------------------------- */

  const max =
    Math.max(
      1,
      ...(d.daily || []).map(
        x => x.count
      )
    );


  $("#dailyChart").innerHTML =
    d.daily && d.daily.length

      ? d.daily.map(x => `
          <div class="cat-row">

            <span>
              ${escapeHtml(x.day)}
            </span>

            <div class="bar">

              <i
                style="
                  width:${x.count / max * 100}%
                ">
              </i>

            </div>

            <b>
              ${x.count}
            </b>

          </div>
        `).join("")

      : `
        <p
          style="
            font-size:12px;
            color:#718094
          ">

          No recent activity.

        </p>
      `;


  /* -------------------------------------------------------
     Category activity
     ------------------------------------------------------- */

  const total =
    Math.max(
      1,
      (d.categories || [])
        .reduce(
          (a, x) =>
            a + x.count,
          0
        )
    );


  $("#categoryChart").innerHTML =
    d.categories && d.categories.length

      ? d.categories.map(x => `
          <div class="cat-row">

            <span>
              ${escapeHtml(x.category)}
            </span>

            <div class="bar">

              <i
                style="
                  width:${x.count / total * 100}%
                ">
              </i>

            </div>

            <b>
              ${x.count}
            </b>

          </div>
        `).join("")

      : `
        <p
          style="
            font-size:12px;
            color:#718094
          ">

          No complaints yet.

        </p>
      `;

}


/* =========================================================
   LOAD COMPLAINTS
   ========================================================= */

async function loadComplaints() {

  const params =
    new URLSearchParams({
      q: $("#search").value,
      status: $("#filterStatus").value,
      category: $("#filterCategory").value
    });


  try {

    const d =
      await api(
        "/api/complaints?" +
        params.toString()
      );

    complaints =
      d.complaints || [];

    renderRows();

  } catch (err) {

    toast(err.message);

  }

}


/* =========================================================
   RENDER COMPLAINT TABLE
   ========================================================= */

function renderRows() {

  $("#queueCount").textContent =
    `${complaints.length} records`;


  $("#rows").innerHTML =
    complaints.map(c => `

      <tr>

        <td>
          <b>
            ${escapeHtml(c.complaint_id)}
          </b>
        </td>

        <td>
          ${escapeHtml(c.name)}
        </td>

        <td>
          ${escapeHtml(c.category)}
        </td>

        <td>
          ${escapeHtml(c.location)}
        </td>

        <td>
          <span class="badge">
            ${escapeHtml(c.priority)}
          </span>
        </td>

        <td>

          <button
            class="status-btn ${statusClass(c.status)}"
            onclick="openDetail('${escapeJs(c.complaint_id)}')">

            ${escapeHtml(c.status)}

          </button>

        </td>

        <td>

          <button
            class="btn ghost"
            style="
              padding:7px 10px;
              font-size:10px
            "
            onclick="openDetail('${escapeJs(c.complaint_id)}')">

            View

          </button>

        </td>

      </tr>

    `).join("")

    || `

      <tr>

        <td
          colspan="7"
          style="
            text-align:center;
            padding:35px;
            color:#718094
          ">

          No complaints match your filters.

        </td>

      </tr>

    `;

}


/* =========================================================
   STATUS CLASS
   ========================================================= */

function statusClass(s) {

  return s === "Resolved"
    ? "res"
    : s === "In Progress"
      ? "prog"
      : s === "Assigned"
        ? "ass"
        : "sub";

}


/* =========================================================
   OPEN COMPLAINT DETAIL
   ========================================================= */

window.openDetail = id => {

  const c =
    complaints.find(
      x => x.complaint_id === id
    );


  if (!c) {
    return;
  }


  $("#detailPanel").classList.add(
    "open"
  );


  $("#detailContent").innerHTML = `

    <div class="eyebrow">
      COMPLAINT DETAILS
    </div>

    <h2>
      ${escapeHtml(c.complaint_id)}
    </h2>

    <span class="badge">
      ${escapeHtml(c.priority)} priority
    </span>


    <p style="font-size:13px">

      <b>
        ${escapeHtml(c.category)}
      </b>

      <br>

      📍 ${escapeHtml(c.location)}

      ${
        c.landmark
          ? `
            <br>
            Landmark:
            ${escapeHtml(c.landmark)}
          `
          : ""
      }

    </p>


    <p
      style="
        font-size:13px;
        color:#718094
      ">

      ${escapeHtml(c.description)}

    </p>


    ${
      c.photo_url
        ? `
          <img
            class="detail-img"
            src="${escapeHtml(c.photo_url)}"
            alt="Complaint evidence">
        `
        : ""
    }


    <div class="update-box">

      <h3
        style="
          font-family:'Space Grotesk'
        ">

        Update status

      </h3>


      <select id="detailStatus">

        <option>
          Submitted
        </option>

        <option>
          Assigned
        </option>

        <option>
          In Progress
        </option>

        <option>
          Resolved
        </option>

      </select>


      <textarea
        id="remarks"
        placeholder="Add an admin remark (optional)"
        style="
          margin-top:10px
        "></textarea>


      <button
        class="btn primary"
        style="
          width:100%;
          margin-top:10px
        "
        onclick="updateComplaint('${escapeJs(c.complaint_id)}')">

        Save update

      </button>

    </div>

  `;


  $("#detailStatus").value =
    c.status;

};


/* =========================================================
   UPDATE COMPLAINT
   ========================================================= */

window.updateComplaint = async id => {

  try {

    await api(
      `/api/complaints/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          status:
            $("#detailStatus").value,

          remarks:
            $("#remarks").value

        })

      }
    );


    toast(
      "Complaint status updated."
    );


    $("#detailPanel").classList.remove(
      "open"
    );


    await refreshAll();

  } catch (e) {

    toast(e.message);

  }

};


/* =========================================================
   CLOSE DETAIL PANEL
   ========================================================= */

$("#detailClose").addEventListener(
  "click",
  () => {

    $("#detailPanel").classList.remove(
      "open"
    );

  }
);


/* =========================================================
   ESCAPE HTML
   ========================================================= */

function escapeHtml(v = "") {

  return String(v).replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m])
  );

}


/* =========================================================
   ESCAPE JS
   ========================================================= */

function escapeJs(v = "") {

  return String(v)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");

}


/* =========================================================
   INITIAL AUTH CHECK
   ========================================================= */

checkAuth();