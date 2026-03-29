-- EcoRevise Quiz System - Supabase Database Schema
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql/new
-- Select your project → SQL Editor → New Query → Paste this → Run

-- ============================================
-- 1. COURSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_name ON public.courses(name);

-- ============================================
-- 2. QUESTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_name TEXT NOT NULL DEFAULT 'General',
  topic TEXT DEFAULT 'General',
  text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_letter TEXT NOT NULL CHECK (correct_letter IN ('A', 'B', 'C', 'D')),
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (course_name) REFERENCES public.courses(name) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_questions_course ON public.questions(course_name);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON public.questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_course_topic ON public.questions(course_name, topic);

-- ============================================
-- 3. QUIZ SESSIONS TABLE (Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT NOT NULL,
  course_name TEXT NOT NULL DEFAULT 'General',
  score NUMERIC(5, 2) NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  duration_seconds INTEGER,
  answered_questions JSONB,
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_email ON public.quiz_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_course ON public.quiz_sessions(course_name);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_inserted ON public.quiz_sessions(inserted_at DESC);

-- ============================================
-- 4. STAFF TABLE (Profile Info for Instructors)
-- ============================================
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON public.staff(email);

-- ============================================
-- 5. STUDENTS TABLE (Profile Info for Learners)
-- ============================================
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  student_id TEXT,
  grade_level TEXT,
  enrollment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(email);
CREATE INDEX IF NOT EXISTS idx_students_student_id ON public.students(student_id);

-- ============================================
-- 6. QUIZ SESSIONS TABLE (Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS public.quiz_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT NOT NULL,
  course_name TEXT NOT NULL DEFAULT 'General',
  score NUMERIC(5, 2) NOT NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  duration_seconds INTEGER,
  answered_questions JSONB,
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_user_email ON public.quiz_sessions(user_email);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_course ON public.quiz_sessions(course_name);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_inserted ON public.quiz_sessions(inserted_at DESC);

-- ============================================
-- 7. STUDENT PROGRESS TABLE (Aggregated Stats)
-- ============================================
CREATE TABLE IF NOT EXISTS public.student_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  course_name TEXT NOT NULL,
  total_attempts INTEGER DEFAULT 0,
  best_score NUMERIC(5, 2),
  average_score NUMERIC(5, 2),
  last_attempted TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_email, course_name)
);

CREATE INDEX IF NOT EXISTS idx_student_progress_user ON public.student_progress(user_email);
CREATE INDEX IF NOT EXISTS idx_student_progress_course ON public.student_progress(course_name);

-- ============================================
-- 5. OPTIONAL: RLS (Row Level Security) - Uncomment if needed
-- ============================================
-- Enable RLS on tables
-- ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.quiz_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;

-- Allow public read on questions and courses
-- CREATE POLICY "Allow authenticated read" ON public.questions FOR SELECT USING (true);
-- CREATE POLICY "Allow authenticated read" ON public.courses FOR SELECT USING (true);

-- ============================================
-- Done! Your database is ready.
-- ============================================
