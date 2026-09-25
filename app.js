const $ = (s) => document.querySelector(s);


/* =========================================================
   TIMELINE DESCRIPTION TYPOGRAPHY
   ========================================================= */

const timelineStyle = document.createElement("style");

timelineStyle.textContent = `
  .timeline .timeline-description {
    display: block;
    margin-top: 7px;
    font-size: 12px;
    line-height: 1.5;
    font-weight: 500;
    font-style: normal;
    color: #536276;
  }

  .dark .timeline .timeline-description {
    color: #9aabc0;
  }
`;

document.head.appendChild(timelineStyle);


/* =========================================================
   TOAST
   ========================================================= */

const toast = (msg) => {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");

  setTimeout(() => t.classList.remove("show"), 2600);
};


/* =========================================================
   THEME
   ========================================================= */

$("#themeBtn").addEventListener("click", () => {
  document.body.classList.toggle("dark");

  $("#themeBtn").textContent =
    document.body.classList.contains("dark") ? "☀" : "☾";
});


/* =========================================================
   SCROLL REVEAL
   ========================================================= */

const revealItems = document.querySelectorAll(
  ".reveal, .reveal-section"
);

const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.12
  }
);

revealItems.forEach(item => {
  revealObserver.observe(item);
});


/* =========================================================
   SUBTLE HERO MOUSE PARALLAX
   ========================================================= */

const heroPanel = document.querySelector(".hero-interactive");

if (heroPanel) {
  heroPanel.addEventListener("mousemove", (e) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const rect = heroPanel.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rotateX = ((y / rect.height) - 0.5) * -5;
    const rotateY = ((x / rect.width) - 0.5) * 5;

    heroPanel.style.transform =
      `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  });

  heroPanel.addEventListener("mouseleave", () => {
    heroPanel.style.transform =
      "perspective(900px) rotateX(0deg) rotateY(0deg)";
  });
}


/* =========================================================
   FORM PROGRESS
   ========================================================= */

const form = $("#complaintForm");

const fields = [
  ...form.querySelectorAll("input,select,textarea")
].filter(x => x.type !== "file");

const progress = () => {
  const filled = fields.filter(
    x => x.value.trim()
  ).length;

  const percentage =
    Math.round(filled / fields.length * 100);

  $("#progressBar").style.width = `${percentage}%`;
};

fields.forEach(x => {
  x.addEventListener("input", progress);
  x.addEventListener("change", progress);
});


/* =========================================================
   DESCRIPTION COUNTER
   ========================================================= */

$("#description").addEventListener("input", () => {
  $("#count").textContent =
    $("#description").value.length;
});


/* =========================================================
   PHOTO PREVIEW
   ========================================================= */

$("#photo").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const img = $("#preview");

  if (!file) {
    img.style.display = "none";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    e.target.value = "";
    img.style.display = "none";

    toast("Photo must be 5 MB or smaller.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    img.src = reader.result;
    img.style.display = "block";
  };

  reader.readAsDataURL(file);
});


/* =========================================================
   COMPLAINT SUBMISSION
   ========================================================= */

let latestId = "";

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = $("#submitBtn");

  btn.disabled = true;
  btn.innerHTML = `
    <span class="loading-spinner"></span>
    Submitting…
  `;

  try {
    const res = await fetch(
      "/api/complaints",
      {
        method: "POST",
        body: new FormData(form)
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.message || "Submission failed."
      );
    }

    latestId = data.complaint_id;

    $("#newId").textContent = latestId;

    /* Refresh City Pulse immediately after new complaint */
    loadPublicPulse();

    $("#modal").classList.add("open");

    form.reset();

    $("#preview").style.display = "none";

    $("#count").textContent = "0";

    progress();

  } catch (err) {

    toast(err.message);

  } finally {

    btn.disabled = false;

    btn.innerHTML =
      'Submit complaint <b>→</b>';
  }
});


/* =========================================================
   MODAL
   ========================================================= */

$("#modalClose").addEventListener("click", () => {
  $("#modal").classList.remove("open");
});


$("#copyId").addEventListener("click", async () => {

  try {

    await navigator.clipboard.writeText(latestId);

    toast("Complaint ID copied.");

  } catch {

    toast("Unable to copy Complaint ID.");

  }

});


$("#trackNew").addEventListener("click", () => {

  $("#modal").classList.remove("open");

  $("#trackId").value = latestId;

  location.hash = "track";

  loadComplaint(latestId);

});


/* =========================================================
   TIMELINE
   ========================================================= */

function timeline(events, current) {

  const stages = [
    "Submitted",
    "Assigned",
    "In Progress",
    "Resolved"
  ];

  const descriptions = {
    "Submitted": "Report received and pending review.",
    "Assigned": "Verified and assigned for action.",
    "In Progress": "Maintenance or civic work is underway.",
    "Resolved": "Issue marked fixed and case closed."
  };

  const currentIndex =
    stages.indexOf(current);

  return `
    <div class="timeline">

      ${stages.map((s, i) => {

        const event = events.find(
          e => e.status === s
        );

        const cls =
          i < currentIndex
            ? "done"
            : i === currentIndex
              ? "active"
              : "";

        return `
          <div class="tl ${cls}">

            <div class="tl-dot">
              ${i <= currentIndex ? "✓" : "•"}
            </div>

            <strong>${s}</strong>

            <small>
              ${event ? event.event_time : "Awaiting update"}
            </small>
            <span class="timeline-description">${descriptions[s]}</span>

          </div>
        `;

      }).join("")}

    </div>
  `;
}


/* =========================================================
   LOAD COMPLAINT
   ========================================================= */

async function loadComplaint(id) {

  const result = $("#trackResult");

  result.innerHTML = `
    <div style="text-align:center;padding:35px">
      Loading complaint…
    </div>
  `;

  try {

    const res = await fetch(
      `/api/complaints/${encodeURIComponent(id.trim())}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message);
    }

    const c = data.complaint;

    result.innerHTML = `

      <div class="complaint-head">

        <div>

          <div class="eyebrow">
            COMPLAINT ${c.complaint_id}
          </div>

          <h3>
            ${escapeHtml(c.category)}
          </h3>

          <p style="
            margin:0;
            color:#718094;
            font-size:12px
          ">
            📍 ${escapeHtml(c.location)}
            ${c.landmark
              ? " • " + escapeHtml(c.landmark)
              : ""}
          </p>

        </div>

        <span class="badge ${
          c.status === "Resolved"
            ? "resolved"
            : c.status === "In Progress"
              ? "progress"
              : ""
        }">
          ${c.status}
        </span>

      </div>

      <p style="
        font-size:13px;
        color:#536276;
        margin-top:20px
      ">
        ${escapeHtml(c.description)}
      </p>

      ${
        c.photo_url
          ? `
            <img
              src="${c.photo_url}"
              alt="Complaint evidence"
              style="
                max-width:180px;
                border-radius:12px;
                margin-top:4px
              "
            >
          `
          : ""
      }

      ${timeline(data.events, c.status)}

      <div style="
        margin-top:20px;
        font-size:10px;
        color:#7b8898
      ">
        Submitted ${c.created_at}
        • Last updated ${c.updated_at}
        • Priority: ${c.priority}
      </div>
    `;

  } catch (err) {

    result.innerHTML = `
      <div style="
        text-align:center;
        padding:35px
      ">

        <div class="empty-icon">!</div>

        <h3>
          Complaint not found
        </h3>

        <p>
          Check the Complaint ID and try again.
        </p>

      </div>
    `;
  }
}


/* =========================================================
   TRACKING
   ========================================================= */

$("#trackBtn").addEventListener("click", () => {

  const id = $("#trackId").value.trim();

  if (!id) {
    toast("Enter your Complaint ID.");
    return;
  }

  loadComplaint(id);
});


$("#trackId").addEventListener("keydown", e => {

  if (e.key === "Enter") {
    $("#trackBtn").click();
  }

});


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
   CATEGORY GUIDANCE
   ========================================================= */

const categoryDescriptions = {
  "Pothole": "Road surface hole or uneven patch that may affect safety.",
  "Streetlight": "Streetlight outage or lighting problem in a public area.",
  "Garbage": "Waste accumulation, overflowing bins or littering concern.",
  "Water Leakage": "Visible water leakage, burst pipe or public water loss.",
  "Road Damage": "Damaged road, broken surface or other roadway problem.",
  "Drainage": "Blocked drain, waterlogging or flooding-related issue.",
  "Other": "A civic problem that does not fit the listed categories."
};

$("#category").addEventListener("change", e => {
  $("#categoryHelp").textContent =
    categoryDescriptions[e.target.value] ||
    "Choose the issue type that best matches the problem.";
});


/* =========================================================
   REPORT AGAIN
   ========================================================= */

$("#reportAgain").addEventListener("click", () => {
  $("#modal").classList.remove("open");
  location.hash = "report";
  document.querySelector("#report")?.scrollIntoView({
    behavior: "smooth"
  });
});


/* =========================================================
   PUBLIC CITY PULSE
   ========================================================= */

function renderPulseCard(item) {

  const statusClass =
    item.status === "Resolved"
      ? "resolved"
      : item.status === "In Progress"
        ? "progress"
        : "";

  return `<article class="pulse-card">

    <div class="eyebrow">
      ${escapeHtml(item.complaint_id)}
    </div>

    <h3>
      ${escapeHtml(item.category)}
    </h3>

    <p>
      📍 ${escapeHtml(item.location)}
    </p>

    <div class="pulse-meta">

      <span class="badge ${statusClass}">
        ${escapeHtml(item.status)}
      </span>

      <span>
        ${escapeHtml(item.priority)} priority
      </span>

      ${
        item.has_photo
          ? "<span>📷 Evidence</span>"
          : ""
      }

    </div>

  </article>`;
}


async function loadPublicPulse() {

  try {

    const res = await fetch(
      "/api/public-pulse"
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.message ||
        "Unable to load snapshot."
      );
    }

    const o = data.overall || {};


    /* =====================================================
       TOTAL COMPLAINTS
       ===================================================== */

    const total =
      Number(o.total) || 0;

    $("#statTotal").textContent =
      total;


    /* =====================================================
       RESOLVED CASES
       ===================================================== */

    const resolved =
      Number(o.resolved) || 0;

    $("#statResolved").textContent =
      resolved;


    /* =====================================================
       ACTIVE CASES
       Total Cases - Resolved Cases
       ===================================================== */

    $("#statActive").textContent =
      Math.max(0, total - resolved);


    /* =====================================================
       ISSUE CATEGORIES
       ===================================================== */

    $("#statCategories").textContent =
      (data.categories || []).length;


    /* =====================================================
       RECENT CITY PULSE
       ===================================================== */

    const recent =
      data.recent || [];

    $("#pulseGrid").innerHTML =
      recent.length
        ? recent.map(renderPulseCard).join("")
        : `
          <div class="pulse-empty">
            It's quiet here. Be the first to report a civic issue and improve your neighborhood.
          </div>
        `;

  } catch (err) {

    $("#statTotal").textContent =
      "—";

    $("#statResolved").textContent =
      "—";

    $("#statActive").textContent =
      "—";

    $("#statCategories").textContent =
      "—";

    $("#pulseGrid").innerHTML = `
      <div class="pulse-empty">
        Community snapshot is temporarily unavailable.
        You can still submit or track a complaint.
      </div>
    `;
  }
}


/* =========================================================
   INITIAL CITY PULSE LOAD
   ========================================================= */

loadPublicPulse();


/* =========================================================
   AUTOMATIC CITY PULSE REFRESH
   Refresh every 10 seconds
   ========================================================= */

setInterval(() => {
  loadPublicPulse();
}, 10000);