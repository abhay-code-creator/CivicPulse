import os
import uuid
from datetime import datetime
from functools import wraps

import mysql.connector
from flask import Flask, jsonify, request, send_from_directory, session
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder=".", static_url_path="")
app.secret_key = os.environ.get("CIVICPULSE_SECRET", "")

DB_CONFIG = {
    "host": os.environ.get("CIVICPULSE_DB_HOST", "localhost"),
    "port": int(os.environ.get("CIVICPULSE_DB_PORT", "3306")),
    "user": os.environ.get("CIVICPULSE_DB_USER", "root"),
    "password": os.environ.get("CIVICPULSE_DB_PASSWORD", ""),
    "database": os.environ.get("CIVICPULSE_DB_NAME", "civicpulse_db"),
}

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
MAX_UPLOAD_MB = 5
os.makedirs(UPLOAD_DIR, exist_ok=True)

CATEGORIES = {
    "Pothole": "Medium",
    "Streetlight": "Low",
    "Garbage": "Medium",
    "Water Leakage": "High",
    "Road Damage": "High",
    "Drainage": "High",
    "Other": "Medium",
}

def db():
    return mysql.connector.connect(**DB_CONFIG)

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def make_complaint_id():
    return f"CP-{datetime.now():%Y%m%d}-{uuid.uuid4().hex[:5].upper()}"

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin_logged_in"):
            return jsonify({"ok": False, "message": "Admin authentication required"}), 401
        return fn(*args, **kwargs)
    return wrapper

def seed_admin():
    try:
        conn = db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM admins WHERE username=%s", ("admin",))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO admins(username,password_hash) VALUES(%s,%s)",
                ("admin", generate_password_hash("Admin@123"))
            )
            conn.commit()
        cur.close()
        conn.close()
    except Exception as exc:
        print("Admin seed skipped:", exc)

@app.get("/")
def home():
    return send_from_directory(".", "index.html")

@app.get("/admin")
def admin_page():
    return send_from_directory(".", "admin.html")

@app.get("/health")
def health():
    try:
        conn = db()
        conn.close()
        return jsonify({"ok": True, "database": "connected"})
    except Exception as exc:
        return jsonify({"ok": False, "database": "error", "message": str(exc)}), 500

@app.post("/api/admin/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))
    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM admins WHERE username=%s", (username,))
    admin = cur.fetchone()
    cur.close(); conn.close()
    if not admin or not check_password_hash(admin["password_hash"], password):
        return jsonify({"ok": False, "message": "Invalid admin credentials"}), 401
    session["admin_logged_in"] = True
    session["admin_username"] = username
    return jsonify({"ok": True, "username": username})

@app.post("/api/admin/logout")
def admin_logout():
    session.clear()
    return jsonify({"ok": True})

@app.get("/api/admin/me")
def admin_me():
    return jsonify({"ok": True, "logged_in": bool(session.get("admin_logged_in")),
                    "username": session.get("admin_username")})

@app.post("/api/complaints")
def create_complaint():
    form = request.form
    name = str(form.get("name", "")).strip()
    phone = str(form.get("phone", "")).strip()
    email = str(form.get("email", "")).strip()
    category = str(form.get("category", "")).strip()
    location = str(form.get("location", "")).strip()
    landmark = str(form.get("landmark", "")).strip()
    description = str(form.get("description", "")).strip()

    if not all([name, phone, category, location, description]):
        return jsonify({"ok": False, "message": "Please complete all required fields."}), 400
    if not phone.isdigit() or len(phone) != 10:
        return jsonify({"ok": False, "message": "Enter a valid 10-digit mobile number."}), 400
    if category not in CATEGORIES:
        return jsonify({"ok": False, "message": "Invalid complaint category."}), 400

    priority = CATEGORIES[category]
    photo = request.files.get("photo")
    filename = None
    if photo and photo.filename:
        if not allowed_file(photo.filename):
            return jsonify({"ok": False, "message": "Only JPG, JPEG, PNG and WEBP images are allowed."}), 400
        filename = f"{uuid.uuid4().hex}_{secure_filename(photo.filename)}"
        photo.save(os.path.join(UPLOAD_DIR, filename))

    complaint_id = make_complaint_id()
    now = datetime.now()

    conn = db()
    cur = conn.cursor()
    try:
        cur.execute(
            """INSERT INTO complaints
            (complaint_id,name,phone,email,category,location,landmark,description,priority,status,photo_filename,created_at,updated_at)
            VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,'Submitted',%s,%s,%s)""",
            (complaint_id,name,phone,email,category,location,landmark,description,priority,filename,now,now)
        )
        cur.execute(
            "INSERT INTO complaint_events(complaint_id,status,remarks,updated_by,event_time) VALUES(%s,'Submitted',%s,'System',%s)",
            (complaint_id, "Complaint registered successfully.", now)
        )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close(); conn.close()

    return jsonify({"ok": True, "complaint_id": complaint_id, "priority": priority})

@app.get("/api/complaints/<complaint_id>")
def get_complaint(complaint_id):
    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM complaints WHERE complaint_id=%s", (complaint_id.upper(),))
    complaint = cur.fetchone()
    if not complaint:
        cur.close(); conn.close()
        return jsonify({"ok": False, "message": "Complaint not found."}), 404

    cur.execute(
        "SELECT status,remarks,updated_by,event_time FROM complaint_events WHERE complaint_id=%s ORDER BY event_time ASC,id ASC",
        (complaint_id.upper(),)
    )
    events = cur.fetchall()
    cur.close(); conn.close()

    if complaint["photo_filename"]:
        complaint["photo_url"] = f"/uploads/{complaint['photo_filename']}"
    else:
        complaint["photo_url"] = None
    complaint["created_at"] = complaint["created_at"].strftime("%d %b %Y, %I:%M %p")
    complaint["updated_at"] = complaint["updated_at"].strftime("%d %b %Y, %I:%M %p")
    for e in events:
        e["event_time"] = e["event_time"].strftime("%d %b %Y, %I:%M %p")

    return jsonify({"ok": True, "complaint": complaint, "events": events})

@app.get("/api/complaints")
@admin_required
def list_complaints():
    status = request.args.get("status", "").strip()
    category = request.args.get("category", "").strip()
    q = request.args.get("q", "").strip()

    clauses, params = [], []
    if status:
        clauses.append("status=%s"); params.append(status)
    if category:
        clauses.append("category=%s"); params.append(category)
    if q:
        clauses.append("(complaint_id LIKE %s OR name LIKE %s OR location LIKE %s OR description LIKE %s)")
        like = f"%{q}%"
        params.extend([like, like, like, like])

    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute(f"""SELECT complaint_id,name,phone,email,category,location,landmark,description,
                    priority,status,photo_filename,created_at,updated_at
                    FROM complaints {where} ORDER BY created_at DESC""", tuple(params))
    rows = cur.fetchall()
    cur.close(); conn.close()

    for r in rows:
        r["created_at"] = r["created_at"].strftime("%d %b %Y, %I:%M %p")
        r["updated_at"] = r["updated_at"].strftime("%d %b %Y, %I:%M %p")
        r["photo_url"] = f"/uploads/{r['photo_filename']}" if r["photo_filename"] else None
    return jsonify({"ok": True, "complaints": rows})

@app.get("/api/public-pulse")
def public_pulse():
    """Return only non-sensitive aggregate/recent complaint data for the citizen homepage."""
    conn = db()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""SELECT
            COUNT(*) total,
            COALESCE(SUM(status='Submitted'),0) submitted,
            COALESCE(SUM(status='Assigned'),0) assigned,
            COALESCE(SUM(status='In Progress'),0) in_progress,
            COALESCE(SUM(status='Resolved'),0) resolved
            FROM complaints""")
        overall = cur.fetchone() or {}

        cur.execute("SELECT category, COUNT(*) count FROM complaints GROUP BY category ORDER BY count DESC")
        categories = cur.fetchall()

        # Deliberately omit citizen name, phone, email and internal remarks.
        cur.execute("""SELECT complaint_id, category, location, status, priority,
                       photo_filename IS NOT NULL AND photo_filename <> '' AS has_photo
                       FROM complaints ORDER BY created_at DESC LIMIT 6""")
        recent = cur.fetchall()

        return jsonify({
            "ok": True,
            "overall": overall,
            "categories": categories,
            "recent": recent
        })
    finally:
        cur.close()
        conn.close()

@app.get("/api/stats")
@admin_required
def stats():
    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute("""SELECT
        COUNT(*) total,
        SUM(status='Submitted') submitted,
        SUM(status='Assigned') assigned,
        SUM(status='In Progress') in_progress,
        SUM(status='Resolved') resolved,
        SUM(priority IN ('High','Critical')) urgent
        FROM complaints""")
    overall = cur.fetchone()
    cur.execute("SELECT category, COUNT(*) count FROM complaints GROUP BY category ORDER BY count DESC")
    categories = cur.fetchall()
    cur.execute("""SELECT DATE(created_at) day, COUNT(*) count
                   FROM complaints
                   WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                   GROUP BY DATE(created_at) ORDER BY day ASC""")
    daily = cur.fetchall()
    cur.close(); conn.close()
    return jsonify({"ok": True, "overall": overall, "categories": categories, "daily": daily})

@app.patch("/api/complaints/<complaint_id>/status")
@admin_required
def update_status(complaint_id):
    data = request.get_json(silent=True) or {}
    new_status = str(data.get("status", "")).strip()
    remarks = str(data.get("remarks", "")).strip()
    allowed = {"Submitted", "Assigned", "In Progress", "Resolved"}
    if new_status not in allowed:
        return jsonify({"ok": False, "message": "Invalid status."}), 400

    conn = db()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT complaint_id,status FROM complaints WHERE complaint_id=%s", (complaint_id.upper(),))
    row = cur.fetchone()
    if not row:
        cur.close(); conn.close()
        return jsonify({"ok": False, "message": "Complaint not found."}), 404

    now = datetime.now()
    cur.execute("UPDATE complaints SET status=%s,updated_at=%s WHERE complaint_id=%s",
                (new_status, now, complaint_id.upper()))
    cur.execute("""INSERT INTO complaint_events(complaint_id,status,remarks,updated_by,event_time)
                   VALUES(%s,%s,%s,%s,%s)""",
                (complaint_id.upper(), new_status, remarks or f"Status updated to {new_status}.",
                 session.get("admin_username", "Admin"), now))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({"ok": True, "status": new_status})

@app.get("/uploads/<path:filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)

if __name__ == "__main__":
    print("CivicPulse starting...")
    seed_admin()
    app.run(debug=True, host="127.0.0.1", port=5000)
