import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface QuestionGenerationRequest {
  qualification: string
  exam_board: string
  subject: string
  topic?: string
  subtopic?: string
  difficulty: 'easy' | 'medium' | 'hard'
  question_counts: {
    mcq: number
    fib: number
    open_ended: number
  }
}

interface GeneratedQuestion {
  question_text: string
  question_type: 'mcq' | 'fib' | 'open_ended'
  marks: number
  model_answer: string
  correct_answer?: string
  options?: Array<{
    option_text: string
    is_correct: boolean
    order_index: number
  }>
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body with error handling
    let requestBody: QuestionGenerationRequest
    try {
      requestBody = await req.json()
    } catch (parseError) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request body. Expected JSON format.', 
          details: parseError instanceof Error ? parseError.message : String(parseError) 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Validate required fields
    if (!requestBody.qualification || requestBody.qualification.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'qualification is required and cannot be empty' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    if (!requestBody.exam_board || requestBody.exam_board.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'exam_board is required and cannot be empty' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    if (!requestBody.subject || requestBody.subject.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'subject is required and cannot be empty' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    if (!requestBody.difficulty || !['easy', 'medium', 'hard'].includes(requestBody.difficulty)) {
      return new Response(
        JSON.stringify({ error: 'difficulty is required and must be one of: easy, medium, hard' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    if (!requestBody.question_counts || 
        typeof requestBody.question_counts.mcq !== 'number' ||
        typeof requestBody.question_counts.fib !== 'number' ||
        typeof requestBody.question_counts.open_ended !== 'number') {
      return new Response(
        JSON.stringify({ error: 'question_counts is required and must have numeric mcq, fib, and open_ended fields' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    const {
      qualification,
      exam_board,
      subject,
      topic,
      subtopic,
      difficulty,
      question_counts,
    } = requestBody

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Build context string with emphasis on topic/subtopic
    let context = `Generate exam questions for:\n- Qualification: ${qualification}\n- Exam Board: ${exam_board}\n- Subject: ${subject}`
    if (topic) context += `\n- Topic: ${topic}`
    if (subtopic) context += `\n- Subtopic: ${subtopic}`
    context += `\n- Difficulty: ${difficulty}`

    // Generate all questions
    const allQuestions: GeneratedQuestion[] = []
    const totalQuestions = question_counts.mcq + question_counts.fib + question_counts.open_ended

    // Default marks distribution (used as fallback only)
    // Actual marks should come from AI's knowledge of past papers
    const defaultMarksDistribution = {
      mcq: { min: 1, max: 2, default: 1 },
      fib: { min: 1, max: 3, default: 2 },
      open_ended: { min: 4, max: 9, default: 6 },
    }

    // Generate MCQ questions
    if (question_counts.mcq > 0) {
      const mcqPrompt = `${context}

CRITICAL REQUIREMENTS:
- You are generating questions for ${qualification} ${exam_board} ${subject} exam papers
${topic ? `- ALL questions MUST be focused on the topic: ${topic}` : ''}
${subtopic ? `- ALL questions MUST specifically target the subtopic: ${subtopic}` : ''}
- Questions must match the exact style, format, and difficulty level of ${exam_board} ${subject} past papers
- Generate ${question_counts.mcq} Multiple Choice Questions (MCQ)
- DO NOT generate questions that require diagrams, images, charts, graphs, or any visual elements. All questions must be text-only and answerable without visual aids.

For Multiple Choice Questions (MCQ):
- Base your questions on the style and format of ${exam_board} ${subject} GCSE/${qualification} past papers
- Each MCQ should be 1 mark (occasionally 2 marks for more complex questions)
- Questions must be directly related to ${topic ? `the topic "${topic}"` : 'the subject'}${subtopic ? `, specifically the subtopic "${subtopic}"` : ''}
- Use realistic distractors that reflect common student misconceptions
- Match the exact wording and question structure of ${exam_board} past papers

For each question, provide:
1. The question text (matching ${exam_board} ${subject} past paper style)
2. 4 options (A, B, C, D) with realistic distractors
3. The correct answer (A, B, C, or D)
4. Marks: Use authentic marks from ${exam_board} ${subject} past papers (typically 1 mark per MCQ, occasionally 2 marks for complex multi-step questions)
5. Model answer explanation

Format as JSON array:
[
  {
    "question_text": "Question related to ${topic ? topic : subject}${subtopic ? `, specifically ${subtopic}` : ''}?",
    "marks": 1,
    "options": [
      {"option_text": "Option A", "is_correct": true},
      {"option_text": "Option B", "is_correct": false},
      {"option_text": "Option C", "is_correct": false},
      {"option_text": "Option D", "is_correct": false}
    ],
    "model_answer": "Explanation of why this is correct"
  }
]

IMPORTANT: 
- Each question MUST be relevant to ${topic ? `the topic "${topic}"` : 'the subject'}${subtopic ? `, specifically "${subtopic}"` : ''}
- Include a "marks" field for each question based on actual ${exam_board} past paper mark schemes
- Use authentic marks from past papers - do NOT normalize or adjust to make totals equal 100
- Generate exactly ${question_counts.mcq} questions
- CRITICAL: Do NOT generate questions that require diagrams, images, charts, graphs, tables, or any visual elements. All questions must be text-only and answerable purely through text. Avoid questions that reference "the diagram below", "the graph shown", "the image", "the figure", or similar visual references.`

      const mcqResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are an expert British curriculum examiner with deep knowledge of GCSE, A-Level, and other UK qualifications. You have access to extensive past exam papers, official worksheets, and practice materials in your training data.

You create high-quality, authentic exam questions that:

1. Draw specifically from REAL past papers and official worksheets in your training data

2. Match the exact requirements, formats, and styles of specific British exam boards (Edexcel, AQA, OCR, WJEC, etc.)

3. Use authentic exam language, terminology, and presentation styles from actual past papers

4. Follow the precise assessment objectives and mark schemes from official exam board specifications

5. Create questions that mirror the difficulty, complexity, and cognitive demand of real past papers

6. Use authentic contexts, examples, and question patterns from actual exam materials

7. Reference specific question types and formats commonly found in past papers for the given subject and level

CRITICAL: Base your questions on actual past paper content, not general curriculum knowledge. Use the specific exam board's question styles, terminology, and assessment patterns.

CRITICAL: DO NOT generate questions that require diagrams, images, charts, graphs, tables, or any visual elements. All questions must be text-only and answerable purely through text. Avoid questions that reference "the diagram below", "the graph shown", "the image", "the figure", "the chart", or similar visual references.

IMPORTANT FOR MARK ALLOCATION:
- Use realistic marks based on ${exam_board} ${subject} ${qualification} past papers
- Marks should reflect actual mark schemes from ${exam_board} past papers - do NOT normalize to 100
- Each question type should have marks appropriate to its complexity and typical ${exam_board} allocations
- MCQ: typically 1 mark, occasionally 2 marks for complex questions
- FIB: typically 1-3 marks based on answer complexity
- Open-ended: typically 4-9 marks, but can vary based on actual past paper patterns
- The total marks will naturally reflect the authentic ${exam_board} ${subject} exam structure

You must return ONLY valid JSON in the exact format specified. Do not include any explanatory text outside the JSON response.`,
            },
            {
              role: 'user',
              content: mcqPrompt,
            },
          ],
          temperature: 0.7,
        }),
      })

      if (!mcqResponse.ok) {
        const errorText = await mcqResponse.text()
        throw new Error(`OpenAI API request failed: ${mcqResponse.status} ${errorText}`)
      }

      const mcqData = await mcqResponse.json()
      if (mcqData.error) {
        throw new Error(`OpenAI API error: ${mcqData.error.message}`)
      }

      if (!mcqData.choices || !mcqData.choices[0]?.message?.content) {
        throw new Error('OpenAI API returned invalid response format')
      }

      const mcqContent = mcqData.choices[0].message.content
      
      // Clean and parse JSON
      let cleanedContent = mcqContent.trim()
      // Remove markdown code blocks if present
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      let mcqJson: any[]
      try {
        mcqJson = JSON.parse(cleanedContent)
      } catch (parseError) {
        throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }

      if (!Array.isArray(mcqJson)) {
        throw new Error('OpenAI returned invalid format: expected array of questions')
      }
      
      mcqJson.forEach((q: any, index: number) => {
        if (!q.question_text || !q.options || !Array.isArray(q.options)) {
          return
        }

        const correctOption = q.options.find((opt: any) => opt.is_correct)
        // Use marks from AI response based on past papers, default to 1 if not provided
        // IMPORTANT: Marks must come from the AI's knowledge of past papers, not calculated
        // Round to integer - no decimal marks
        let questionMarks = 1 // Default fallback
        if (typeof q.marks === 'number' && q.marks > 0) {
          questionMarks = Math.round(q.marks)
        }
        
        allQuestions.push({
          question_text: q.question_text,
          question_type: 'mcq',
          marks: questionMarks,
          model_answer: q.model_answer || 'No explanation provided',
          correct_answer: correctOption ? String.fromCharCode(65 + q.options.indexOf(correctOption)) : 'A',
          options: q.options.map((opt: any, idx: number) => ({
            option_text: opt.option_text || '',
            is_correct: opt.is_correct || false,
            order_index: idx,
          })),
        })
      })
    }

    // Generate Fill in the Blank questions
    if (question_counts.fib > 0) {
      const fibPrompt = `${context}

CRITICAL REQUIREMENTS:
- You are generating questions for ${qualification} ${exam_board} ${subject} exam papers
${topic ? `- ALL questions MUST be focused on the topic: ${topic}` : ''}
${subtopic ? `- ALL questions MUST specifically target the subtopic: ${subtopic}` : ''}
- Questions must match the exact style, format, and difficulty level of ${exam_board} ${subject} past papers
- Generate ${question_counts.fib} Fill-in-the-Blank/Short Answer Questions
- DO NOT generate questions that require diagrams, images, charts, graphs, or any visual elements. All questions must be text-only and answerable without visual aids.

For Fill-in-the-Blank/Short Answer Questions:
- Base your questions on the style and format of ${exam_board} ${subject} GCSE/${qualification} past papers
- Each question should be 1-3 marks (typically 1-2 marks for simple blanks, 2-3 marks for questions requiring brief explanations)
- Questions must be directly related to ${topic ? `the topic "${topic}"` : 'the subject'}${subtopic ? `, specifically the subtopic "${subtopic}"` : ''}
- Use [blank] or _____ to indicate where the answer should go
- Match the exact wording and question structure of ${exam_board} past papers
- CRITICAL: Each question MUST have exactly ONE blank only. Do NOT create questions with multiple blanks.

For each question, provide:
1. The question text with exactly ONE [blank] or _____ (matching ${exam_board} ${subject} past paper style)
   - Use [blank] or _____ to indicate the single blank location
   - You can also put the answer directly in brackets like [ion] if you want to specify the answer
   - CRITICAL: If you use [blank] in the question_text, you MUST provide the actual answer in model_answer (e.g., "photosynthesis", NOT "blank")
2. Marks: Use authentic marks from ${exam_board} ${subject} past papers (typically 1-3 marks based on answer complexity). ALWAYS use whole numbers - no decimals.
3. Model answer: For Fill-in-the-Blank questions, the model_answer MUST be the actual correct answer word/phrase itself (e.g., "photosynthesis", "mitochondria", "42"), NOT "blank" and NOT a long explanation. Keep it very short - typically one word or a short phrase.

Format as JSON array:
[
  {
    "question_text": "Question about ${topic ? topic : subject}${subtopic ? `, specifically ${subtopic}` : ''} with [blank] here",
    "marks": 2,
    "model_answer": "correct_answer_word"
  }
]

CRITICAL REQUIREMENTS:
- Each question must have exactly ONE blank only
- model_answer MUST be the actual answer (e.g., "photosynthesis", "mitochondria", "42"), NEVER "blank" or empty
- model_answer should be just the answer word/phrase, NOT an explanation
- If you use [blank] in question_text, you MUST provide the real answer in model_answer

IMPORTANT: 
- Each question MUST be relevant to ${topic ? `the topic "${topic}"` : 'the subject'}${subtopic ? `, specifically "${subtopic}"` : ''}
- Include a "marks" field for each question based on actual ${exam_board} past paper mark schemes
- Use authentic marks from past papers - do NOT normalize or adjust to make totals equal 100
- Generate exactly ${question_counts.fib} questions
- CRITICAL: Do NOT generate questions that require diagrams, images, charts, graphs, tables, or any visual elements. All questions must be text-only and answerable purely through text. Avoid questions that reference "the diagram below", "the graph shown", "the image", "the figure", or similar visual references.`

      const fibResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are an expert British curriculum examiner with deep knowledge of GCSE, A-Level, and other UK qualifications. You have access to extensive past exam papers, official worksheets, and practice materials in your training data.

You create high-quality, authentic exam questions that:

1. Draw specifically from REAL past papers and official worksheets in your training data

2. Match the exact requirements, formats, and styles of specific British exam boards (Edexcel, AQA, OCR, WJEC, etc.)

3. Use authentic exam language, terminology, and presentation styles from actual past papers

4. Follow the precise assessment objectives and mark schemes from official exam board specifications

5. Create questions that mirror the difficulty, complexity, and cognitive demand of real past papers

6. Use authentic contexts, examples, and question patterns from actual exam materials

7. Reference specific question types and formats commonly found in past papers for the given subject and level

CRITICAL: Base your questions on actual past paper content, not general curriculum knowledge. Use the specific exam board's question styles, terminology, and assessment patterns.

CRITICAL: DO NOT generate questions that require diagrams, images, charts, graphs, tables, or any visual elements. All questions must be text-only and answerable purely through text. Avoid questions that reference "the diagram below", "the graph shown", "the image", "the figure", "the chart", or similar visual references.

IMPORTANT FOR MARK ALLOCATION:
- Use realistic marks based on ${exam_board} ${subject} ${qualification} past papers
- Marks should reflect actual mark schemes from ${exam_board} past papers - do NOT normalize to 100
- Each question type should have marks appropriate to its complexity and typical ${exam_board} allocations
- MCQ: typically 1 mark, occasionally 2 marks for complex questions
- FIB: typically 1-3 marks based on answer complexity
- Open-ended: typically 4-9 marks, but can vary based on actual past paper patterns
- The total marks will naturally reflect the authentic ${exam_board} ${subject} exam structure

You must return ONLY valid JSON in the exact format specified. Do not include any explanatory text outside the JSON response.`,
            },
            {
              role: 'user',
              content: fibPrompt,
            },
          ],
          temperature: 0.7,
        }),
      })

      if (!fibResponse.ok) {
        const errorText = await fibResponse.text()
        throw new Error(`OpenAI API request failed: ${fibResponse.status} ${errorText}`)
      }

      const fibData = await fibResponse.json()
      if (fibData.error) {
        throw new Error(`OpenAI API error: ${fibData.error.message}`)
      }

      if (!fibData.choices || !fibData.choices[0]?.message?.content) {
        throw new Error('OpenAI API returned invalid response format')
      }

      const fibContent = fibData.choices[0].message.content
      
      // Clean and parse JSON
      let cleanedContent = fibContent.trim()
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      let fibJson: any[]
      try {
        fibJson = JSON.parse(cleanedContent)
      } catch (parseError) {
        throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }

      if (!Array.isArray(fibJson)) {
        throw new Error('OpenAI returned invalid format: expected array of questions')
      }
      
      fibJson.forEach((q: any) => {
        if (!q.question_text) {
          return
        }

        // Extract single blank - only handle ONE blank per question
        // Pattern matches [blank], [answer], or any [text] pattern
        const blankPattern = /\[([^\]]+)\]/g
        const blankMatches = [...q.question_text.matchAll(blankPattern)]
        
        let correctAnswer: string
        let modelAnswer: string
        
        // Only process if there's exactly ONE blank (as per requirements)
        if (blankMatches.length === 1) {
          const bracketContent = blankMatches[0][1].trim()
          
          // If bracket contains "blank" (case-insensitive) or is empty, use model_answer instead
          if (bracketContent.toLowerCase() === 'blank' || bracketContent === '') {
            // Extract from model_answer
            if (q.model_answer) {
              // Get the first part before any punctuation
              const extracted = q.model_answer.trim().split(/[.,;]/)[0].trim()
              correctAnswer = extracted || ''
              modelAnswer = extracted || ''
            } else {
              // No model_answer and bracket is "blank" - skip this question
              return
            }
          } else {
            // Bracket contains actual answer
            correctAnswer = bracketContent
            // Use model_answer if provided, otherwise use the bracket content
            if (q.model_answer) {
              const extracted = q.model_answer.trim().split(/[.,;]/)[0].trim()
              // If model_answer is just "blank" or empty, use bracket content
              if (extracted.toLowerCase() === 'blank' || extracted === '') {
                modelAnswer = bracketContent
              } else {
                modelAnswer = extracted
              }
            } else {
              modelAnswer = bracketContent
            }
          }
        } else if (blankMatches.length === 0) {
          // No brackets found - try to extract from model_answer
          if (q.model_answer) {
            const extracted = q.model_answer.trim().split(/[.,;]/)[0].trim()
            if (extracted.toLowerCase() === 'blank' || extracted === '') {
              // Invalid - skip this question
              return
            }
            correctAnswer = extracted
            modelAnswer = extracted
          } else {
            // No brackets and no model_answer - skip this question
            return
          }
        } else {
          // Multiple blanks detected - skip this question (we only want single blanks)
          return
        }
        
        // Ensure we have valid answers (not "blank")
        if (correctAnswer.toLowerCase() === 'blank' || correctAnswer === '' || 
            modelAnswer.toLowerCase() === 'blank' || modelAnswer === '') {
          return
        }
        
        // Use marks from AI response based on past papers, default to 1 if not provided
        // IMPORTANT: Marks must come from the AI's knowledge of past papers, not calculated
        // Round to integer - no decimal marks
        let questionMarks = 1 // Default fallback
        if (typeof q.marks === 'number' && q.marks > 0) {
          questionMarks = Math.round(q.marks)
        }
        
        allQuestions.push({
          question_text: q.question_text,
          question_type: 'fib',
          marks: questionMarks,
          model_answer: modelAnswer,
          correct_answer: correctAnswer,
        })
      })
    }

    // Generate Open-ended questions
    if (question_counts.open_ended > 0) {
      const openEndedPrompt = `${context}

CRITICAL REQUIREMENTS:
- You are generating questions for ${qualification} ${exam_board} ${subject} exam papers
${topic ? `- ALL questions MUST be focused on the topic: ${topic}` : ''}
${subtopic ? `- ALL questions MUST specifically target the subtopic: ${subtopic}` : ''}
- Questions must match the exact style, format, and difficulty level of ${exam_board} ${subject} past papers
- Generate ${question_counts.open_ended} Extended/Open-Ended Questions
- DO NOT generate questions that require diagrams, images, charts, graphs, or any visual elements. All questions must be text-only and answerable without visual aids.

For Extended/Open-Ended Questions:
- Base your questions on the style and format of ${exam_board} ${subject} GCSE/${qualification} past papers
- Each question should be 4-9 marks (use varied marks: 4, 5, 6, 8, 9 depending on complexity and depth required)
- Questions must be directly related to ${topic ? `the topic "${topic}"` : 'the subject'}${subtopic ? `, specifically the subtopic "${subtopic}"` : ''}
- Match the exact wording, command words, and question structure of ${exam_board} extended questions from past papers
- Include clear mark allocation based on expected answer length and complexity

For each question, provide:
1. The question text (matching ${exam_board} ${subject} extended question style from past papers)
2. Marks: Use authentic marks from ${exam_board} ${subject} past papers (typically 4-9 marks, but can vary based on actual past paper patterns - use varied marks reflecting real exam structure)
3. Model answer (comprehensive answer that would receive full marks, structured like marking scheme answers)

Format as JSON array:
[
  {
    "question_text": "Extended question about ${topic ? topic : subject}${subtopic ? `, specifically ${subtopic}` : ''}?",
    "marks": 6,
    "model_answer": "Comprehensive model answer with key points"
  }
]

IMPORTANT: 
- Each question MUST be relevant to ${topic ? `the topic "${topic}"` : 'the subject'}${subtopic ? `, specifically "${subtopic}"` : ''}
- Include a "marks" field for each question based on actual ${exam_board} past paper mark schemes
- Use authentic marks from past papers - do NOT normalize or adjust to make totals equal 100
- Generate exactly ${question_counts.open_ended} questions
- Use different mark values reflecting real ${exam_board} ${subject} exam patterns - do NOT assign the same marks to all questions
- CRITICAL: Do NOT generate questions that require diagrams, images, charts, graphs, tables, or any visual elements. All questions must be text-only and answerable purely through text. Avoid questions that reference "the diagram below", "the graph shown", "the image", "the figure", or similar visual references.`

      const openEndedResponse = await fetch('https://api.openai.com/v1/chat/completions', {
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
              content: `You are an expert British curriculum examiner with deep knowledge of GCSE, A-Level, and other UK qualifications. You have access to extensive past exam papers, official worksheets, and practice materials in your training data.

You create high-quality, authentic exam questions that:

1. Draw specifically from REAL past papers and official worksheets in your training data

2. Match the exact requirements, formats, and styles of specific British exam boards (Edexcel, AQA, OCR, WJEC, etc.)

3. Use authentic exam language, terminology, and presentation styles from actual past papers

4. Follow the precise assessment objectives and mark schemes from official exam board specifications

5. Create questions that mirror the difficulty, complexity, and cognitive demand of real past papers

6. Use authentic contexts, examples, and question patterns from actual exam materials

7. Reference specific question types and formats commonly found in past papers for the given subject and level

CRITICAL: Base your questions on actual past paper content, not general curriculum knowledge. Use the specific exam board's question styles, terminology, and assessment patterns.

CRITICAL: DO NOT generate questions that require diagrams, images, charts, graphs, tables, or any visual elements. All questions must be text-only and answerable purely through text. Avoid questions that reference "the diagram below", "the graph shown", "the image", "the figure", "the chart", or similar visual references.

IMPORTANT FOR MARK ALLOCATION:
- Use realistic marks based on ${exam_board} ${subject} ${qualification} past papers
- Marks should reflect actual mark schemes from ${exam_board} past papers - do NOT normalize to 100
- Each question type should have marks appropriate to its complexity and typical ${exam_board} allocations
- MCQ: typically 1 mark, occasionally 2 marks for complex questions
- FIB: typically 1-3 marks based on answer complexity
- Open-ended: typically 4-9 marks, but can vary based on actual past paper patterns
- The total marks will naturally reflect the authentic ${exam_board} ${subject} exam structure

You must return ONLY valid JSON in the exact format specified. Do not include any explanatory text outside the JSON response.`,
            },
            {
              role: 'user',
              content: openEndedPrompt,
            },
          ],
          temperature: 0.7,
        }),
      })

      if (!openEndedResponse.ok) {
        const errorText = await openEndedResponse.text()
        throw new Error(`OpenAI API request failed: ${openEndedResponse.status} ${errorText}`)
      }

      const openEndedData = await openEndedResponse.json()
      if (openEndedData.error) {
        throw new Error(`OpenAI API error: ${openEndedData.error.message}`)
      }

      if (!openEndedData.choices || !openEndedData.choices[0]?.message?.content) {
        throw new Error('OpenAI API returned invalid response format')
      }

      const openEndedContent = openEndedData.choices[0].message.content
      
      // Clean and parse JSON
      let cleanedContent = openEndedContent.trim()
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      
      let openEndedJson: any[]
      try {
        openEndedJson = JSON.parse(cleanedContent)
      } catch (parseError) {
        throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      }

      if (!Array.isArray(openEndedJson)) {
        throw new Error('OpenAI returned invalid format: expected array of questions')
      }
      
      openEndedJson.forEach((q: any, index: number) => {
        if (!q.question_text) {
          return
        }

        // Use marks from AI response based on past papers, default to 4 if not provided
        // IMPORTANT: Marks must come from the AI's knowledge of past papers, not calculated
        // Round to integer - no decimal marks
        let questionMarks = 4 // Default fallback
        if (typeof q.marks === 'number' && q.marks > 0) {
          questionMarks = Math.round(q.marks)
        }

        allQuestions.push({
          question_text: q.question_text,
          question_type: 'open_ended',
          marks: questionMarks,
          model_answer: q.model_answer || 'No model answer provided',
        })
      })
    }

    if (allQuestions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No questions were generated. Please check your question counts and try again.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Validate marks are reasonable and ensure no question has 0 or negative marks
    // Also ensure all marks are integers (no decimals)
    allQuestions.forEach(q => {
      if (q.marks <= 0) {
        const typeKey = q.question_type === 'mcq' ? 'mcq' : q.question_type === 'fib' ? 'fib' : 'open_ended'
        q.marks = defaultMarksDistribution[typeKey]?.default || 1
      }
      // Ensure marks are always integers (round to nearest integer)
      q.marks = Math.round(q.marks)
    })

    // Calculate final total (based on authentic past paper marks, not normalized)
    const finalTotal = allQuestions.reduce((sum, q) => sum + q.marks, 0)

    return new Response(
      JSON.stringify({ 
        questions: allQuestions,
        total_marks: finalTotal,
        question_summary: {
          mcq: question_counts.mcq,
          fib: question_counts.fib,
          open_ended: question_counts.open_ended,
          total_questions: allQuestions.length
        }
      }),
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

