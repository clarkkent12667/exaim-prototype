# Fix Profile Role Issue

## Problem
- Role shows as "Unknown" after signup
- Shows Student Dashboard even when signed up as Teacher

## Quick Fix Steps

### Step 1: Check Your Database

1. Go to Supabase Dashboard → **Table Editor**
2. Click on **profiles** table
3. Check if your user's profile exists:
   - Look for your email
   - Check the `role` column - is it set to "teacher"?
   - If the profile doesn't exist or has wrong role, continue to Step 2

### Step 2: Verify RLS Policies

The insert policy might be blocking profile creation. Run this SQL in Supabase SQL Editor:

```sql
-- Check if insert policy exists
SELECT * FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile';

-- If it doesn't exist, create it:
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);
```

### Step 3: Manually Fix Existing Profile

If your profile exists but has wrong role, run this SQL (replace with your user ID):

```sql
-- First, get your user ID from auth.users:
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Then update the profile (replace USER_ID_HERE with actual ID):
UPDATE profiles 
SET role = 'teacher' 
WHERE id = 'USER_ID_HERE';
```

### Step 4: Test Again

1. Sign out completely
2. Sign up again as a teacher
3. Check browser console for logs - you should see:
   - "Signing up with role: teacher"
   - "User created: [user-id]"
   - "Profile found" or "Profile created"
4. The role should now show correctly

## Debug Console Logs

Open browser console (F12) and look for:
- `Signing up with role: teacher` - confirms role is being sent
- `User metadata: {role: "teacher", ...}` - confirms metadata is set
- `Profile found (created by trigger): {...}` - profile was created by database
- `Profile created via RPC function` - profile was created via RPC
- `Profile created via direct insert` - profile was created via direct insert
- Any error messages

## If Still Not Working

1. **Check Supabase Logs:**
   - Go to Supabase Dashboard → **Logs** → **Postgres Logs**
   - Look for errors when creating profile

2. **Verify Trigger:**
   ```sql
   -- Check if trigger exists
   SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';
   ```

3. **Verify Function:**
   ```sql
   -- Test the function manually
   SELECT create_user_profile(
     'your-user-id-here',
     'your-email@example.com',
     'teacher',
     'Your Name'
   );
   ```

4. **Check RLS:**
   - Temporarily disable RLS to test:
   ```sql
   ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
   -- Test signup
   -- Then re-enable:
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ```

## Common Issues

1. **Email confirmation enabled:** If email confirmation is required, the profile might not be created until email is confirmed. Disable it in Auth Settings.

2. **RLS blocking insert:** The insert policy might not be working. Make sure it's created correctly.

3. **Trigger not firing:** The database trigger might not be set up. Re-run the SQL from SETUP_SUPABASE.md

4. **Metadata not passed:** Check that user_metadata contains the role. The console logs will show this.





