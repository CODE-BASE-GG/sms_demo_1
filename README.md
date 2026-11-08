# Sunny Campus ☀️

A yellow-themed **student management system** built with **React (Vite)** and **Node.js/Express**, backed by the MySQL schema in `student_management_system_db.sql`.

The app includes **login and registration for Teachers and Admins**, plus a complete dashboard and management screens that use **all 12 tables** in the database.

---

## ✨ What's included

| Area | Details |
| --- | --- |
| Authentication | Register / login as **Teacher** or **Admin**, bcrypt password hashing, JWT sessions |
| Dashboard | Live counts for every table, recent activity, attendance mix, students-by-course |
| Academics | Courses, Subjects, Course–Subject links, Sections, Section–Subject–Teacher assignments |
| People | Students, Teachers, Admins |
| Records | Assessments, Student Scores, Attendance |
| Audit trail | Every create / update / delete automatically writes into the `Log` table; admins can approve/reject entries |
| Theme | Bright yellow / amber design, responsive sidebar and mobile-friendly tables |

### Why only Teachers and Admins can log in

The SQL schema gives `Teacher` and `Admin` tables a `Password` column, while `Student` does not. So authentication is for staff accounts, and students are managed records (enrolled, scored, and marked present/absent). This keeps the app faithful to the provided schema without changing it.

---

## 🗂 Project structure

```
student_management_system/
├── student_management_system_db.sql   # original schema (unchanged)
├── package.json                       # root dev scripts
├── server/
│   ├── .env.example
│   ├── scripts/
│   │   ├── initDb.js                  # applies the SQL schema
│   │   └── seed.js                    # optional demo accounts + data
│   └── src/
│       ├── config.js                  # parses Aiven DATABASE_URL / DB_* env
│       ├── db.js                      # mysql2 connection pool
│       ├── resources.js               # table/field definitions (single source of truth)
│       ├── middleware/auth.js         # JWT signing + auth guard
│       ├── routes/                    # auth, dashboard, generic CRUD
│       └── utils/audit.js             # writes into the Log table
└── client/
    ├── src/
    │   ├── pages/                     # Login, Register, Dashboard
    │   ├── components/                # Layout, ResourcePage, AuthShell
    │   ├── resourceConfigs.jsx        # UI config for every table
    │   └── styles.css                 # yellow design system
    └── vite.config.js                 # proxies /api to the Express server
```

---

## 🚀 Setup

### 1. Create the database on Aiven

1. Open <https://console.aiven.io>, create a **MySQL** service (or open an existing one).
2. Make sure your service allows connections from your IP (Aiven → service → **Networking / Trusted sources** if needed).
3. Copy the **MySQL connection URI**. It looks like:

   ```
   mysql://avnadmin:PASSWORD@mysql-xxxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED
   ```

### 2. Configure the server

```bash
cd student_management_system

cp server/.env.example server/.env
```

Edit `server/.env`:

```env
PORT=5000
JWT_SECRET=some-long-random-string

# Paste the Aiven URI here
DATABASE_URL=mysql://avnadmin:PASSWORD@mysql-xxxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED

# Name of the database that contains the SMS tables
DB_NAME=sms

# Aiven requires SSL
DB_SSL=true

CLIENT_ORIGIN=http://localhost:5173
```

> Prefer separate values? Leave `DATABASE_URL` empty and fill in `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` instead.

> **Database name:** `DB_NAME` always overrides the database in `DATABASE_URL`. This project is configured for a database named **`sms`**, even if the Aiven URI ends in `/defaultdb`.

### 3. Install dependencies

```bash
npm install
npm run install:all
```

### 4. Check the connection (optional)

```bash
npm run db:check
```

This prints the connected database, host, and a row count for all 12 tables. If it says `Connected to database: sms` and all tables are present, you are ready.

### 5. Create the tables

```bash
npm run db:init
```

This applies `student_management_system_db.sql` to the database in your `.env`.
It is safe to re-run: if the schema already exists it does nothing.

> To drop everything and start over:
> `npm run db:reset`

### 6. (Optional) Add demo data

```bash
npm run db:seed
```

Demo accounts:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@sunnycampus.test` | `admin123` |
| Teacher | `teacher@sunnycampus.test` | `teacher123` |
| Teacher | `james@sunnycampus.test` | `teacher123` |

It also adds courses, subjects, sections, students, assessments, scores and attendance — useful for seeing the dashboard populated.

### 7. Run the app

```bash
npm run dev
```

- React app: <http://localhost:5173>
- API: <http://localhost:5000/api>
- Health check: <http://localhost:5000/api/health>

You can also register a brand-new account from the register screen.

---

## 🔌 API overview

All data routes require a `Bearer <token>` header.

| Method(s) | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a Teacher/Admin account |
| `POST` | `/api/auth/login` | Log in |
| `GET` | `/api/auth/me` | Validate session and return current user |
| `GET` | `/api/dashboard` | Counts for all tables + recent activity |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/courses` | Course records |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/subjects` | Subject records |
| `GET`, `POST`, `DELETE` | `/api/course-subjects` | Course ↔ Subject links |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/teachers` | Teacher records |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/admins` | Admin records |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/sections` | Sections |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/section-subjects` | Section ↔ Subject ↔ Teacher |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/students` | Students |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/assessments` | Assessments |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/scores` | Student scores |
| `GET`, `POST`, `PUT`, `DELETE` | `/api/attendance` | Attendance |
| `GET` | `/api/logs` | Audit log (read-only) |
| `PATCH` | `/api/logs/:id/status` | Approve / reject a log entry |

Deleting a record that is referenced by other tables returns a friendly `409` message instead of a database error.

---

## 🧠 Notes

- Password hashes are never returned by the API.
- All audit entries are written automatically; failures in logging never break the main request.
- The server supports both `DATABASE_URL` (Aiven URI) and separate `DB_*` variables.
- The frontend proxies `/api` to `http://localhost:5000` during development.
- For a single-server deployment, run `npm run build`, then `npm start`. Express will serve the built React app from `client/dist` and the API from `/api`. In development, Vite runs separately on port 5173.

Enjoy the sunshine. ☀️
