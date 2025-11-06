# Question Generation Unit Tests

This directory contains comprehensive unit tests for the GCSE exam question generation functionality.

## Test Coverage

The test suite covers:

### 1. Request Validation
- ✅ Valid GCSE requests
- ✅ Missing required fields (qualification, exam_board, subject)
- ✅ Invalid difficulty levels
- ✅ Invalid question counts

### 2. Context Building
- ✅ Building context without topic/subtopic
- ✅ Building context with topic
- ✅ Building context with topic and subtopic
- ✅ GCSE-specific context formatting

### 3. Marks Calculation
- ✅ Even distribution of marks across question types
- ✅ Handling zero questions
- ✅ Rounding marks correctly for different question counts

### 4. Question Processing
- ✅ MCQ question processing and validation
- ✅ Fill-in-the-blank (FIB) question processing
- ✅ Open-ended question processing
- ✅ Handling invalid questions gracefully
- ✅ Correct answer extraction from different formats

### 5. Prompt Building
- ✅ MCQ prompt generation
- ✅ FIB prompt generation
- ✅ Open-ended prompt generation
- ✅ GCSE-specific formatting

### 6. Question Validation
- ✅ Validating all question types
- ✅ Rejecting invalid question structures
- ✅ Ensuring required fields are present

### 7. GCSE-Specific Integration Tests
- ✅ Complete exam generation with all question types
- ✅ Topic and subtopic handling
- ✅ Multiple exam boards (AQA, Edexcel, OCR, WJEC)
- ✅ Different difficulty levels (easy, medium, hard)

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Test Structure

Tests are organized by functionality:
- `validateRequest` - Request validation tests
- `buildContext` - Context building tests
- `calculateMarks` - Marks calculation tests
- `parseOpenAIResponse` - JSON parsing tests
- `processMCQQuestions` - MCQ processing tests
- `processFIBQuestions` - FIB processing tests
- `processOpenEndedQuestions` - Open-ended processing tests
- `buildPrompts` - Prompt generation tests
- `validateGeneratedQuestion` - Question validation tests
- `GCSE-specific integration tests` - End-to-end GCSE scenarios

## Test Data

The tests use realistic GCSE exam data:
- **Qualifications**: GCSE
- **Exam Boards**: AQA, Edexcel, OCR, WJEC
- **Subjects**: Mathematics, Physics, Chemistry
- **Topics**: Algebra, Mechanics, etc.
- **Subtopics**: Linear Equations, Forces, etc.

## Notes

- All tests mock external dependencies (OpenAI API)
- Tests validate both success and error cases
- Invalid data is handled gracefully with appropriate warnings
- All question types are thoroughly tested





