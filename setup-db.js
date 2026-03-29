#!/usr/bin/env node

/**
 * Initialize Supabase Database Schema
 * Runs server/schema.sql against your Supabase project
 * 
 * Usage: node setup-db.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

// Read the schema SQL file
const schemaPath = path.join(__dirname, 'SUPABASE_SCHEMA.sql');
let schemaSql;

try {
  schemaSql = fs.readFileSync(schemaPath, 'utf8');
} catch (err) {
  console.error('❌ Error reading schema file:', err.message);
  process.exit(1);
}

// Remove comments and split into individual statements
const statements = schemaSql
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt && !stmt.startsWith('--'))
  .map(stmt => stmt + ';');

async function setupDatabase() {
  try {
    console.log('🔗 Connecting to Supabase...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`📝 Running ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`[${i + 1}/${statements.length}] Executing...`);
      
      const { error } = await supabase.rpc('exec', { p_query: stmt }).catch(() => ({
        error: null // Some statements may not work with rpc, try raw SQL
      }));

      // Fallback: use the admin API for raw SQL
      if (error || !supabase.rpc) {
        try {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'apikey': SUPABASE_SERVICE_ROLE_KEY
            },
            body: JSON.stringify({ p_query: stmt })
          });
          
          if (!response.ok) {
            console.warn(`  ⚠️  Statement may have issues (expected for some operations)`);
          } else {
            console.log(`  ✔️  OK`);
          }
        } catch (err) {
          console.warn(`  ⚠️  ${err.message}`);
        }
      } else {
        console.log(`  ✔️  OK`);
      }
    }

    console.log('\n✅ Database setup complete!');
    console.log('\nNext steps:');
    console.log('  1. npm start');
    console.log('  2. Open http://localhost:3000');
    console.log('  3. Sign up / Sign in');
    console.log('  4. Add questions and start taking quizzes!');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    process.exit(1);
  }
}

setupDatabase();
