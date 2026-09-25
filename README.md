# CivicPulse — Web Crafters 3.0 / Scenario 3

Smart City Citizen Grievance Portal

## Requirements mapped to the official scenario

- Online complaint registration
- Problem category selection
- Location details
- Photo upload facility
- Complaint ID generation
- Complaint status tracking
- Admin dashboard
- Focus: smart governance and citizen participation

## Tech stack

Frontend: HTML5, CSS3, JavaScript  
Backend: Python Flask  
Database: MySQL  
Uploads: Flask/Werkzeug  
Authentication: Flask session + password hashing

## Setup

1. Install MySQL Server and MySQL Workbench.

2. Open `schema.sql` in MySQL Workbench and run it.

3. Configure the MySQL connection using the environment variables supported by `app.py`:
   - `CIVICPULSE_DB_HOST`
   - `CIVICPULSE_DB_PORT`
   - `CIVICPULSE_DB_USER`
   - `CIVICPULSE_DB_PASSWORD`
   - `CIVICPULSE_DB_NAME`

   Never publish your real MySQL password.

4. Open this folder in VS Code.

5. In the VS Code terminal:

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py```

Open:
Citizen portal: http://127.0.0.1:5000/
Admin: http://127.0.0.1:5000/admin
Demo admin

Username: admin
Password: Admin@123

Change this before any real deployment.

Competition demo flow
Submit a complaint as a citizen.
Save the generated Complaint ID.
Open the Admin dashboard.
View the new complaint.
Change status to Assigned / In Progress / Resolved.
Return to Track and show the updated timeline.
Project identity

CivicPulse

Smart Citizen Grievance & Resolution Portal

Tagline:

Your Voice. Your City. Your Impact.

This project is intentionally scoped around Scenario 3 and its task/focus.