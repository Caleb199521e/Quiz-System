-- Supabase/Postgres schema for questions table
-- Run in Supabase SQL editor or with psql

-- extension for uuid generation (optional)
-- create extension if not exists "pgcrypto";

create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  course_name text not null default 'General',
  topic text default 'General',
  text text not null,
  options jsonb not null,
  correct_letter text not null,
  inserted_at timestamp with time zone default now()
);

alter table public.questions
add column if not exists course_name text not null default 'General';

alter table public.questions
add column if not exists topic text default 'General';

create table if not exists public.courses (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  inserted_at timestamp with time zone default now()
);

create index if not exists idx_courses_name on public.courses(name);

create index if not exists idx_questions_course_topic on public.questions(course_name, topic);
create index if not exists idx_questions_topic on public.questions(topic);

-- Quiz sessions table - tracks each time a student takes a quiz
create table if not exists public.quiz_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  user_email text not null,
  course_name text not null default 'General',
  score numeric(5,2) not null,
  total_questions integer not null,
  correct_answers integer not null,
  duration_seconds integer,
  answered_questions jsonb,
  created_at timestamp with time zone default now()
);

alter table public.quiz_sessions
add column if not exists user_id uuid;

alter table public.quiz_sessions
add column if not exists user_email text;

alter table public.quiz_sessions
add column if not exists course_name text default 'General';

alter table public.quiz_sessions
add column if not exists score numeric(5,2);

alter table public.quiz_sessions
add column if not exists total_questions integer;

alter table public.quiz_sessions
add column if not exists correct_answers integer;

alter table public.quiz_sessions
add column if not exists duration_seconds integer;

alter table public.quiz_sessions
add column if not exists answered_questions jsonb;

create index if not exists idx_quiz_sessions_user on public.quiz_sessions(user_email);
create index if not exists idx_quiz_sessions_course on public.quiz_sessions(course_name);
create index if not exists idx_quiz_sessions_created on public.quiz_sessions(created_at);

-- Student progress table - aggregated stats per student per course
create table if not exists public.student_progress (
  id uuid default gen_random_uuid() primary key,
  user_email text not null,
  course_name text not null,
  total_attempts integer default 0,
  best_score numeric(5,2),
  average_score numeric(5,2),
  last_attempted timestamp with time zone,
  updated_at timestamp with time zone default now()
);

alter table public.student_progress
add column if not exists user_email text;

alter table public.student_progress
add column if not exists course_name text;

alter table public.student_progress
add column if not exists total_attempts integer;

alter table public.student_progress
add column if not exists best_score numeric(5,2);

alter table public.student_progress
add column if not exists average_score numeric(5,2);

alter table public.student_progress
add column if not exists last_attempted timestamp with time zone;

create unique index if not exists idx_student_progress_unique on public.student_progress(user_email, course_name);
create index if not exists idx_student_progress_email on public.student_progress(user_email);
create index if not exists idx_student_progress_course on public.student_progress(course_name);
