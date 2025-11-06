import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { topicService, subjectService, type Topic, type Subject } from '@/lib/qualificationService'
import { qualificationService, examBoardService, type Qualification, type ExamBoard } from '@/lib/qualificationService'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import Select from 'react-select'

export function TopicManager() {
  const [topics, setTopics] = useState<(Topic & { subject_name?: string })[]>([])
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Topic | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', subject_id: '' })
  const [selectedQualification, setSelectedQualification] = useState<string>('')
  const [selectedExamBoard, setSelectedExamBoard] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    const { data } = await qualificationService.getAll()
    if (data) setQualifications(data)
    await loadAllTopics()
    setLoading(false)
  }

  const loadExamBoards = async (qualificationId: string) => {
    const { data } = await examBoardService.getByQualification(qualificationId)
    if (data) setExamBoards(data)
  }

  const loadSubjects = async (examBoardId: string) => {
    const { data } = await subjectService.getByExamBoard(examBoardId)
    if (data) setSubjects(data)
  }

  const loadAllTopics = async () => {
    setLoading(true)
    // Fetch all data in parallel - much faster!
    const [topicsResult, subjectsResult] = await Promise.all([
      topicService.getAll(),
      subjectService.getAll()
    ])
    
    if (!topicsResult.data || !subjectsResult.data) {
      setLoading(false)
      return
    }

    // Create map for quick lookup
    const subjectMap = new Map(subjectsResult.data.map(s => [s.id, s]))
    
    // Map subject names to topics
    const allTopics: (Topic & { subject_name?: string })[] = 
      topicsResult.data.map(t => ({
        ...t,
        subject_name: subjectMap.get(t.subject_id)?.name
      }))

    setTopics(allTopics)
    setLoading(false)
  }


  const handleCreate = () => {
    setEditing(null)
    setFormData({ name: '', subject_id: '' })
    setSelectedQualification('')
    setSelectedExamBoard('')
    setSelectedSubject('')
    setIsDialogOpen(true)
  }

  const handleEdit = async (topic: Topic) => {
    setEditing(topic)
    setFormData({ name: topic.name, subject_id: topic.subject_id })
    
    // Load the topic's subject hierarchy to populate dropdowns
    const { data: allQuals } = await qualificationService.getAll()
    if (allQuals) {
      for (const qual of allQuals) {
        const { data: boards } = await examBoardService.getByQualification(qual.id)
        if (boards) {
          for (const board of boards) {
            const { data: subjectsData } = await subjectService.getByExamBoard(board.id)
            if (subjectsData?.some(s => s.id === topic.subject_id)) {
              // Found the subject, load its hierarchy
              setSelectedQualification(qual.id)
              await loadExamBoards(qual.id)
              setSelectedExamBoard(board.id)
              await loadSubjects(board.id)
              setSelectedSubject(topic.subject_id)
              break
            }
          }
        }
      }
    }
    
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.subject_id) return

    if (editing) {
      const { error } = await topicService.update(editing.id, formData)
      if (!error) {
        await loadAllTopics()
        setIsDialogOpen(false)
      }
    } else {
      const { error } = await topicService.create(formData)
      if (!error) {
        await loadAllTopics()
        setIsDialogOpen(false)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this topic?')) return
    const { error } = await topicService.delete(id)
    if (!error) {
      await loadAllTopics()
    }
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Topics</CardTitle>
            <CardDescription>Manage topics by subject</CardDescription>
          </div>
          <div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Topic
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {topics.length === 0 ? (
              <p className="text-muted-foreground">No topics found</p>
            ) : (
              topics.map((topic) => (
                <div
                  key={topic.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{topic.name}</p>
                    {topic.subject_name && (
                      <p className="text-sm text-muted-foreground">Subject: {topic.subject_name}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(topic)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(topic.id)}
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
              {editing ? 'Edit Topic' : 'Create Topic'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Update the topic details' : 'Add a new topic'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!editing && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification *</Label>
                  <Select
                    id="qualification"
                    options={qualifications.map(q => ({ value: q.id, label: q.name }))}
                    value={selectedQualification ? { value: selectedQualification, label: qualifications.find(q => q.id === selectedQualification)?.name || '' } : null}
                    onChange={async (option) => {
                      const qualId = option?.value || ''
                      setSelectedQualification(qualId)
                      setSelectedExamBoard('')
                      setSelectedSubject('')
                      setFormData({ ...formData, subject_id: '' })
                      if (qualId) {
                        await loadExamBoards(qualId)
                      } else {
                        setExamBoards([])
                      }
                    }}
                  />
                </div>
                {selectedQualification && (
                  <div className="space-y-2">
                    <Label htmlFor="exam_board">Exam Board *</Label>
                    <Select
                      id="exam_board"
                      options={examBoards.map(b => ({ value: b.id, label: b.name }))}
                      value={selectedExamBoard ? { value: selectedExamBoard, label: examBoards.find(b => b.id === selectedExamBoard)?.name || '' } : null}
                      onChange={async (option) => {
                        const boardId = option?.value || ''
                        setSelectedExamBoard(boardId)
                        setSelectedSubject('')
                        setFormData({ ...formData, subject_id: '' })
                        if (boardId) {
                          await loadSubjects(boardId)
                        } else {
                          setSubjects([])
                        }
                      }}
                    />
                  </div>
                )}
                {selectedExamBoard && (
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject *</Label>
                    <Select
                      id="subject"
                      options={subjects.map(s => ({ value: s.id, label: s.name }))}
                      value={formData.subject_id ? { value: formData.subject_id, label: subjects.find(s => s.id === formData.subject_id)?.name || '' } : null}
                      onChange={(option) => setFormData({ ...formData, subject_id: option?.value || '' })}
                    />
                  </div>
                )}
              </>
            )}
            {editing && (
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Select
                  id="subject"
                  options={subjects.map(s => ({ value: s.id, label: s.name }))}
                  value={formData.subject_id ? { value: formData.subject_id, label: subjects.find(s => s.id === formData.subject_id)?.name || '' } : null}
                  onChange={(option) => setFormData({ ...formData, subject_id: option?.value || '' })}
                  isDisabled={true}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Algebra, Geometry"
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

