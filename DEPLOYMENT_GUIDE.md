# Edge Functions Deployment Guide

## ✅ Functions Deployed Successfully!

Both Edge Functions have been deployed to your Supabase project:
- ✅ `generate-questions` - Deployed
- ✅ `evaluate-open-ended` - Deployed

## Critical: Verify OpenAI API Key Secret

The functions require the `OPENAI_API_KEY` secret to work. Verify it's set:

### Option 1: Check via Supabase Dashboard (Easiest)

1. Go to: https://supabase.com/dashboard/project/xfczsygoqfgqcczwooqg
2. Navigate to **Project Settings** → **Edge Functions** → **Secrets**
3. Verify `OPENAI_API_KEY` is listed
4. If not, click **Add Secret**:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-...`)
   - Click **Save**

### Option 2: Set via CLI

1. Make sure you're logged in:
   ```bash
   supabase login
   ```

2. Set the secret:
   ```bash
   supabase secrets set OPENAI_API_KEY=your_openai_api_key_here
   ```

3. Verify it was set:
   ```bash
   supabase secrets list
   ```

## Testing the Deployment

### Test generate-questions Function

1. Open your app and navigate to "Create Exam"
2. Select "AI Generation" mode
3. Fill in the form:
   - Qualification
   - Exam Board
   - Subject
   - Question counts (MCQ, FIB, Open-ended)
4. Click "Generate Questions"
5. Check the browser console for any errors

### Check Function Logs

If you encounter errors:

1. Go to: https://supabase.com/dashboard/project/xfczsygoqfgqcczwooqg/functions
2. Click on `generate-questions`
3. View the **Logs** tab to see detailed error messages

## Common Issues and Solutions

### Error: "OPENAI_API_KEY not configured"

**Solution**: The secret hasn't been set. Follow the steps above to set it via Dashboard or CLI.

### Error: "Function not found" or 404

**Solution**: 
- Verify the function is deployed: https://supabase.com/dashboard/project/xfczsygoqfgqcczwooqg/functions
- Redeploy if needed:
  ```bash
  supabase functions deploy generate-questions
  ```

### Error: "Unauthorized" or Authentication Issues

**Solution**: 
- Make sure you're logged in as a user
- Check that the Authorization header is being sent correctly
- Verify your Supabase URL and keys in `.env` file

### Error: OpenAI API Errors

**Solution**:
- Verify your OpenAI API key is valid
- Check your OpenAI account has credits/quota
- Review function logs for specific OpenAI error messages

## Redeploying Functions

If you make changes to the function code:

```bash
# Deploy generate-questions
supabase functions deploy generate-questions

# Deploy evaluate-open-ended
supabase functions deploy evaluate-open-ended

# Deploy both at once
supabase functions deploy generate-questions evaluate-open-ended
```

## View Function Details

You can view and manage your functions at:
https://supabase.com/dashboard/project/xfczsygoqfgqcczwooqg/functions

## Getting Help

If issues persist:
1. Check function logs in the Supabase Dashboard
2. Check browser console for frontend errors
3. Verify all environment variables are set correctly
4. Ensure you're authenticated when calling the function




