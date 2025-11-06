# Authentication Debugging Guide

## Overview
I've added comprehensive debugging to help identify authentication issues. All logs are prefixed with `[AuthContext]`, `[LoginForm]`, or `[SignupForm]` for easy filtering.

## What Was Added

### 1. **Console Logging**
- All authentication operations now log detailed information
- Profile fetching operations are logged
- Navigation attempts are logged
- Error states are logged with full details

### 2. **Improved SQL Setup**
A new `supabase_setup.sql` file has been created with:
- Better error handling in trigger functions
- Improved RLS policies
- Manual profile creation fallback
- Proper permissions

### 3. **Enhanced Error Handling**
- Multiple fallback methods for profile creation
- Better error messages
- Timeout protection

## How to Debug

### Step 1: Open Browser Console
1. Open your app in the browser
2. Press `F12` or right-click → Inspect
3. Go to the **Console** tab
4. Clear the console (optional)

### Step 2: Try Signing In/Up
1. Attempt to sign in or sign up
2. Watch the console logs
3. Look for any red error messages

### Step 3: Check for Common Issues

#### Issue: "Profile not found"
**Log pattern:** `[AuthContext] Profile not found for user: ...`
**Solution:** 
- Check if the SQL trigger was run correctly
- Verify the `profiles` table exists
- Check RLS policies allow the user to read their profile

#### Issue: "Manual profile creation error"
**Log pattern:** `[AuthContext] Manual profile creation error: ...`
**Solution:**
- Run the `supabase_setup.sql` file in Supabase SQL Editor
- Check if `create_user_profile` function exists
- Verify RLS policies allow profile insertion

#### Issue: "Dashboard route is /auth"
**Log pattern:** `[LoginForm] Dashboard route is /auth, not navigating`
**Solution:**
- Profile is not loading (check profile fetch logs)
- Profile might be missing (check database)
- User might not have a role assigned

## SQL Setup Instructions

1. Go to Supabase Dashboard → SQL Editor
2. Click **New Query**
3. Copy the entire contents of `supabase_setup.sql`
4. Paste and click **Run**
5. You should see "Success. No rows returned"

## Testing Checklist

- [ ] SQL setup completed successfully
- [ ] Browser console shows logs when signing in
- [ ] Profile is fetched successfully (check logs)
- [ ] Navigation happens after profile loads
- [ ] No errors in console

## What to Look For in Logs

### Successful Sign In Flow:
```
[LoginForm] Form submitted
[AuthContext] signIn called
[AuthContext] Calling supabase.auth.signInWithPassword...
[AuthContext] Sign in response: { hasUser: true, hasSession: true }
[AuthContext] User signed in, fetching profile
[AuthContext] fetchUserProfile called
[AuthContext] Profile loaded successfully: { ... }
[LoginForm] useEffect triggered: { hasProfile: true, ... }
[LoginForm] Navigating to dashboard: /student/dashboard
```

### Successful Sign Up Flow:
```
[SignupForm] Form submitted
[AuthContext] signUp called
[AuthContext] User created, waiting for profile trigger...
[AuthContext] Fetching profile after trigger delay...
[AuthContext] Profile found after trigger
[SignupForm] Session exists, waiting for profile...
[SignupForm] useEffect triggered: { hasProfile: true, ... }
[SignupForm] Navigating to dashboard: /teacher/dashboard
```

## Common Error Patterns

### Error: "PGRST116" or "No rows"
- Profile doesn't exist in database
- Trigger might not have fired
- Solution: Run SQL setup again

### Error: "RLS policy violation"
- Row Level Security is blocking the operation
- Solution: Check RLS policies in SQL setup

### Error: "Function does not exist"
- `create_user_profile` function missing
- Solution: Run `supabase_setup.sql` again

## Next Steps

1. **Run the SQL setup** if you haven't already
2. **Open browser console** and try signing in
3. **Share the console logs** if issues persist
4. **Check Supabase logs** (Dashboard → Logs → Postgres Logs) for database errors

