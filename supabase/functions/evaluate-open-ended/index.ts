import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EvaluationRequest {
  question_text: string
  model_answer: string
  student_answer: string
  max_marks: number
}

interface EvaluationResponse {
  score: number
  feedback: string
  how_to_improve: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Parse and validate request body
    let requestBody: any
    try {
      requestBody = await req.json()
    } catch (parseError) {
      throw new Error(`Invalid JSON in request body: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }

    const {
      question_text,
      model_answer,
      student_answer,
      max_marks,
    } = requestBody

    // Validate required fields
    if (!question_text || typeof question_text !== 'string' || question_text.trim() === '') {
      throw new Error('question_text is required and must be a non-empty string')
    }
    if (!model_answer || typeof model_answer !== 'string' || model_answer.trim() === '') {
      throw new Error('model_answer is required and must be a non-empty string')
    }
    if (student_answer === undefined || student_answer === null || typeof student_answer !== 'string') {
      throw new Error('student_answer is required and must be a string')
    }
    if (max_marks === undefined || max_marks === null || typeof max_marks !== 'number' || max_marks <= 0) {
      throw new Error('max_marks is required and must be a positive number')
    }

    // Handle empty student answers - return score of 0 without calling OpenAI
    if (student_answer.trim() === '') {
      const evaluation: EvaluationResponse = {
        score: 0,
        feedback: 'No answer provided.',
        how_to_improve: 'Please provide an answer to receive feedback.',
      }

      return new Response(
        JSON.stringify(evaluation),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        },
      )
    }

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Create evaluation prompt
    const evaluationPrompt = `You are an expert exam evaluator. Evaluate the student's answer against the model answer.

Question: ${question_text}

Model Answer (Full marks answer): ${model_answer}

Student Answer: ${student_answer}

Maximum Marks: ${max_marks}

Evaluate the student's answer and provide:
1. A score out of ${max_marks} (round to whole number)
2. Brief feedback (1-2 sentences) explaining what was correct, incorrect, or missing
3. Direct, concise guidance on how to improve (2-3 sentences maximum). Be specific about what the student should write to get better marks.

Respond in JSON format:
{
  "score": <number>,
  "feedback": "<brief feedback>",
  "how_to_improve": "<direct, concise guidance on what to write to improve>"
}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational evaluator. Provide fair, accurate, and constructive evaluation of student answers.',
          },
          {
            role: 'user',
            content: evaluationPrompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent evaluation
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI API request failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    if (data.error) {
      throw new Error(`OpenAI API error: ${data.error.message}`)
    }

    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error('OpenAI API returned invalid response format')
    }

    const content = data.choices[0].message.content
    
    // Clean and parse JSON
    let cleanedContent = content.trim()
    cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    let evaluationJson: any
    try {
      evaluationJson = JSON.parse(cleanedContent)
    } catch (parseError) {
      throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }
    
    // Ensure score doesn't exceed max_marks and round to whole number
    const score = Math.round(Math.min(Math.max(0, evaluationJson.score || 0), max_marks))

    const evaluation: EvaluationResponse = {
      score,
      feedback: evaluationJson.feedback || '',
      how_to_improve: evaluationJson.how_to_improve || evaluationJson.feedback || '',
    }

    return new Response(
      JSON.stringify(evaluation),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})

