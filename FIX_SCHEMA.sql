-- Fix: Update courses table schema to use inserted_at instead of created_at
-- Run this in Supabase SQL Editor

-- DROP and RECREATE courses table (this will delete existing courses)
-- Only run this if you don't have important data in courses table
DROP TABLE IF EXISTS public.courses CASCADE;

CREATE TABLE public.courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courses_name ON public.courses(name);
