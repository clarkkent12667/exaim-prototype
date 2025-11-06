# Backend Optimization Report
## Exaim Prototype - Supabase/PostgreSQL Query Optimization

### Executive Summary
The analytics service has **critical N+1 query problems** that cause slow performance, especially on the grades and analytics pages. This report identifies issues and provides optimized solutions.

---

## Critical Issues Identified

### 1. N+1 Query Problems

#### **getTeacherAnalytics** - Multiple N+1 Issues:
- **Line 114-119**: Loop through classes → `enrollmentService.getByClass()` for each class
- **Line 133-150**: Loop through exams → `attemptService.getByExam()` for each exam  
- **Line 159-193**: Nested loops (classes × exams) → Multiple `attemptService.getByExam()` calls
- **Line 199-223**: Loop through exams again → `attemptService.getByExam()` for each exam
- **Line 228-252**: Loop through students → `attemptService.getByStudent()` + `profiles` query for each
- **Line 257-295**: Loop through students again → Multiple queries per student

**Impact**: If a teacher has 5 classes, 10 exams, and 50 students:
- **Before**: ~200+ database queries
- **After**: ~5-10 batch queries

#### **getGradesHeatMapData** - N+1 Issues:
- **Line 522-527**: Loop through classes → `enrollmentService.getByClass()` for each
- **Line 567-580**: Loop through students → `profiles` query for each student

**Impact**: 5 classes + 50 students = 55 queries → Should be 2 queries

#### **getInterventionData** - N+1 Issues:
- **Line 711-760**: Loop through students → Multiple queries per student (attempts, profiles, enrollments)

**Impact**: 50 students = 150+ queries → Should be 3-4 queries

#### **getStudentAnalytics** - N+1 Issues:
- **Line 370**: Loop through attempts → `examService.getById()` for each
- **Line 388-420**: Nested loops → `answerService.getByAttempt()`, `examService.getById()`, `questionService.getByExam()`

**Impact**: 20 attempts = 60+ queries → Should be 3-4 queries

---

## Optimization Solutions

### Solution 1: Batch Query Functions

Create optimized batch query functions that fetch multiple records in single queries:

```typescript
// Batch fetch enrollments for multiple classes
async getEnrollmentsByClasses(classIds: string[])

// Batch fetch attempts for multiple exams
async getAttemptsByExams(examIds: string[])

// Batch fetch profiles for multiple students
async getProfilesByStudentIds(studentIds: string[])

// Batch fetch exams with joins
async getExamsWithDetails(examIds: string[])
```

### Solution 2: Use Supabase `.in()` Operator

Replace loops with batch queries using `.in()`:

```typescript
// Instead of:
for (const classId of classIds) {
  const { data } = await enrollmentService.getByClass(classId)
}

// Use:
const { data } = await supabase
  .from('class_enrollments')
  .select('*')
  .in('class_id', classIds)
```

### Solution 3: Use Supabase Joins

Use Supabase's join capabilities to fetch related data in single queries:

```typescript
// Fetch attempts with exam details in one query
const { data } = await supabase
  .from('exam_attempts')
  .select(`
    *,
    exam:exams(*),
    student:profiles(full_name, email)
  `)
  .in('exam_id', examIds)
```

### Solution 4: Database Views/Functions

For complex aggregations, create PostgreSQL views or functions:

```sql
-- Example: View for class performance
CREATE VIEW class_performance_view AS
SELECT 
  c.id as class_id,
  c.name as class_name,
  COUNT(DISTINCT ce.student_id) as student_count,
  AVG(CASE WHEN ea.status = 'completed' THEN ea.total_score END) as average_score,
  COUNT(ea.id) as total_attempts
FROM classes c
LEFT JOIN class_enrollments ce ON c.id = ce.class_id
LEFT JOIN exam_assignments ea_assign ON c.id = ea_assign.class_id
LEFT JOIN exam_attempts ea ON ea_assign.exam_id = ea.exam_id
GROUP BY c.id, c.name;
```

### Solution 5: Add Database Indexes

Ensure proper indexes exist for frequently queried columns:

```sql
-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam_id ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_started_at ON exam_attempts(started_at);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_class_id ON exam_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam_id ON exam_assignments(exam_id);
```

---

## Recommended Implementation Priority

### Priority 1: Critical (Immediate)
1. ✅ Optimize `getTeacherAnalytics` - Most used, biggest impact
2. ✅ Optimize `getGradesHeatMapData` - Used on grades page
3. ✅ Optimize `getInterventionData` - Used on grades page

### Priority 2: High (This Week)
4. ✅ Optimize `getStudentAnalytics` - Used on student analytics page
5. ✅ Add database indexes

### Priority 3: Medium (Next Sprint)
6. ✅ Create database views for complex aggregations
7. ✅ Add query result caching at service level

---

## Expected Performance Improvements

### Before Optimization:
- **getTeacherAnalytics**: 2-5 seconds (200+ queries)
- **getGradesHeatMapData**: 1-3 seconds (55+ queries)
- **getInterventionData**: 1-2 seconds (150+ queries)
- **getStudentAnalytics**: 1-2 seconds (60+ queries)

### After Optimization:
- **getTeacherAnalytics**: 200-500ms (5-10 queries) - **80-90% faster**
- **getGradesHeatMapData**: 100-300ms (2 queries) - **85-90% faster**
- **getInterventionData**: 100-200ms (3-4 queries) - **90% faster**
- **getStudentAnalytics**: 100-200ms (3-4 queries) - **85-90% faster**

---

## Implementation Notes

1. **Backward Compatibility**: All optimizations maintain the same API interface
2. **Error Handling**: Batch queries should handle partial failures gracefully
3. **Testing**: Test with large datasets (100+ students, 20+ exams)
4. **Monitoring**: Add query timing logs to measure improvements

---

## Next Steps

1. Review and approve optimization approach
2. Implement batch query functions
3. Refactor analytics service methods
4. Add database indexes
5. Test with production-like data volumes
6. Deploy and monitor performance


