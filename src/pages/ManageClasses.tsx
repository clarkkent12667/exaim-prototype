import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { classService, enrollmentService, assignmentService, type Class, type EnrollmentWithStudent, type AssignmentWithExam } from '@/lib/classService'
import { examService, type Exam } from '@/lib/examService'
import { supabase } from '@/lib/supabase'
import Select from 'react-select'
import { Plus, Users, BookOpen, X, Loader2, Trash2, Edit } from 'lucide-react'

export function ManageClasses() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClass, setSelectedClass] = useState<Class | null>(null)
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudent[]>([])
  const [assignments, setAssignments] = useState<AssignmentWithExam[]>([])
  const [availableExams, setAvailableExams] = useState<Exam[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEnrollDialog, setShowEnrollDialog] = useState(false)
  const [showAssignDialog, setShowAssignDialog] = useState(false)
  const [allStudents, setAllStudents] = useState<Array<{ id: string; email: string; full_name: string }>>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  // State for student selection during class creation
  const [selectedStudents, setSelectedStudents] = useState<Array<{ id: string; email: string; full_name: string }>>([])
  const [loadingStudents, setLoadingStudents] = useState(false)

  useEffect(() => {
    if (user) {
      loadClasses()
    }
  }, [user])

  useEffect(() => {
    if (selectedClass) {
      loadClassDetails()
    }
  }, [selectedClass])

  const loadClasses = async () => {
    setLoading(true)
    try {
      const { data, error } = await classService.getByTeacher(user!.id)
      if (error) throw error
      setClasses(data || [])
    } catch (error: any) {
      alert('Error loading classes: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const loadClassDetails = async () => {
    if (!selectedClass) return

    // Load enrollments
    const { data: enrollmentsData } = await enrollmentService.getByClass(selectedClass.id)
    setEnrollments(enrollmentsData || [])

    // Load assignments
    const { data: assignmentsData } = await assignmentService.getByClass(selectedClass.id)
    setAssignments(assignmentsData || [])

    // Load available exams
    const { data: examsData } = await examService.getByTeacher(user!.id)
    setAvailableExams(examsData || [])
  }

  const handleCreateClass = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const description = formData.get('description') as string

    try {
      // Create the class first
      const { data: newClass, error: createError } = await classService.create({
        teacher_id: user!.id,
        name,
        description: description || undefined,
      })
      if (createError) throw createError
      if (!newClass) throw new Error('Failed to create class')

      // Enroll selected students
      if (selectedStudents.length > 0) {
        const enrollmentPromises = selectedStudents.map(student =>
          enrollmentService.enrollStudent(newClass.id, student.id)
        )
        const enrollmentResults = await Promise.allSettled(enrollmentPromises)
        
        // Check for any errors (but don't fail if some students couldn't be enrolled)
        const errors = enrollmentResults
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map(result => result.reason)
        
        if (errors.length > 0) {
          console.warn('Some students could not be enrolled:', errors)
        }
      }

      // Reset form state
      setShowCreateDialog(false)
      setSelectedStudents([])
      loadClasses()
    } catch (error: any) {
      alert('Error creating class: ' + error.message)
    }
  }

  const handleDeleteClass = async (classId: string) => {
    if (!confirm('Are you sure you want to delete this class? This will remove all enrollments and assignments.')) {
      return
    }

    try {
      const { error } = await classService.delete(classId)
      if (error) throw error
      if (selectedClass?.id === classId) {
        setSelectedClass(null)
      }
      loadClasses()
    } catch (error: any) {
      alert('Error deleting class: ' + error.message)
    }
  }

  const loadAllStudents = async () => {
    setLoadingStudents(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('role', 'student')
        .order('full_name', { ascending: true })

      if (error) throw error
      setAllStudents(data || [])
    } catch (error: any) {
      alert('Error loading students: ' + error.message)
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleAddStudentToSelection = (student: { id: string; email: string; full_name: string }) => {
    if (!selectedStudents.some(s => s.id === student.id)) {
      setSelectedStudents([...selectedStudents, student])
    }
  }

  const handleRemoveStudentFromSelection = (studentId: string) => {
    setSelectedStudents(selectedStudents.filter(s => s.id !== studentId))
  }

  const handleEnrollStudent = async () => {
    if (!selectedClass || !selectedStudentId) return

    try {
      const { error } = await enrollmentService.enrollStudent(selectedClass.id, selectedStudentId)
      if (error) throw error
      setShowEnrollDialog(false)
      setSelectedStudentId(null)
      loadClassDetails()
    } catch (error: any) {
      if ((error as any).code === '23505') {
        alert('Student is already enrolled in this class')
      } else {
        alert('Error enrolling student: ' + error.message)
      }
    }
  }

  const handleRemoveStudent = async (studentId: string) => {
    if (!selectedClass) return

    try {
      const { error } = await enrollmentService.removeStudent(selectedClass.id, studentId)
      if (error) throw error
      loadClassDetails()
    } catch (error: any) {
      alert('Error removing student: ' + error.message)
    }
  }

  const handleAssignExam = async (examId: string, dueDate?: string) => {
    if (!selectedClass) return

    try {
      const { error } = await assignmentService.assignExam({
        class_id: selectedClass.id,
        exam_id: examId,
        assigned_by: user!.id,
        due_date: dueDate || undefined,
        is_active: true,
      })
      if (error) throw error
      setShowAssignDialog(false)
      loadClassDetails()
    } catch (error: any) {
      if ((error as any).code === '23505') {
        alert('Exam is already assigned to this class')
      } else if ((error as any).code === 'UNPUBLISHED_EXAM') {
        alert('Cannot assign unpublished exam. Please publish the exam first.')
      } else {
        alert('Error assigning exam: ' + error.message)
      }
    }
  }

  const handleUnassignExam = async (examId: string) => {
    if (!selectedClass) return

    try {
      const { error } = await assignmentService.unassignExam(selectedClass.id, examId)
      if (error) throw error
      loadClassDetails()
    } catch (error: any) {
      alert('Error unassigning exam: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">Manage Classes</h1>
            <p className="text-muted-foreground text-lg">Create and manage your classes</p>
          </div>
          <Dialog 
            open={showCreateDialog} 
            onOpenChange={(open) => {
              setShowCreateDialog(open)
              if (open) {
                loadAllStudents()
              } else {
                setSelectedStudents([])
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Class
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Class</DialogTitle>
                <DialogDescription>Create a new class to organize your students and exams</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div>
                  <Label htmlFor="name">Class Name *</Label>
                  <Input id="name" name="name" required placeholder="e.g., Math 101" />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" placeholder="Optional description" />
                </div>
                
                {/* Student Selection Section */}
                <div className="space-y-3">
                  <div>
                    <Label>Add Students (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Select existing students to add to this class
                    </p>
                    {loadingStudents ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading students...</span>
                      </div>
                    ) : (
                      <Select
                        options={allStudents
                          .filter(student => !selectedStudents.some(s => s.id === student.id))
                          .map(student => ({
                            value: student.id,
                            label: `${student.full_name || 'No name'} (${student.email})`
                          }))}
                        value={null}
                        onChange={(option) => {
                          if (option) {
                            const student = allStudents.find(s => s.id === option.value)
                            if (student) {
                              handleAddStudentToSelection(student)
                            }
                          }
                        }}
                        placeholder="Select students to add..."
                        isSearchable
                        isClearable
                      />
                    )}

                    {/* Selected Students */}
                    {selectedStudents.length > 0 && (
                      <div className="space-y-2 mt-4">
                        <Label>Selected Students ({selectedStudents.length})</Label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-2">
                          {selectedStudents.map((student) => (
                            <div
                              key={student.id}
                              className="flex items-center justify-between p-2 border rounded-lg bg-accent/50"
                            >
                              <div>
                                <div className="font-medium text-sm">{student.full_name || 'No name'}</div>
                                <div className="text-xs text-muted-foreground">{student.email}</div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleRemoveStudentFromSelection(student.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setShowCreateDialog(false)
                      setSelectedStudents([])
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create Class</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Classes List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>My Classes ({classes.length})</CardTitle>
              <CardDescription>Select a class to manage</CardDescription>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <p className="text-muted-foreground text-sm">No classes yet. Create your first class!</p>
              ) : (
                <div className="space-y-2">
                  {classes.map((cls) => (
                    <Card
                      key={cls.id}
                      className={`cursor-pointer hover:bg-accent transition-colors ${
                        selectedClass?.id === cls.id ? 'bg-accent border-primary' : ''
                      }`}
                      onClick={() => setSelectedClass(cls)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{cls.name}</h3>
                            {cls.description && (
                              <p className="text-sm text-muted-foreground mt-1">{cls.description}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClass(cls.id)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Class Details */}
        <div className="lg:col-span-2">
          {!selectedClass ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a class to view and manage details
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Class Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedClass.name}</CardTitle>
                      {selectedClass.description && (
                        <CardDescription className="mt-1">{selectedClass.description}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Students Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Students ({enrollments.length})
                      </CardTitle>
                      <CardDescription>Manage student enrollments</CardDescription>
                    </div>
                    <Dialog 
                      open={showEnrollDialog} 
                      onOpenChange={(open) => {
                        setShowEnrollDialog(open)
                        if (open) {
                          loadAllStudents()
                        } else {
                          setSelectedStudentId(null)
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Student
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Enroll Student</DialogTitle>
                          <DialogDescription>Select a student to add to this class</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="student-select">Select Student</Label>
                            {loadingStudents ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="ml-2 text-sm text-muted-foreground">Loading students...</span>
                              </div>
                            ) : (
                              <Select
                                id="student-select"
                                options={allStudents
                                  .filter(student => !enrollments.some(e => e.student_id === student.id))
                                  .map(student => ({
                                    value: student.id,
                                    label: `${student.full_name || 'No name'} (${student.email})`
                                  }))}
                                value={selectedStudentId ? {
                                  value: selectedStudentId,
                                  label: allStudents.find(s => s.id === selectedStudentId) 
                                    ? `${allStudents.find(s => s.id === selectedStudentId)?.full_name || 'No name'} (${allStudents.find(s => s.id === selectedStudentId)?.email})`
                                    : ''
                                } : null}
                                onChange={(option) => setSelectedStudentId(option?.value || null)}
                                placeholder="Select a student..."
                                isSearchable
                                isClearable
                              />
                            )}
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setShowEnrollDialog(false)
                                setSelectedStudentId(null)
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleEnrollStudent}
                              disabled={!selectedStudentId || loadingStudents}
                            >
                              Add Student
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {enrollments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No students enrolled yet</p>
                  ) : (
                    <div className="space-y-2">
                      {enrollments.map((enrollment) => (
                        <div
                          key={enrollment.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{enrollment.student_name}</div>
                            <div className="text-sm text-muted-foreground">{enrollment.student_email}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveStudent(enrollment.student_id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Exams Section */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Assigned Exams ({assignments.length})
                      </CardTitle>
                      <CardDescription>Manage exam assignments</CardDescription>
                    </div>
                    <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Assign Exam
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Exam to Class</DialogTitle>
                          <DialogDescription>Select an exam to assign to this class</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          {availableExams.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No exams available. Create an exam first.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                              {availableExams
                                .filter(exam => !assignments.some(a => a.exam_id === exam.id))
                                .map((exam) => (
                                  <Card
                                    key={exam.id}
                                    className="cursor-pointer hover:bg-accent"
                                    onClick={() => handleAssignExam(exam.id)}
                                  >
                                    <CardContent className="p-3">
                                      <div className="font-medium">{exam.title}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {exam.total_marks} marks
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {assignments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No exams assigned yet</p>
                  ) : (
                    <div className="space-y-2">
                      {assignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <div className="font-medium">{assignment.exam_title}</div>
                            {assignment.due_date && (
                              <div className="text-sm text-muted-foreground">
                                Due: {new Date(assignment.due_date).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleUnassignExam(assignment.exam_id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


