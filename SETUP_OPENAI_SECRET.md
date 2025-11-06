# Setting Up OpenAI API Key as a Secret

Your Supabase Edge Functions need the OpenAI API key to work. Here's how to set it up securely.

## Method 1: Using Supabase CLI (Recommended)

If you have the Supabase CLI installed:

1. **Authenticate with Supabase** (if not already authenticated):
   
   You need to login to Supabase CLI first. Run this command in your terminal:
   ```bash
   supabase login
   ```
   
   This will open your browser to authenticate. If you're in a non-interactive environment, you can:
   - Get an access token from: https://supabase.com/dashboard/account/tokens
   - Set it as an environment variable:
     ```bash
     $env:SUPABASE_ACCESS_TOKEN="your_access_token_here"
     ```
     (On Windows PowerShell - use `export` on Mac/Linux)

2. **Find your project reference**:
   
   Your project reference is: **`xfczsygoqfgqcczwooqg`**
   
   (This was extracted from your `VITE_SUPABASE_URL` in your .env file)
   
   **Alternative ways to find it:**
   - From your `.env` file: Look for `VITE_SUPABASE_URL` - the part before `.supabase.co` is your project ref
   - From Supabase Dashboard: Go to **Project Settings** → **General** → Look for **Reference ID**
   - From Dashboard URL: `https://supabase.com/dashboard/project/[YOUR_PROJECT_REF]`

3. **Link your project** (if not already linked):
   ```bash
   supabase link --project-ref xfczsygoqfgqcczwooqg
   ```
   
   You should see a success message confirming the link.

4. **Set the secret**:
   ```bash
   supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
   ```

5. **Verify the secret was set**:
   ```bash
   supabase secrets list
   ```

## Method 2: Using Supabase Dashboard

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
4. Click **Add Secret**
5. Enter:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-...`)
6. Click **Save**

## Method 3: Using Supabase Dashboard (Alternative Path)

1. Go to your Supabase Dashboard
2. Select your project
3. Navigate to **Project Settings** → **API**
4. Scroll down to **Edge Functions**
5. Click on **Secrets** tab
6. Add a new secret with:
   - Key: `OPENAI_API_KEY`
   - Value: Your OpenAI API key

## Getting Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click **Create new secret key**
4. Give it a name (e.g., "Exaim App")
5. Copy the key (you'll only see it once!)

**Important**: The key starts with `sk-` and looks like: `sk-proj-...` or `sk-...`

## Verifying It Works

After setting the secret, test it by:

1. Creating a new exam in your app
2. Selecting "AI Generation" mode
3. Generating questions
4. If you see an error about `OPENAI_API_KEY not configured`, the secret wasn't set correctly

## Security Notes

✅ **DO**:
- Store the key as a Supabase secret (never in code)
- Use environment variables for local development
- Rotate keys if exposed

❌ **DON'T**:
- Commit API keys to git
- Put keys in client-side code
- Share keys publicly
- Hardcode keys in your functions

## Troubleshooting

### Error: "OPENAI_API_KEY not configured"

1. Make sure you set the secret in the correct project
2. Verify the secret name is exactly `OPENAI_API_KEY` (case-sensitive)
3. Try redeploying your Edge Functions:
   ```bash
   supabase functions deploy generate-questions
   supabase functions deploy evaluate-open-ended
   ```

### Testing Locally

If you want to test Edge Functions locally:

1. Create a `.env.local` file in your project root:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

2. Run the function locally:
   ```bash
   supabase functions serve generate-questions --env-file .env.local
   ```

**Note**: The `.env.local` file is already in `.gitignore`, so it won't be committed.

## Additional Resources

- [Supabase Secrets Documentation](https://supabase.com/docs/guides/functions/secrets)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)

