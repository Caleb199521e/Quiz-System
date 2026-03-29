// Local frontend config (public values only). This file is git-ignored.
// Keep SUPABASE_SERVICE_ROLE_KEY in `.env` for `server.js` only.
// Dynamic API_BASE: uses the same protocol and domain as the frontend
// Works on localhost (http://localhost:3000), Vercel (https://app.vercel.app), Heroku, etc.
window.ECOREVISE_CONFIG = {
  SUPABASE_URL: 'https://hvluboobnrcmhvdjvzpx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2bHVib29ibnJjbWh2ZGp2enB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Nzg2MDUsImV4cCI6MjA5MDI1NDYwNX0.iNH7S7NjRFPR7laT9J9mqUsbbNbTvapT1iqNgyI3cKI',
  API_BASE: window.location.protocol + '//' + window.location.host
};
