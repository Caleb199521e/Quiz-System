require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(__dirname)); // Serve static files (HTML, CSS, JS)

// Root route: serve index.html for SPA
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// SPA routing: serve index.html for all non-API routes
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if(!SUPABASE_URL || !SUPABASE_KEY){
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Server will still start, but requests will fail.');
}

const supabase = createClient(SUPABASE_URL || '', SUPABASE_KEY || '');

// Dynamic config endpoint for frontend (injects environment variables)
app.get('/api/config', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  const config = {
    SUPABASE_URL: SUPABASE_URL || '',
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY || '',
    API_BASE: req.protocol + '://' + req.get('host')
  };
  console.log('[CONFIG] Serving dynamic config with SUPABASE_URL:', !!config.SUPABASE_URL, 'SUPABASE_ANON_KEY:', !!config.SUPABASE_ANON_KEY);
  res.send(`
    window.ECOREVISE_CONFIG = ${JSON.stringify(config)};
  `);
});

async function ensureCourseExists(courseName){
  const normalized = ((courseName || 'General').toString().trim() || 'General').replace(/\s+/g, ' ');
  const { error } = await supabase.from('courses').upsert([{ name: normalized }], { onConflict: 'name' });
  if(error) throw error;
  return normalized;
}

// GET /api/courses -> list all course names
app.get('/api/courses', async (req, res) => {
  try{
    const { data, error } = await supabase.from('courses').select('id, name, inserted_at').order('name', { ascending: true });
    if(error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/courses -> create course
app.post('/api/courses', verifyAuth, async (req, res) => {
  try{
    const { name } = req.body;
    if(!name || !name.toString().trim()) return res.status(400).json({ error: 'Course name is required' });
    const normalized = await ensureCourseExists(name);
    const { data, error } = await supabase.from('courses').select('id, name, inserted_at').eq('name', normalized).limit(1);
    if(error) return res.status(500).json({ error: error.message });
    return res.status(201).json((data && data[0]) || { name: normalized });
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/courses/:name -> delete course and all its questions
app.delete('/api/courses/:name', verifyAuth, async (req, res) => {
  try{
    const courseName = decodeURIComponent(req.params.name);
    const normalized = (courseName || '').toString().trim().replace(/\s+/g, ' ') || 'General';
    
    if(normalized === 'General') return res.status(400).json({ error: 'Cannot delete the General course' });
    
    // Delete all questions for this course
    const { error: deleteQError } = await supabase.from('questions').delete().eq('course_name', normalized);
    if(deleteQError) return res.status(500).json({ error: deleteQError.message });
    
    // Delete the course
    const { error: deleteCError } = await supabase.from('courses').delete().eq('name', normalized);
    if(deleteCError) return res.status(500).json({ error: deleteCError.message });
    
    return res.json({ status: 'success', message: `Course "${normalized}" and all its questions deleted` });
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// AUTH middleware: verify Bearer token via Supabase Auth
async function verifyAuth(req, res, next){
  try{
    const auth = req.headers.authorization || '';
    if(!auth || !auth.toLowerCase().startsWith('bearer ')) return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    const token = auth.split(' ')[1];
    const { data, error } = await supabase.auth.getUser(token);
    if(error || !data || !data.user) return res.status(401).json({ error: 'Invalid token' });
    req.user = data.user;
    next();
  } catch(err){
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// GET /api/questions -> return all questions
app.get('/api/questions', async (req, res) => {
  try{
    const { data, error } = await supabase.from('questions').select('id, course_name, text, options, correct_letter, inserted_at').order('inserted_at', { ascending: true });
    if(error) return res.status(500).json({ error: error.message });
    return res.json(data);
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/questions -> add one question
app.post('/api/questions', verifyAuth, async (req, res) => {
  try{
    const { courseName, text, options, correctLetter } = req.body;
    if(!text || !Array.isArray(options) || options.length < 4 || !['A','B','C','D'].includes((correctLetter||'').toUpperCase())){
      return res.status(400).json({ error: 'Invalid payload. Expect { courseName?, text, options:[A,B,C,D], correctLetter }' });
    }
    const normalizedCourse = await ensureCourseExists(courseName);
    const payload = { course_name: normalizedCourse, text, options: options.slice(0,4), correct_letter: correctLetter.toUpperCase() };
    const { data, error } = await supabase.from('questions').insert([payload]).select('id, course_name, text, options, correct_letter');
    if(error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data[0]);
  } catch(err){ return res.status(500).json({ error: err.message }); }
});

// DELETE /api/questions/:id
app.delete('/api/questions/:id', verifyAuth, async (req, res) => {
  try{
    const id = req.params.id;
    const { data, error } = await supabase.from('questions').delete().eq('id', id).select('id');
    if(error) return res.status(500).json({ error: error.message });
    if(!data || data.length === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ deleted: data[0].id });
  } catch(err){ return res.status(500).json({ error: err.message }); }
});

// POST /api/cleanup-courses -> merge duplicate courses
app.post('/api/cleanup-courses', verifyAuth, async (req, res) => {
  try{
    const { data: courses, error: fetchError } = await supabase.from('courses').select('id, name');
    if(fetchError) return res.status(500).json({ error: fetchError.message });
    
    // Group by normalized name
    const normalized = course => (course.name || 'General').toString().trim().replace(/\s+/g, ' ');
    const groups = {};
    for(const course of courses){
      const key = normalized(course);
      if(!groups[key]) groups[key] = [];
      groups[key].push(course);
    }
    
    let mergedCount = 0;
    let deletedIds = [];
    
    // For each group with duplicates, keep first and delete others
    for(const key in groups){
      if(groups[key].length > 1){
        const [keep, ...remove] = groups[key];
        for(const duplicate of remove){
          // Update questions referencing this course to the kept course
          const { error: updateError } = await supabase.from('questions')
            .update({ course_name: keep.name })
            .eq('course_name', duplicate.name);
          if(!updateError){
            // Delete the duplicate course
            await supabase.from('courses').delete().eq('id', duplicate.id);
            deletedIds.push(duplicate.id);
            mergedCount++;
          }
        }
      }
    }
    
    res.json({ 
      status: 'cleanup complete',
      duplicatesCleaned: mergedCount,
      deletedCourseIds: deletedIds
    });
  } catch(err){ return res.status(500).json({ error: err.message }); }
});

// POST /api/import -> accept array of questions
app.post('/api/import', verifyAuth, async (req, res) => {
  try{
    const payload = req.body;
    if(!Array.isArray(payload)) return res.status(400).json({ error: 'Expected an array of questions' });
    const inserts = [];
    const courses = new Set();
    for(const q of payload){
      if(q && q.text && Array.isArray(q.options) && q.options.length >=4 && ['A','B','C','D'].includes((q.correctLetter||'').toUpperCase())){
        const normalized = (q.courseName || q.course_name || 'General').toString().trim() || 'General';
        courses.add(normalized);
        inserts.push({ course_name: normalized, text: q.text, options: q.options.slice(0,4), correct_letter: q.correctLetter.toUpperCase() });
      }
    }
    if(inserts.length === 0) return res.status(400).json({ error: 'No valid questions to import' });
    if(courses.size > 0){
      const courseRows = Array.from(courses).map(name => ({ name }));
      const { error: courseError } = await supabase.from('courses').upsert(courseRows, { onConflict: 'name' });
      if(courseError) return res.status(500).json({ error: courseError.message });
    }
    const { data, error } = await supabase.from('questions').insert(inserts).select('id');
    if(error) return res.status(500).json({ error: error.message });
    return res.json({ inserted: data.length });
  } catch(err){ return res.status(500).json({ error: err.message }); }
});

// GET /api/export -> returns JSON of all questions
app.get('/api/export', async (req, res) => {
  try{
    const { data, error } = await supabase.from('questions').select('id, course_name, text, options, correct_letter, inserted_at').order('inserted_at', { ascending: true });
    if(error) return res.status(500).json({ error: error.message });
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(data, null, 2));
  } catch(err){ return res.status(500).json({ error: err.message }); }
});

// GET /api/me -> return current user (requires Bearer token)
app.get('/api/me', verifyAuth, async (req, res) => {
  try{
    return res.json({ user: req.user });
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/signup -> signup with auto-confirmed email (no verification required)
app.post('/api/auth/signup', async (req, res) => {
  try{
    const { email, password } = req.body;
    
    if(!email || !password){
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    // Validate password length
    if(password.length < 6){
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Use admin API to create user with email_confirmed = true
    const { data, error } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password,
      email_confirm: true // Auto-confirm the email, no verification needed
    });
    
    if(error){
      return res.status(400).json({ error: error.message || 'Signup failed' });
    }
    
    return res.status(201).json({ 
      message: 'Account created successfully (email auto-confirmed)',
      user: data.user 
    });
  } catch(err){
    return res.status(500).json({ error: err.message || 'Signup error' });
  }
});

// GET /auth/callback -> Handle email confirmation redirects from Supabase
app.get('/auth/callback', async (req, res) => {
  try {
    const { token_hash, type, error, error_description } = req.query;
    
    // If there's an error from Supabase, redirect with error flag
    if (error) {
      const errorMsg = error_description || error;
      const redirectUrl = `${process.env.FRONTEND_URL || '/'}?confirmError=${encodeURIComponent(errorMsg)}`;
      return res.redirect(redirectUrl);
    }
    
    // Success - redirect to main app with confirmation flag
    if (token_hash && type === 'email_confirmation') {
      const redirectUrl = `${process.env.FRONTEND_URL || '/'}?emailConfirmed=true`;
      return res.redirect(redirectUrl);
    }
    
    // Fallback redirect
    const redirectUrl = process.env.FRONTEND_URL || '/';
    res.redirect(redirectUrl);
  } catch (err) {
    console.error('Auth callback error:', err);
    const errorMsg = encodeURIComponent('Confirmation failed: ' + err.message);
    const redirectUrl = `${process.env.FRONTEND_URL || '/'}?confirmError=${errorMsg}`;
    res.redirect(redirectUrl);
  }
});

// ========== ANALYTICS ENDPOINTS ===========

// POST /api/quiz-sessions -> record a completed quiz
app.post('/api/quiz-sessions', verifyAuth, async (req, res) => {
  try{
    const { course_name, score, total_questions, correct_answers, duration_seconds, answered_questions } = req.body;
    const user_email = req.user.email || req.user.user_metadata?.email || 'unknown';
    
    if(score === undefined || total_questions === undefined || correct_answers === undefined){
      return res.status(400).json({ error: 'Missing required fields: score, total_questions, correct_answers' });
    }
    
    const session = {
      user_id: req.user.id,
      user_email,
      course_name: course_name || 'General',
      score: parseFloat(score),
      total_questions: parseInt(total_questions),
      correct_answers: parseInt(correct_answers),
      duration_seconds: duration_seconds ? parseInt(duration_seconds) : null,
      answered_questions: answered_questions || null
    };
    
    const { data: sessionData, error: sessionError } = await supabase
      .from('quiz_sessions')
      .insert([session])
      .select('id');
    
    if(sessionError) return res.status(500).json({ error: sessionError.message });
    
    // Update student progress
    const progressKey = { user_email, course_name: session.course_name };
    const { data: existing } = await supabase
      .from('student_progress')
      .select('*')
      .eq('user_email', user_email)
      .eq('course_name', session.course_name)
      .single();
    
    if(existing){
      const newAttempts = (existing.total_attempts || 0) + 1;
      const newBestScore = Math.max(existing.best_score || 0, score);
      const newAvgScore = ((existing.average_score || 0) * existing.total_attempts + score) / newAttempts;
      
      await supabase.from('student_progress').update({
        total_attempts: newAttempts,
        best_score: newBestScore,
        average_score: parseFloat(newAvgScore.toFixed(2)),
        last_attempted: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('id', existing.id);
    } else {
      await supabase.from('student_progress').insert([{
        user_email,
        course_name: session.course_name,
        total_attempts: 1,
        best_score: score,
        average_score: parseFloat(score),
        last_attempted: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
    }
    
    return res.status(201).json({ session_id: sessionData[0].id });
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/overview -> dashboard overview stats
app.get('/api/analytics/overview', verifyAuth, async (req, res) => {
  try{
    const { data: totalSessions } = await supabase.from('quiz_sessions').select('id');
    const { data: avgScores } = await supabase.rpc('get_avg_score');
    const { data: uniqueStudents } = await supabase.from('student_progress').select('user_email', { count: 'exact' });
    const { data: allCourses } = await supabase.from('courses').select('name');
    
    return res.json({
      total_quiz_sessions: (totalSessions || []).length,
      unique_students: uniqueStudents?.length || 0,
      total_courses: (allCourses || []).length,
      average_score: avgScores && avgScores[0] ? parseFloat(avgScores[0].avg_score || 0).toFixed(2) : 0
    });
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/courses -> per-course statistics
app.get('/api/analytics/courses', verifyAuth, async (req, res) => {
  try{
    const { data: courses } = await supabase.from('courses').select('name');
    if(!courses) return res.json([]);
    
    const stats = [];
    for(const course of courses){
      const { data: sessions } = await supabase
        .from('quiz_sessions')
        .select('score, correct_answers, total_questions')
        .eq('course_name', course.name);
      
      const { count: attemptCount } = await supabase
        .from('quiz_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('course_name', course.name);
      
      const scores = (sessions || []).map(s => s.score);
      const avgScore = scores.length > 0 ? (scores.reduce((a,b) => a+b) / scores.length).toFixed(2) : 0;
      const maxScore = scores.length > 0 ? Math.max(...scores).toFixed(2) : 0;
      
      stats.push({
        course_name: course.name,
        total_attempts: attemptCount || 0,
        average_score: parseFloat(avgScore),
        max_score: parseFloat(maxScore),
        unique_students: sessions ? new Set(sessions.map(s => s.user_email)).size : 0
      });
    }
    
    return res.json(stats);
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/students -> student progress list
app.get('/api/analytics/students', verifyAuth, async (req, res) => {
  try{
    const { data: progress } = await supabase
      .from('student_progress')
      .select('user_email, course_name, total_attempts, best_score, average_score, last_attempted')
      .order('last_attempted', { ascending: false });
    
    return res.json(progress || []);
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/student-detail/:email -> detailed stats for one student
app.get('/api/analytics/student-detail/:email', verifyAuth, async (req, res) => {
  try{
    const email = req.params.email;
    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });
    
    const { data: progress } = await supabase
      .from('student_progress')
      .select('*')
      .eq('user_email', email);
    
    return res.json({
      email,
      total_attempts: (sessions || []).length,
      sessions: sessions || [],
      progress: progress || []
    });
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/student-dashboard/stats -> personal student stats
app.get('/api/student-dashboard/stats', verifyAuth, async (req, res) => {
  try{
    const user_email = req.user.email || req.user.user_metadata?.email;
    if(!user_email) return res.status(400).json({ error: 'No user email found' });
    
    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('score, total_questions, correct_answers')
      .eq('user_email', user_email);
    
    if(!sessions || sessions.length === 0) {
      return res.json({
        total_attempts: 0,
        best_score: 0,
        average_score: 0
      });
    }
    
    const scores = sessions.map(s => s.score);
    return res.json({
      total_attempts: sessions.length,
      best_score: Math.max(...scores),
      average_score: (scores.reduce((a,b) => a+b) / scores.length).toFixed(2)
    });
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/student-dashboard/history -> personal quiz history
app.get('/api/student-dashboard/history', verifyAuth, async (req, res) => {
  try{
    const user_email = req.user.email || req.user.user_metadata?.email;
    if(!user_email) return res.status(400).json({ error: 'No user email found' });
    
    const { data: sessions } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('user_email', user_email)
      .order('created_at', { ascending: false });
    
    return res.json(sessions || []);
  } catch(err){
    return res.status(500).json({ error: err.message });
  }
});

// Serve main HTML file for root and SPA routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'deepseek_html_20260327_1d2e5d.html'));
});

// Catch-all for SPA routing - MUST be last after static files
// Note: express.static() middleware above will serve /js/*, /*.html, etc. before this route
app.use('*', (req, res) => {
  // Don't serve HTML for static file requests - let express.static() handle them
  if (req.path.match(/\.(js|css|html|json|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'deepseek_html_20260327_1d2e5d.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

