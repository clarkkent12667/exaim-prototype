# Database Setup Instructions

## Quick Fix: Run the Complete SQL Script

The 404 error means the database tables haven't been created yet. Follow these steps:

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `xfczsygoqfgqcczwooqg` (from the error URL)
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Complete SQL Script

1. Open the file `supabase_setup.sql` in this project
2. **Copy the ENTIRE file** (from line 1 to the end - it includes both authentication AND exam management tables)
3. Paste it into the SQL Editor in Supabase
4. Click **Run** (or press Ctrl+Enter / Cmd+Enter)

### Step 3: Verify Success

You should see:
- "Success. No rows returned" or similar success message
- No error messages

### Step 4: Test in Your App

1. Refresh your application
2. Try adding a qualification again
3. It should work now!

## What the SQL Script Creates

The complete script creates:
- ✅ `profiles` table (for authentication)
- ✅ `qualifications` table
- ✅ `exam_boards` table
- ✅ `subjects` table
- ✅ `topics` table
- ✅ `subtopics` table
- ✅ `exams` table
- ✅ `questions` table
- ✅ `question_options` table
- ✅ `exam_attempts` table
- ✅ `student_answers` table
- ✅ `exam_statistics` table
- ✅ All RLS policies
- ✅ All indexes and triggers

## Troubleshooting

### If you get errors about tables already existing:
- That's fine! The script uses `CREATE TABLE IF NOT EXISTS` so it's safe to run multiple times
- Just ignore those warnings

### If you get permission errors:
- Make sure you're running it as the database owner
- Check that you're in the correct project

### If tables still don't appear:
1. Check the **Table Editor** in Supabase dashboard
2. You should see all the tables listed
3. If not, refresh the page and check again

## Need Help?

If you're still having issues:
1. Check the Supabase **Logs** → **Postgres Logs** for detailed error messages
2. Make sure you copied the ENTIRE `supabase_setup.sql` file (it should be ~600+ lines)
3. Try running it in smaller chunks if there's an error

