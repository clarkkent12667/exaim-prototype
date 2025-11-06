# Exaim Prototype

A modern exam management application built with React, Vite, Supabase, Tailwind CSS v4, and shadcn/ui.

## Features

- 🔐 Authentication with role-based access (Teacher/Student)
- 🎨 Modern UI with Tailwind CSS v4 and shadcn/ui
- ⚡ Fast development with Vite
- 🗄️ Supabase for backend and authentication
- 📱 Responsive design

## Prerequisites

- Node.js 18+ and npm
- A Supabase project

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Supabase:**
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Project Settings > API
   - Copy your Project URL and anon/public key

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database:**

   Run this SQL in your Supabase SQL Editor to create the profiles table and Row Level Security policies:

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
   DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
   DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
   DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

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

   -- Function to create profile (bypasses RLS with SECURITY DEFINER)
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

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   Navigate to `http://localhost:5173`

## Project Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   └── ui/             # shadcn/ui components
├── contexts/           # React contexts (AuthContext)
├── lib/                # Utilities and Supabase client
├── pages/              # Page components
├── App.tsx             # Main app component with routing
└── main.tsx            # Entry point
```

## Authentication

The app supports two roles:
- **Teacher**: Can create and manage exams
- **Student**: Can take exams and view results

Users can sign up with either role, and the system enforces role-based access control.

## Technologies

- **React 18** - UI library
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **shadcn/ui** - UI components
- **Supabase** - Backend and authentication
- **React Router** - Routing

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

