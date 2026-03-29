Supabase backend setup

1) Create a Supabase project
   - Visit https://app.supabase.com and create a new project.
   - In Project Settings -> API copy the `URL` and `anon` or `service_role` key.

2) Create the tables
   - Open the SQL editor in Supabase and run the SQL in `server/schema.sql` included in this repo.
   - This creates: `questions`, `courses`, `quiz_sessions`, `student_progress` tables with indexes.

3) Configure local environment
   - Copy `.env.example` to `.env` and fill:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY` (server only, secret)
     - `SUPABASE_ANON_KEY` (client/public key)

4) Install dependencies and run the server (Windows PowerShell)

```powershell
cd "c:\Users\Quo Bena\Documents\Quiz System"
npm install
npm run dev
```

5) Available server endpoints (when running locally)
- `GET /api/questions` — list all questions
- `POST /api/questions` — add one question (payload: `{ courseName, text, options:[A,B,C,D], correctLetter }`, `courseName` optional)
- `DELETE /api/questions/:id` — delete a question by id
- `POST /api/import` — import array of questions
- `GET /api/export` — get JSON export of all questions
- `GET /api/courses` — list all courses
- `POST /api/courses` — create a new course

Analytics endpoints (require Bearer token)
- `POST /api/quiz-sessions` — record a completed quiz (called automatically when student finishes)
  - Payload: `{ course_name, score, total_questions, correct_answers, duration_seconds, answered_questions? }`
- `GET /api/analytics/overview` — dashboard KPIs (total sessions, unique students, courses, avg score)
- `GET /api/analytics/courses` — per-course statistics (attempts, avg score, max score, unique students)
- `GET /api/analytics/students` — student progress summary (email, course, attempts, best/avg scores)
- `GET /api/analytics/student-detail/:email` — detailed quiz history for one student

Course support
- Each question now supports `course_name` in the database.
- Courses are also persisted in a dedicated `courses` table and available via `GET /api/courses`.
- Staff can create a new course from the UI before adding questions; this now stores the course in DB.
- For batch upload, use: `CourseName | Question | Option A | Option B | Option C | Option D | CorrectLetter`.
- Legacy 6-column batch lines without course are still supported and default to `General`.

Authentication notes
- The server now requires a valid Supabase Auth Bearer token for write operations (`POST /api/questions`, `DELETE /api/questions/:id`, `POST /api/import`).
- To obtain a token, use Supabase Auth from the client (signIn) and include the returned access token in requests as the `Authorization: Bearer <token>` header.
- Example: `fetch('/api/questions', { method: 'POST', headers: { 'Authorization': 'Bearer <token>', 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })`
- There's a helper endpoint `GET /api/me` which returns the authenticated user's profile when supplied with a Bearer token.

Supabase Auth setup
- In your Supabase project, enable the authentication providers you want (Email, OAuth, etc.) in the Authentication settings.
- From the browser, you typically use the Supabase client (`@supabase/supabase-js`) to sign up / sign in users and obtain the `access_token`.

Front-end configuration (secure pattern)
- Do not place credentials directly in `deepseek_html_20260327_1d2e5d.html`.
- Copy `js/config.example.js` to `js/config.local.js` (already git-ignored).
- Put only public values in `js/config.local.js`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `API_BASE`

Example (`js/config.local.js`):
```javascript
window.ECOREVISE_CONFIG = {
   SUPABASE_URL: 'https://your-project-ref.supabase.co',
   SUPABASE_ANON_KEY: 'your-anon-key',
   API_BASE: 'http://localhost:3000'
};
```

Security note
- The server uses the Supabase service key to perform DB operations. Keep this key secret (do not commit to source control). The client should only use the anon/public key to authenticate users and call Supabase Auth directly.
- Add `.env` to `.gitignore` (already done in this project) and rotate credentials immediately if they were ever committed or shared.
- Never place `SUPABASE_SERVICE_ROLE_KEY` in any frontend file (`.html`, `js/config.local.js`, browser code).

Notes
- Keep your Supabase keys secret. Use a service role key only on trusted servers.
- The table `questions` stores `options` as JSONB and `correct_letter` as text.
- If you prefer, you can call Supabase directly from the browser (no server), but the server helps centralize persistence and allows future features (auth, analytics).

Analytics (new feature)
- Staff can now access the Admin Analytics Dashboard by clicking "Analytics" in the staff dashboard.
- The dashboard shows:
  - **Overview**: KPIs (total sessions, unique students, courses, avg score)
  - **Courses**: Per-course performance metrics
  - **Students**: Student progress across all courses
  - **Sessions**: Recent quiz attempt history
- Data is automatically recorded when students complete quizzes (no manual action needed).
- See `ANALYTICS_GUIDE.md` for detailed documentation on dashboard usage and API endpoints.
- Two new database tables: `quiz_sessions` (per attempt), `student_progress` (aggregated stats).

