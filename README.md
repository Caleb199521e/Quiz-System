# EcoRevise (Quiz System) 🎓

A modern, production-ready quiz management system with responsive design, student progress tracking, and comprehensive analytics.

## Features

### For Students
- ✅ Take quizzes with course/topic selection
- 📊 View personal dashboard with stats and history
- 📈 Track progress and scores over time
- 🔄 Auto-resume quizzes on page refresh
- 🔐 Secure authentication via Supabase

### For Staff
- 📝 Add questions individually or via batch upload
- 📂 Manage courses and topics
- 👁️ Preview quizzes without recording
- 📊 View comprehensive analytics dashboard
- 🗑️ Delete courses with automatic cleanup

### General
- 📱 Fully responsive design (mobile, tablet, desktop)
- 🎨 Tailwind CSS with Material Symbols icons
- ⚡ Fast performance with optimized state management
- 🔔 Toast notifications for user feedback
- 🌐 Real-time database with Supabase

## Tech Stack

- **Frontend**: Vanilla JavaScript, Tailwind CSS v3, Material Symbols
- **Backend**: Express.js, Node.js 18
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Heroku
- **Testing**: Jest

## Quick Start (Development)

### Installation
```bash
cd "c:\Users\Quo Bena\Documents\Quiz System"
npm install
```

### Development Mode
```bash
npm run dev
```
Server runs at `http://localhost:3000`

### Production Mode
```bash
npm start
```

### Testing
```bash
npm test
```

## Deployment

### Deploy to Heroku

**See [HEROKU_DEPLOYMENT.md](HEROKU_DEPLOYMENT.md) for complete instructions**

Quick summary:
```bash
heroku login
heroku create your-app-name
heroku config:set SUPABASE_URL=<your-url>
heroku config:set SUPABASE_SERVICE_ROLE_KEY=<your-key>
heroku config:set SUPABASE_ANON_KEY=<your-anon-key>
git push heroku main
heroku open
```

## Project Structure

```
├── server.js                          # Express backend
├── deepseek_html_20260327_1d2e5d.html # Main HTML (single-file frontend)
├── js/
│   ├── app.js                         # UI and event handling
│   ├── lib.js                         # Utility functions
│   └── config.example.js              # Configuration template
├── server/
│   └── schema.sql                     # Database schema
├── tests/
│   └── lib.test.js                    # Jest tests
├── package.json                       # Node dependencies
├── Procfile                           # Heroku configuration
└── .env.example                       # Environment variables template
```

## Environment Setup

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   PORT=3000
   ```

## Database Schema

The schema is automatically set up in Supabase. See `server/schema.sql` for:
- `questions` - Quiz questions with course/topic
- `courses` - Available courses
- `quiz_sessions` - Student quiz attempts
- `student_progress` - Aggregate stats per student

## API Endpoints

### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/signin` - Sign in
- `GET /auth/callback` - Email confirmation redirect

### Questions & Courses
- `GET /api/questions` - Fetch all questions
- `POST /api/questions` - Add single question
- `POST /api/batch-upload` - Batch import
- `GET /api/courses` - List courses
- `DELETE /api/questions/:id` - Remove question

### Student
- `POST /api/quiz-sessions` - Record quiz attempt
- `GET /api/student-dashboard/stats` - Personal stats
- `GET /api/student-dashboard/history` - Quiz history

### Analytics (Staff)
- `GET /api/analytics/overview` - Dashboard summary
- `GET /api/analytics/courses` - Course statistics
- `GET /api/analytics/students` - Student progress

## User Roles

### Student
- Sign in with email
- Select course/topic
- Take quizzes
- View personal dashboard

### Staff
- Sign in with email
- Add/delete questions
- Preview quizzes (read-only mode)
- View analytics

### Admin
- Access analytics dashboard
- View all student data
- Monitor system health

## Key Features Explained

### Quiz Progress Persistence
- Saves quiz progress to sessionStorage on each answer
- Auto-resumes from last viewed question on page refresh
- Clears progress when quiz completes

### Staff Preview Mode
- Staff can view quizzes without affecting scores
- Marked clearly with blue banner
- Results not tracked to database

### Multi-Level Filtering
- Filter by course, topic, search text, and sort method
- Real-time filtering with visual feedback
- Maintains selection state

### Toast Notifications
- Success (green), error (red), warning (yellow), info (blue)
- Auto-dismiss after 3 seconds
- Stack multiple notifications

## Responsive Design

Breakpoints:
- **XS**: 320px (mobile)
- **SM**: 640px (tablet)
- **MD**: 768px (small laptop)
- **LG**: 1024px (laptop)
- **XL**: 1280px (desktop)
- **2XL**: 1536px (large screen)

## Security Considerations

- ✅ Environment variables for secrets
- ✅ Supabase Auth with JWT tokens
- ✅ Row-level security in database
- ✅ Staff-only operations protected
- ✅ No student-to-staff role switching
- ✅ Staff preview mode doesn't track data
- ✅ Credentials excluded from git (.gitignore)

## Testing

Run Jest tests:
```bash
npm test
```

Tests cover:
- Batch parsing utility
- Question validation
- Score calculations

## Contributing

1. Create feature branch
2. Make changes
3. Test locally (`npm run dev`)
4. Commit with clear messages
5. Push to repository

## License

Proprietary - All rights reserved

## Support

For issues or questions, check:
- [HEROKU_DEPLOYMENT.md](HEROKU_DEPLOYMENT.md) - Deployment help
- [PROJECT_STATUS.md](PROJECT_STATUS.md) - Feature status
- [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Common tasks
