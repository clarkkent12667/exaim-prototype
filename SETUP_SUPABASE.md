# Complete Supabase Setup Guide

## ✅ Your .env file is already configured!

Your Supabase credentials are set up. Now you need to complete the database setup.

## Step 1: Run the Database SQL

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the ENTIRE SQL script below:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile (for signup)
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function to create profile automatically (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to manually create profile (for existing users or if trigger fails)
CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_email TEXT,
  user_role TEXT,
  user_full_name TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, full_name)
  VALUES (user_id, user_email, user_role, user_full_name)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

6. Click **Run** (or press Ctrl+Enter)
7. You should see "Success. No rows returned"

## Step 2: Disable Email Confirmation (Optional but Recommended)

For development, it's easier to disable email confirmation:

1. Go to **Authentication** → **Settings** in your Supabase dashboard
2. Under **Email Auth**, find **"Enable email confirmations"**
3. **Toggle it OFF** (disable it)
4. This allows users to sign up and immediately log in without email verification

## Step 3: Test the Application

1. Make sure your dev server is running: `npm run dev`
2. Open http://localhost:5173
3. Try signing up as a teacher:
   - Click "Sign up"
   - Fill in your details
   - Select "Teacher" as role
   - Click "Sign Up"
4. You should be automatically logged in and see the Teacher Dashboard!

## Troubleshooting

### If profile creation fails:
- Check the Supabase logs: Go to **Logs** → **Postgres Logs** in Supabase dashboard
- Make sure the trigger was created successfully
- Try manually creating a profile using the SQL function

### If you see "Loading..." stuck:
- Check browser console for errors
- Verify your .env file has correct credentials
- Make sure the database SQL was run successfully

### If logout doesn't work:
- The fixes have been applied - try refreshing the page
- Clear browser cache if needed

## What's Fixed

✅ **Role loading issue** - Profile is now fetched correctly after signup  
✅ **Logout functionality** - Properly clears state and redirects  
✅ **Profile creation** - Multiple fallback methods ensure profile is created  
✅ **Auth state management** - Simplified and more reliable  
✅ **Error handling** - Better error handling throughout  

Your authentication should now work perfectly!




