# Test Data Setup Script

This script helps you quickly set up test data for the application, including students, classes, exam assignments, and exam attempts with varying performance levels.

## What It Does

The script will:
1. **Create 10 students** (or find existing ones)
2. **Create a "Chemistry Class"**
3. **Enroll all 10 students** in the class
4. **Assign an existing published exam** to the class
5. **Create exam attempts** with varying results:
   - 3 students with **good** performance (high scores)
   - 4 students with **average** performance (medium scores)
   - 3 students with **bad** performance (low scores)

## Prerequisites

1. **A teacher account** must exist in the system
2. **At least one published exam** with questions must exist
3. **Environment variables** set up (see below)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory (or use your existing one) with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Optional** (for automatic user creation):
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

> **Note:** The Service Role Key is only needed if you want the script to automatically create student accounts. If you don't provide it, you'll need to create the students manually first via the UI.

### 3. Get Your Service Role Key (Optional)

1. Go to your Supabase Dashboard
2. Navigate to **Settings** → **API**
3. Copy the **service_role** key (keep this secret!)

## Usage

### Run the Script

```bash
npm run setup:test-data
```

Or directly with tsx:

```bash
npx tsx scripts/setup-test-data.ts
```

### What Happens

The script will:
- Check for an existing teacher account
- Find a published exam (or show available exams if none found)
- Create or find 10 students with emails like `student1.chemistry@test.com` through `student10.chemistry@test.com`
- Create the "Chemistry Class"
- Enroll all students
- Assign the exam
- Create attempts with realistic answers based on performance level

### Student Accounts

If the Service Role Key is provided, students will be created with:
- **Email**: `student1.chemistry@test.com` through `student10.chemistry@test.com`
- **Password**: `Test123!@#`
- **Role**: Student
- **Full Names**: Alice Johnson, Bob Smith, Charlie Brown, etc.

You can log in as any of these students to test the student experience.

## Troubleshooting

### "No teacher found"
- Make sure you have at least one user with `role = 'teacher'` in the profiles table
- You can check this in Supabase Dashboard → Table Editor → profiles

### "No published exam found"
- Create an exam via the teacher dashboard
- Make sure it's published (`is_published = true`)
- Add at least one question to the exam

### "Cannot create user"
- If you see this warning, the script will try to find existing students
- To create users automatically, provide the `SUPABASE_SERVICE_ROLE_KEY`
- Alternatively, create the students manually via the signup page

### "Error creating student"
- Check that your Service Role Key is correct
- Verify RLS policies allow user creation
- Check Supabase logs for detailed error messages

## Manual Student Creation (Alternative)

If you prefer to create students manually:

1. Go to the signup page
2. Create 10 student accounts with emails matching the pattern:
   - `student1.chemistry@test.com`
   - `student2.chemistry@test.com`
   - etc.
3. Then run the script - it will find and use these existing students

## After Running

Once the script completes successfully, you can:

1. **Test as a student**: Log in as any student account to see assigned exams and results
2. **Test as a teacher**: View the Chemistry Class, see all student attempts, and check analytics
3. **View analytics**: Check the analytics dashboard to see performance distributions
4. **View grades**: Check the grades pages for both teacher and student views

## Cleanup

To remove test data, you can:

1. Delete the "Chemistry Class" from the Manage Classes page
2. Or run SQL in Supabase to delete:
   ```sql
   -- Delete class (cascades to enrollments and assignments)
   DELETE FROM classes WHERE name = 'Chemistry Class';
   
   -- Delete student attempts (if needed)
   DELETE FROM exam_attempts WHERE student_id IN (
     SELECT id FROM profiles WHERE email LIKE 'student%.chemistry@test.com'
   );
   ```

