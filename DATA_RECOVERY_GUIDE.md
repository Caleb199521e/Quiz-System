# Data Recovery Guide

## 🔍 Step 1: Check Current Data Status

### Check if Courses Exist
Open Supabase SQL Editor and run:
```sql
SELECT COUNT(*) as course_count, COUNT(DISTINCT name) as unique_courses FROM public.courses;
SELECT * FROM public.courses LIMIT 10;
```

### Check if Questions Exist
```sql
SELECT COUNT(*) as question_count FROM public.questions;
SELECT course_name, COUNT(*) as count FROM public.questions GROUP BY course_name;
```

### Check What Was Deleted (via Supabase Activity Log)
- Go to your Supabase project
- Click "Activity" → Check recent SQL executions
- Look for DROP statements

---

## ✅ Step 2: If Data Was Deleted – Recovery Options

### Option A: Recreate Schema (Non-Destructive)
Run this in Supabase SQL Editor:
```sql
-- This will NOT delete existing data (uses IF NOT EXISTS)
-- Copy contents from SUPABASE_SCHEMA.sql (safe version)
```

### Option B: Restore from Backup (if Supabase backup exists)
1. Go to Supabase Dashboard → Settings → Backups
2. Check if automatic backups are available
3. Request point-in-time recovery if available on your plan

### Option C: Re-Import Questions
1. Use the **Staff Panel → Batch CSV Upload** feature
2. Prepare CSV with format: `courseName,topic,text,optionA,optionB,optionC,optionD,correctAnswer`
3. Upload to repopulate questions

### Option D: Manual Entry
1. Staff can add courses one by one via UI
2. Staff can add questions manually

---

## 📋 Sample Test Data to Re-Import

If you need to restore sample questions, create a CSV file:

```
courseName,topic,text,optionA,optionB,optionC,optionD,correctAnswer
Biology 101,Photosynthesis,"What is the main output of photosynthesis?",Glucose,Oxygen,Water,All of the above,B
Biology 101,Photosynthesis,"Which organelle performs photosynthesis?",Mitochondria,Ribosome,Chloroplast,Nucleus,C
UGBS104,Economics,"What does GDP stand for?",Gross Domestic Profit,Gross Domestic Product,Gross Development Plan,General Department of Planning,B
UGBS104,Accounting,"Which account has a debit balance normally?",Revenue,Liability,Assets,Equity,C
```

---

## 🔧 Step 3: Prevent Future Accidental Deletions

### Files to NEVER Run (Destructive):
- ❌ `FIX_SCHEMA.sql` - Has DROP TABLE statements
- ❌ Any file with `DROP TABLE`, `TRUNCATE`, or `DELETE` without WHERE clause

### Files That Are SAFE (Non-Destructive):
- ✅ `SUPABASE_SCHEMA.sql` - Uses `CREATE TABLE IF NOT EXISTS`
- ✅ `server/schema.sql` - Uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`

### Safest Approach:
1. Always backup before running SQL
2. Use `IF NOT EXISTS` clauses
3. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` instead of DROP
4. Test in dev environment first

---

## 📊 Quick Status Check

Run this in Supabase SQL Editor to get current state:

```sql
-- Overall Status
SELECT 
  (SELECT COUNT(*) FROM public.courses) as total_courses,
  (SELECT COUNT(*) FROM public.questions) as total_questions,
  (SELECT COUNT(*) FROM public.quiz_sessions) as total_quiz_attempts,
  (SELECT COUNT(DISTINCT user_email) FROM public.student_progress) as active_students;

-- Questions by Course
SELECT course_name, COUNT(*) as count FROM public.questions GROUP BY course_name ORDER BY count DESC;

-- Recent Quiz Sessions
SELECT user_email, course_name, score, inserted_at FROM public.quiz_sessions ORDER BY inserted_at DESC LIMIT 5;
```

---

## 🚨 Important Notes

1. **localStorage is disabled** - All data must come from backend/Supabase
2. **Backend is working** - API endpoints responding correctly
3. **Auth is working** - Supabase Auth functional
4. **Only data layer affected** - If data was deleted, system will show empty courses/questions

---

## Next Steps

1. ✅ Check Supabase for current data status
2. ✅ If data missing: Use Option C or D to restore
3. ✅ Update `FIX_SCHEMA.sql` to remove DROP statements (or delete the file)
4. ✅ Commit non-destructive schema changes
