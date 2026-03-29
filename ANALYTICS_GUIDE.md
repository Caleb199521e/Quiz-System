# Analytics Dashboard - Implementation Guide

**Status**: ✅ Complete and Integrated  
**Date**: 2025-03-28  
**Version**: v0.1.0

---

## Overview

The **Admin Analytics Dashboard** provides real-time insights into quiz performance, student progress, and course statistics. Staff can now:

- View dashboard KPIs (total sessions, students, courses, average score)
- Analyze per-course performance metrics
- Track individual student progress across courses
- Review detailed quiz session history
- Monitor trends and patterns

---

## Architecture

### Database Tables

#### `quiz_sessions` Table
Tracks every quiz attempt by students.

```sql
CREATE TABLE quiz_sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_email TEXT NOT NULL,
  course_name TEXT NOT NULL DEFAULT 'General',
  score NUMERIC(5,2) NOT NULL,               -- Percentage (0-100)
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  duration_seconds INTEGER,                  -- Time spent on quiz
  answered_questions JSONB,                  -- Detailed answers (optional)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_quiz_sessions_user ON quiz_sessions(user_email);
CREATE INDEX idx_quiz_sessions_course ON quiz_sessions(course_name);
CREATE INDEX idx_quiz_sessions_created ON quiz_sessions(created_at);
```

**Data Captured per Quiz**:
- Student email (from auth)
- Course name
- Final score (percentage)
- Number correct / total questions
- Time taken (seconds)
- Timestamp

#### `student_progress` Table
Aggregated statistics per student per course.

```sql
CREATE TABLE student_progress (
  id UUID PRIMARY KEY,
  user_email TEXT NOT NULL,
  course_name TEXT NOT NULL,
  total_attempts INTEGER DEFAULT 0,
  best_score NUMERIC(5,2),
  average_score NUMERIC(5,2),
  last_attempted TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast lookup
CREATE UNIQUE INDEX idx_student_progress_unique ON student_progress(user_email, course_name);
CREATE INDEX idx_student_progress_email ON student_progress(user_email);
CREATE INDEX idx_student_progress_course ON student_progress(course_name);
```

**Auto-Updated After Each Quiz**:
- Total attempts for that student/course combo
- Best score
- Average score
- Last attempted date

---

## API Endpoints

### POST /api/quiz-sessions (Auth Required)
**Purpose**: Record a completed quiz  
**Called**: Automatically when student finishes quiz

**Request**:
```javascript
{
  course_name: "Biology 101",
  score: 85.5,                    // Percentage
  total_questions: 10,
  correct_answers: 8,
  duration_seconds: 420,          // Optional
  answered_questions: { ... }     // Optional (for detailed review)
}
```

**Response**:
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Auto Actions**:
- Creates row in `quiz_sessions` table
- Updates `student_progress` row for that student/course
- Calculates new best score, average score, attempt count

---

### GET /api/analytics/overview (Auth Required)
**Purpose**: Get dashboard KPIs

**Response**:
```json
{
  "total_quiz_sessions": 42,
  "unique_students": 15,
  "total_courses": 5,
  "average_score": 72.3
}
```

**Metrics**:
- Total sessions: Count of all quiz attempts
- Unique students: Count of students with at least 1 session
- Total courses: Count of courses with sessions
- Average score: Mean of all quiz scores

---

### GET /api/analytics/courses (Auth Required)
**Purpose**: Get per-course performance stats

**Response**:
```json
[
  {
    "course_name": "Biology 101",
    "total_attempts": 42,
    "average_score": 75.5,
    "max_score": 100,
    "unique_students": 8
  },
  { ... }
]
```

**Metrics per Course**:
- Total attempts
- Average score across all attempts
- Highest score ever achieved
- Number of unique students

---

### GET /api/analytics/students (Auth Required)
**Purpose**: Get student progress summary across all courses

**Response**:
```json
[
  {
    "user_email": "alice@example.com",
    "course_name": "Biology 101",
    "total_attempts": 5,
    "best_score": 95.0,
    "average_score": 88.5,
    "last_attempted": "2025-03-28T10:30:00Z"
  },
  { ... }
]
```

**Metrics per Student/Course**:
- Total attempts
- Best score
- Average score
- Last attempt date

---

### GET /api/analytics/student-detail/:email (Auth Required)
**Purpose**: Get detailed quiz history for one student

**Response**:
```json
{
  "email": "alice@example.com",
  "total_attempts": 12,
  "sessions": [
    {
      "id": "...",
      "course_name": "Biology 101",
      "score": 85.5,
      "correct_answers": 8,
      "total_questions": 10,
      "duration_seconds": 420,
      "created_at": "2025-03-28T10:30:00Z"
    },
    { ... }
  ],
  "progress": [
    {
      "course_name": "Biology 101",
      "total_attempts": 5,
      "best_score": 95.0,
      "average_score": 88.5,
      "last_attempted": "2025-03-28T10:30:00Z"
    },
    { ... }
  ]
}
```

---

## Dashboard UI

### Access
Staff users click the **"Analytics"** button in the staff dashboard top navigation.

### Four Tabs

#### 1. **Overview Tab** (Default)
Shows 4 key KPI cards:
- **Total Sessions**: Count of all quiz attempts
- **Unique Students**: Number of students who took quizzes
- **Total Courses**: Number of courses with data
- **Average Score**: Mean score across all attempts

**Use Case**: Quick health check of platform usage and performance.

#### 2. **Courses Tab**
Table showing per-course breakdown:

| Course Name | Attempts | Avg Score | Max Score | Students |
|---|---|---|---|---|
| Biology 101 | 42 | 75.5% | 100% | 8 |
| Chemistry 101 | 28 | 68.2% | 95% | 6 |

**Use Case**: Identify which courses are most popular and which may need improvement.

**Insights**:
- High attempt count = popular course
- Low average score = difficult course (may need better questions or more teaching)
- Many students per course = good adoption

#### 3. **Students Tab**
Table of all student progress:

| Student Email | Course | Attempts | Best Score | Avg Score | Last Attempted |
|---|---|---|---|---|---|
| alice@example.com | Biology 101 | 5 | 95% | 88.5% | 2025-03-28 |
| bob@example.com | Chemistry 101 | 3 | 78% | 72.3% | 2025-03-26 |

**Use Case**: Identify struggling students (low scores), engaged students (many attempts), or inactive students (old dates).

**Insights**:
- High attempts + high score = strong student
- Low attempts + low score = needs support
- No recent attempt = may be disengaged

#### 4. **Sessions Tab**
Recent quiz sessions (last 50):

| Student Email | Course | Score | Correct/Total | Duration | Date |
|---|---|---|---|---|---|
| alice@example.com | Biology 101 | 85% | 8/10 | 420s | 2025-03-28 |
| bob@example.com | Chemistry 101 | 70% | 7/10 | 600s | 2025-03-27 |

**Use Case**: Monitor real-time activity and spot trends.

**Insights**:
- Recent high scores = effective learning
- Increasing session duration = more careful study (good)
- Recent low scores = may indicate difficulty spike

---

## Data Flow

### When Student Takes a Quiz

```
1. Student selects course
     ↓
2. Student completes quiz
     ↓
3. finishQuizAndShowResults() is called
     ↓
4. trackQuizSession() POSTs to /api/quiz-sessions
     ↓
5. Backend creates quiz_sessions row
     ↓
6. Backend updates (or creates) student_progress row
     ↓
7. Metrics available in admin dashboard
```

### Quiz Session Recording

**Automatic Tracking** (in `js/app.js`):
```javascript
// When quiz finishes:
const scorePercent = (correctCount / total) * 100;
const durationSeconds = (Date.now() - quizStartTime) / 1000;

trackQuizSession(
  selectedCourse,      // e.g., "Biology 101"
  scorePercent,        // e.g., 85.5
  total,               // e.g., 10
  correctCount,        // e.g., 8
  durationSeconds      // e.g., 420
);
```

**What Gets Sent**:
- Course name
- Score (percentage 0-100)
- Total questions
- Correct answers
- Duration in seconds
- (Student email and user_id added by backend from auth)

---

## Key Features

### 1. Real-Time Updates
Dashboard fetches latest data from API. Tab refreshes when user switches tabs or clicks button.

### 2. Role-Based Access
Only authenticated staff can view analytics (protected by `verifyAuth` middleware).

### 3. Aggregated Statistics
`student_progress` table automatically calculates:
- Total attempts
- Best score
- Average score

### 4. Time Tracking
`duration_seconds` field measures how long students spend per quiz (helps identify fast learners vs careful thinkers).

### 5. Course Filtering
All metrics broken down by course for isolated analysis.

### 6. Student Email Tracking
Uses student's authenticated email for identification and progress tracking.

---

## Usage Examples

### Example 1: Identify Struggling Student
1. Go to **Students** tab
2. Sort by lowest "Avg Score"
3. Find: "bob@example.com" with 42% average in "Chemistry 101"
4. Action: Reach out, offer extra help

### Example 2: Find Popular Course
1. Go to **Courses** tab
2. Look for highest "Attempts"
3. Find: "Biology 101" with 42 attempts from 8 students
4. Action: Expand course with more questions or schedule sessions

### Example 3: Monitor Engagement
1. Go to **Students** tab
2. Check "Last Attempted" dates
3. Find: "charlie@example.com" hasn't attempted since 2025-02-01
4. Action: Send reminder email to engage

### Example 4: Assess Question Difficulty
1. Go to **Courses** tab
2. Compare courses by "Avg Score"
3. Find: "Advanced Physics" has 45% average (low!)
4. Action: Review questions - may be too hard or unclear

### Example 5: Review Recent Activity
1. Go to **Sessions** tab
2. View last 10 rows
3. Find: Recent low scores in one course
4. Action: Investigate if there's confusion or misunderstanding

---

## Testing the Feature

### Manual Testing Steps

**1. Set Up Database**
```sql
-- Run schema.sql to create analytics tables
CREATE TABLE quiz_sessions (...)
CREATE TABLE student_progress (...)
```

**2. Sign In as Staff**
- Open app in browser
- Click "Sign in → Staff"
- Sign in with staff credentials

**3. Add Some Questions**
- Add a few questions for "Biology 101" course
- Add a few questions for "Chemistry 101" course

**4. Complete Quizzes as Student**
- Sign out
- Click "Continue as guest" OR sign in as student
- Select "Biology 101"
- Answer 5-10 questions (get some right, some wrong)
- Click "Logout"

**5. Repeat with Another Course**
- Go back to student
- Take "Chemistry 101" quiz
- Get different score
- Logout

**6. View Analytics**
- Sign in as staff again
- Click **"Analytics"** button
- Check "Overview" tab - should show: 2 sessions, 1 student, 2 courses, avg score
- Check "Courses" tab - should show both courses with stats
- Check "Students" tab - should show guest student's progress

---

## Database Maintenance

### Clearing Analytics
If you want to reset analytics data (for testing):

```sql
-- Clear all quiz sessions
DELETE FROM quiz_sessions;

-- Clear all student progress
DELETE FROM student_progress;

-- This will NOT delete questions or courses
```

### Exporting Analytics
To export data for reports:

```sql
-- Export session data as CSV
COPY (
  SELECT user_email, course_name, score, correct_answers, total_questions, duration_seconds, created_at
  FROM quiz_sessions
  ORDER BY created_at DESC
) TO '/tmp/quiz_sessions.csv' WITH CSV HEADER;
```

---

## Performance Considerations

### Query Performance
All analytics queries use indexed columns:
- `quiz_sessions.user_email` - for student lookups
- `quiz_sessions.course_name` - for course filtering
- `quiz_sessions.created_at` - for date range queries
- `student_progress` has unique index on (user_email, course_name)

**Expected Performance**:
- Overview query: <100ms (counts and averages)
- Courses query: <200ms (per-course aggregation)
- Students query: <300ms (all progress rows)
- Sessions query: <500ms (last 50 sessions)

### Scaling Considerations
If you have 10,000+ quiz sessions:
- Consider archiving old sessions (older than 6 months)
- Add date-based partitioning to `quiz_sessions`
- Consider caching top-10 courses/students

### Row Limits
- **Overview Tab**: Uses aggregates (no limit)
- **Courses Tab**: All courses (typically <100)
- **Students Tab**: All unique student/course combos (typically <1,000)
- **Sessions Tab**: Last 50 sessions (limited for performance)

---

## Error Handling

### What if Analytics Data is Missing?
1. Check that `quiz_sessions` and `student_progress` tables exist
2. Verify auth token is valid (check "Overview" loads)
3. Check browser console (F12) for fetch errors
4. Verify API_BASE is set correctly in config.local.js

### What if Scores Aren't Recorded?
1. Verify student is authenticated (check email shown in staff nav)
2. Check that backend is running (`npm run dev`)
3. Check server logs for POST /api/quiz-sessions errors
4. Verify course name is being passed (should be "General" if not set)

### What if Student Progress Shows Wrong Numbers?
1. Click different tabs to refresh (tab click reloads data)
2. If still wrong, check raw data: `SELECT * FROM student_progress WHERE user_email = '...'`
3. Recalculate manually if needed

---

## Security Notes

- ✅ Analytics endpoints require Bearer token (staff only)
- ✅ Student emails are tracked (from authenticated user)
- ✅ Quiz answers stored in `answered_questions` (currently not captured but ready for future)
- ✅ No PII beyond email (no student names, etc.)

**Privacy Considerations**:
- If sharing reports, use aggregated data (courses) not individual student data
- Consider GDPR - student data can be requested/deleted per regulations
- Audit logs not currently implemented (consider for production)

---

## Future Enhancements

### Short-term (1-2 hours)
- [ ] Export analytics as CSV
- [ ] Date range filtering (last week/month/semester)
- [ ] Course comparison charts
- [ ] Student difficulty level reporting

### Medium-term (4-8 hours)
- [ ] Student heatmap (who took which course)
- [ ] Question difficulty analysis (which questions trip up students)
- [ ] Learning curve tracking (improvement over time)
- [ ] Email alerts (low avg score, no recent activity)
- [ ] Predictive alerts (student at risk)

### Long-term (>8 hours)
- [ ] ML-based difficulty prediction
- [ ] Personalized learning recommendations
- [ ] Cohort comparison (class A vs class B)
- [ ] Integration with learning management system (LMS)

---

## Troubleshooting Guide

| Problem | Cause | Solution |
|---------|-------|----------|
| "No data" on Overview | No quiz sessions recorded | Have students take quizzes first |
| Analytics button missing | Not staff role | Sign in with staff credentials |
| Tab doesn't load | API error | Check browser console (F12), verify auth token |
| Scores seem wrong | Progress not updating | Wait 10 seconds, reload page, check quiz was completed |
| No student emails shown | Guest mode | Have students sign up/sign in first |

---

## Implementation Checklist

- ✅ Add `quiz_sessions` table
- ✅ Add `student_progress` table
- ✅ Add API endpoint `/api/quiz-sessions` (POST)
- ✅ Add API endpoint `/api/analytics/overview` (GET)
- ✅ Add API endpoint `/api/analytics/courses` (GET)
- ✅ Add API endpoint `/api/analytics/students` (GET)
- ✅ Add API endpoint `/api/analytics/student-detail/:email` (GET)
- ✅ Add admin dashboard HTML with 4 tabs
- ✅ Add analytics JS functions (load*, switchToAdminDashboard, initAnalyticsTabs)
- ✅ Add quiz session tracking (trackQuizSession)
- ✅ Add "Analytics" button to staff nav
- ✅ Add event listeners for admin dashboard
- ✅ Tests passing (4/4)
- ✅ No errors in compiled code

---

## Summary

The **Admin Analytics Dashboard** provides staff with real-time insights into quiz performance and student progress through:

1. **4 Dashboard Tabs**: Overview KPIs, Course Stats, Student Progress, Recent Sessions
2. **5 API Endpoints**: Session recording, overview data, course stats, student progress, detailed student history
3. **2 Database Tables**: `quiz_sessions` (per attempt), `student_progress` (aggregated)
4. **Automatic Tracking**: Quiz data recorded when students finish
5. **Role-Based Access**: Only authenticated staff can view analytics

**Status**: Ready for production after running migrations.
