const { supabaseAdmin } = require('../config/supabase.config');

/**
 * Initialize database connection (Supabase)
 * Note: This function checks connectivity. Table creation should be run
 * manually via the Supabase SQL editor using `schema.sql` located in
 * `Server/src/database/schema.sql`.
 */
async function initializeDatabase() {
  try {
    // Simple connectivity check against 'users' table
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('Supabase connection OK, but tables may not exist yet.');
      console.warn('Please run Server/src/database/schema.sql in the Supabase SQL editor.');
    } else {
      console.log('✅ Connected to Supabase (tables accessible)');
    }
  } catch (err) {
    console.error('❌ Error connecting to Supabase:', err.message || err);
    throw err;
  }
}

/**
 * Compatibility helpers
 * NOTE: The original code used raw SQL via `pg`. That usage must be
 * migrated to Supabase client calls. For now, these helpers throw clear
 * errors to avoid accidental silent failures and to guide the developer.
 */
async function query() {
  throw new Error(
    'Raw SQL queries are not supported. Migrate calls to use supabaseAdmin.from()/insert()/update() or run `schema.sql` in Supabase.'
  );
}

async function getOne() {
  throw new Error(
    'getOne() is not implemented for Supabase. Replace database/init query usage with supabaseAdmin calls.'
  );
}

async function getAll() {
  throw new Error(
    'getAll() is not implemented for Supabase. Replace database/init query usage with supabaseAdmin calls.'
  );
}

module.exports = {
  supabaseAdmin,
  initializeDatabase,
  query,
  getOne,
  getAll
};
