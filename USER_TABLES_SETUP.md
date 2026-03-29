# Setting Up User Profile Tables (Staff & Students)

## 🚀 Quick Setup

### Step 1: Create Tables in Supabase (2 minutes)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your Quiz System project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Open file: `CREATE_USER_TABLES.sql`
6. Copy all contents
7. Paste into Supabase SQL Editor
8. Click **Run**
9. ✅ You should see: "Executed successfully"

---

## 📊 What Tables Get Created

### **staff** table
- `id` (UUID) - unique identifier
- `user_id` (FK to auth.users) - links to Supabase Auth
- `email` (TEXT) - unique email
- `full_name` (TEXT) - instructor name
- `department` (TEXT) - department (e.g., "Science", "Math")
- `phone` (TEXT) - contact phone
- `bio` (TEXT) - biography/qualifications
- `created_at` - profile creation date

```sql
-- Check created staff
SELECT * FROM public.staff;
```

### **students** table
- `id` (UUID) - unique identifier
- `user_id` (FK to auth.users) - links to Supabase Auth
- `email` (TEXT) - unique email
- `full_name` (TEXT) - student name
- `student_id` (TEXT) - school ID or student number
- `grade_level` (TEXT) - class/grade (e.g., "Form 3", "Year 10")
- `school` (TEXT) - school name
- `phone` (TEXT) - contact phone
- `enrollment_date` - when enrolled
- `created_at` - profile creation date

```sql
-- Check created students
SELECT * FROM public.students;
```

---

## 🔗 How It Links to Authentication

Both tables link to **Supabase Auth** via `user_id`:

```
User signs up → Supabase Auth creates user + returns user_id
    ↓
Backend receives signup request
    ↓
Backend creates row in `staff` or `students` table with that user_id
    ↓
Now you have both:
  - Auth profile (email, password - handled by Supabase Auth)
  - App profile (full_name, department/school, etc - in staff/students table)
```

---

## 📝 Auto Profile Creation on Signup

The backend will automatically create a profile when a user signs up:

### When User Signs Up as **Staff**:
```javascript
1. User enters email + password + role:"staff"
2. Backend creates Supabase Auth user
3. Backend auto-creates row in staff table:
   {
     user_id: "123...",
     email: "teacher@school.com",
     full_name: null,
     department: null,
     created_at: "2026-03-29T..."
   }
```

### When User Signs Up as **Student**:
```javascript
1. User enters email + password + role:"student"
2. Backend creates Supabase Auth user
3. Backend auto-creates row in students table:
   {
     user_id: "456...",
     email: "student@school.com",
     full_name: null,
     student_id: null,
     grade_level: null,
     created_at: "2026-03-29T..."
   }
```

---

## 🔄 Updating User Profiles

After signup, users can update their profile information:

### API Endpoints (to be added):

**Update Staff Profile:**
```bash
PATCH /api/staff/profile
Authorization: Bearer <token>
{
  "full_name": "Dr. James Smith",
  "department": "Biology",
  "phone": "+256701234567",
  "bio": "Experienced biology educator with 10 years teaching experience"
}
```

**Update Student Profile:**
```bash
PATCH /api/students/profile
Authorization: Bearer <token>
{
  "full_name": "John Paul Okello",
  "student_id": "STU-2024-001",
  "grade_level": "Form 3",
  "school": "Kings College"
}
```

---

## ✅ Verification

After running the SQL, verify tables were created:

**In Supabase Dashboard:**
1. Go to **Table Editor** (left sidebar)
2. Look for new tables: `staff` and `students`
3. ✅ Should appear in the tables list

**Via SQL Query:**
```sql
-- Check both tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('staff', 'students');

-- Should return 2 rows:
-- staff
-- students
```

---

## 🎯 Next Steps

1. ✅ Run CREATE_USER_TABLES.sql in Supabase
2. ✅ Sign up a staff account at http://localhost:3000
3. ✅ Check Supabase → Table Editor → staff table
4. ✅ Should see new row with your email
5. ✅ Sign up a student account
6. ✅ Check students table
7. ✅ Should see new student row

---

## 📋 Complete User Signup Flow (After Tables Created)

```
1. User visits app → http://localhost:3000
   ↓
2. User clicks "Sign Up"
   ↓
3. User selects role: [Staff] or [Student]
   ↓
4. User enters email & password
   ↓
5. Frontend POST /api/auth/signup + role
   ↓
6. Backend creates Supabase Auth user
   ↓
7. Backend creates row in staff OR students table
   ↓
8. User account + profile created ✅
   ↓
9. User can sign in and use app
   ↓
10. Staff can upload courses/questions
    Student can take quizzes
```

---

## 📊 Database Relationships

```
┌─────────────────┐
│   auth.users    │
│  (Supabase)     │
└────────┬────────┘
         │ user_id
         │
    ┌────┴────┐
    │          │
    ▼          ▼
┌────────┐  ┌─────────┐
│ staff  │  │students │
└────────┘  └─────────┘
    │            │
    └────┬───────┘
         │
         ▼
  ┌────────────────┐
  │ quiz_sessions  │ (tracks who took what quiz)
  │student_progress│ (tracks performance stats)
  └────────────────┘
```

---

## 🔒 Permissions

Tables allow:
- ✅ Authenticated users can read/write their own profile
- ✅ Admins can view all profiles
- ❌ Unauthenticated users cannot modify profiles

---

**Important:** After running the SQL setup, restart your server and test signup!
