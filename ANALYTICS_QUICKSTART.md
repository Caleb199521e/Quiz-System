# Analytics Dashboard - Quick Start

## 🚀 5-Minute Setup

### Step 1: Run Database Migration
```sql
-- Open Supabase SQL Editor
-- Paste entire contents of server/schema.sql
-- Click Run
```

This creates:
- ✅ `quiz_sessions` table (stores each quiz attempt)
- ✅ `student_progress` table (tracks per-student stats)
- ✅ Indexes (for fast queries)

### Step 2: Restart Server
```powershell
cd "c:\Users\Quo Bena\Documents\Quiz System"
npm run dev
```

### Step 3: Test It Out
1. Open app in browser
2. Sign in as **staff**
3. Add some test questions for "Biology 101"
4. Sign in as **student**
5. Take a quiz
6. Sign in as **staff** again
7. Click **"Analytics"** button
8. View your data! 📊

---

## 📊 Dashboard Overview

### Four Tabs

**1. Overview** (KPIs at a glance)
```
Total Sessions:   42
Unique Students:  15
Total Courses:    5
Average Score:    72.3%
```

**2. Courses** (per-course performance)
```
| Course | Attempts | Avg Score | Max | Students |
|--------|----------|-----------|-----|----------|
| Bio 101|    42    |   75.5%   | 100%|    8     |
| Chem 101|   28   |   68.2%   |  95%|    6     |
```

**3. Students** (student progress)
```
| Email | Course | Attempts | Best | Avg | Last |
|-------|--------|----------|------|-----|------|
| alice | Bio    |    5     | 95%  | 88% | 3/28 |
| bob   | Chem   |    3     | 78%  | 72% | 3/26 |
```

**4. Sessions** (quiz history)
```
| Student | Course | Score | Correct/Total | Time | Date |
|---------|--------|-------|---------------|------|------|
| alice   | Bio    |  85%  |    8/10      | 420s | 3/28 |
| bob     | Chem   |  70%  |    7/10      | 600s | 3/27 |
```

---

## 💾 What Gets Recorded

When a student finishes a quiz, the system automatically records:

```
Student Email:    alice@example.com
Course Name:      Biology 101
Score:            85.5% (percentage)
Correct:          8 (out of 10)
Duration:         420 seconds (7 minutes)
Timestamp:        2025-03-28 10:30 AM
```

**No manual action needed** - it happens automatically!

---

## 🎯 Use Cases

### Use Case 1: Find Struggling Students
1. Go to **Students** tab
2. Look for low "Avg Score"
3. Contact them: "I see you're struggling with Biology 101. Would you like tutoring?"

### Use Case 2: Identify Popular Courses
1. Go to **Courses** tab
2. Sort by "Attempts" (highest first)
3. Expand that course with more questions

### Use Case 3: Monitor Engagement
1. Go to **Students** tab
2. Check "Last Attempted" dates
3. Contact inactive students to re-engage

### Use Case 4: Assess Question Difficulty
1. Go to **Courses** tab
2. Compare courses by average score
3. If score <60%, questions may be too hard

### Use Case 5: Real-Time Activity
1. Go to **Sessions** tab
2. View recent quiz attempts
3. Spot trends or issues in real-time

---

## 🔧 Troubleshooting

### "Analytics button missing"
❌ You're not signed in as staff  
✅ Sign in with staff email/password

### "No data showing"
❌ No quizzes recorded yet  
✅ Have a student take a quiz first

### "Dashboard won't load"
❌ Backend not running  
✅ Run: `npm run dev`

### "Wrong numbers showing"
❌ Data not refreshed  
✅ Click different tabs to reload

---

## 📈 API Endpoints (if needed)

### Record Quiz
```javascript
POST /api/quiz-sessions (auto-called on quiz completion)
```

### Get Overview
```javascript
GET /api/analytics/overview
// Returns: { total_quiz_sessions, unique_students, total_courses, average_score }
```

### Get Courses
```javascript
GET /api/analytics/courses
// Returns: Array of { course_name, total_attempts, average_score, max_score, unique_students }
```

### Get Students
```javascript
GET /api/analytics/students
// Returns: Array of { user_email, course_name, total_attempts, best_score, average_score, last_attempted }
```

### Get Student Detail
```javascript
GET /api/analytics/student-detail/:email
// Returns: { email, total_attempts, sessions: [...], progress: [...] }
```

---

## 📚 Full Documentation

For complete documentation, see:
- **`ANALYTICS_GUIDE.md`** - 300+ lines, complete reference
- **`ANALYTICS_SUMMARY.md`** - Overview and highlights
- **`BACKEND_SETUP.md`** - Updated with endpoints

---

## ✅ That's It!

You now have a fully functional analytics dashboard. Staff can:

✅ View real-time quiz performance  
✅ Track student progress  
✅ Identify struggling students  
✅ Monitor course popularity  
✅ Assess question difficulty  

**Questions?** Check `ANALYTICS_GUIDE.md`

---

**Status**: Ready to use!  
**Next**: Run the migration and start taking quizzes.
