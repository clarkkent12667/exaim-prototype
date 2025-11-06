import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { subjectService, type Subject } from '@/lib/qualificationService'
import { qualificationService, examBoardService, type Qualification, type ExamBoard } from '@/lib/qualificationService'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import Select from 'react-select'

export function SubjectManager() {
  const [subjects, setSubjects] = useState<(Subject & { exam_board_name?: string; qualification_name?: string })[]>([])
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', exam_board_id: '' })
  const [selectedQualification, setSelectedQualification] = useState<string>('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const qualRes = await qualificationService.getAll()
    if (!qualRes.error && qualRes.data) {
      setQualifications(qualRes.data)
    }
    await loadAllSubjects()
    setLoading(false)
  }

  const loadAllSubjects = async () => {
    setLoading(true)
    // Fetch all data in parallel - much faster!
    const [subjectsResult, boardsResult, qualsResult] = await Promise.all([
      subjectService.getAll(),
      examBoardService.getAll(),
      qualificationService.getAll()
    ])
    
    if (!subjectsResult.data || !boardsResult.data || !qualsResult.data) {
      setLoading(false)
      return
    }

    // Create maps for quick lookup
    const boardMap = new Map(boardsResult.data.map(b => [b.id, b]))
    const qualMap = new Map(qualsResult.data.map(q => [q.id, q.name]))
    
    // Map related data to subjects
    const allSubjects: (Subject & { exam_board_name?: string; qualification_name?: string })[] = 
      subjectsResult.data.map(s => {
        const board = boardMap.get(s.exam_board_id)
        const qualName = board ? qualMap.get(board.qualification_id) : undefined
        return {
          ...s,
          exam_board_name: board?.name,
          qualification_name: qualName
        }
      })

    setSubjects(allSubjects)
    setLoading(false)
  }

  const loadExamBoards = async (qualificationId: string) => {
    const { data } = await examBoardService.getByQualification(qualificationId)
    if (data) setExamBoards(data)
  }

  const handleCreate = () => {
    setEditing(null)
    setFormData({ name: '', exam_board_id: '' })
    setIsDialogOpen(true)
  }

  const handleEdit = (subject: Subject) => {
    setEditing(subject)
    setFormData({ name: subject.name, exam_board_id: subject.exam_board_id })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.exam_board_id) return

    if (editing) {
      const { error } = await subjectService.update(editing.id, formData)
      if (!error) {
        await loadAllSubjects()
        setIsDialogOpen(false)
      }
    } else {
      const { error } = await subjectService.create(formData)
      if (!error) {
        await loadAllSubjects()
        setIsDialogOpen(false)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subject?')) return
    const { error } = await subjectService.delete(id)
    if (!error) {
      await loadAllSubjects()
    }
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subjects</CardTitle>
            <CardDescription>Manage subjects by exam board</CardDescription>
          </div>
          <div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subject
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {subjects.length === 0 ? (
              <p className="text-muted-foreground">No subjects found</p>
            ) : (
              subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{subject.name}</p>
                    {(subject.exam_board_name || subject.qualification_name) && (
                      <p className="text-sm text-muted-foreground">
                        {subject.exam_board_name}
                        {subject.qualification_name && ` • ${subject.qualification_name}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(subject)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(subject.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Subject' : 'Create Subject'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Update the subject details' : 'Add a new subject'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editing && (
              <div className="space-y-2">
                <Label htmlFor="qualification">Qualification *</Label>
                <Select
                  id="qualification"
                  options={qualifications.map(q => ({ value: q.id, label: q.name }))}
                  value={selectedQualification ? { value: selectedQualification, label: qualifications.find(q => q.id === selectedQualification)?.name || '' } : null}
                  onChange={async (option) => {
                    const qualId = option?.value || ''
                    setSelectedQualification(qualId)
                    setFormData({ ...formData, exam_board_id: '' })
                    if (qualId) {
                      await loadExamBoards(qualId)
                    } else {
                      setExamBoards([])
                    }
                  }}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="exam_board">Exam Board *</Label>
              <Select
                id="exam_board"
                options={examBoards.map(b => ({ value: b.id, label: b.name }))}
                value={formData.exam_board_id ? { value: formData.exam_board_id, label: examBoards.find(b => b.id === formData.exam_board_id)?.name || '' } : null}
                onChange={(option) => setFormData({ ...formData, exam_board_id: option?.value || '' })}
                isDisabled={!!editing || !selectedQualification}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Mathematics, English"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
  )
}

