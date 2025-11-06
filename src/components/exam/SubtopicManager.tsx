import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { subtopicService, topicService, subjectService, type Subtopic, type Topic, type Subject } from '@/lib/qualificationService'
import { qualificationService, examBoardService, type Qualification, type ExamBoard } from '@/lib/qualificationService'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import Select from 'react-select'

export function SubtopicManager() {
  const [subtopics, setSubtopics] = useState<(Subtopic & { topic_name?: string; subject_name?: string })[]>([])
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [examBoards, setExamBoards] = useState<ExamBoard[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Subtopic | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', topic_id: '' })
  const [selectedQualification, setSelectedQualification] = useState<string>('')
  const [selectedExamBoard, setSelectedExamBoard] = useState<string>('')
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    setLoading(true)
    const { data } = await qualificationService.getAll()
    if (data) setQualifications(data)
    await loadAllSubtopics()
    setLoading(false)
  }

  const loadAllSubtopics = async () => {
    setLoading(true)
    // Fetch all data in parallel - much faster!
    const [subtopicsResult, topicsResult, subjectsResult] = await Promise.all([
      subtopicService.getAll(),
      topicService.getAll(),
      subjectService.getAll()
    ])
    
    if (!subtopicsResult.data || !topicsResult.data || !subjectsResult.data) {
      setLoading(false)
      return
    }

    // Create maps for quick lookup
    const topicMap = new Map(topicsResult.data.map(t => [t.id, t]))
    const subjectMap = new Map(subjectsResult.data.map(s => [s.id, s]))
    
    // Map related data to subtopics
    const allSubtopics: (Subtopic & { topic_name?: string; subject_name?: string })[] = 
      subtopicsResult.data.map(s => {
        const topic = topicMap.get(s.topic_id)
        const subject = topic ? subjectMap.get(topic.subject_id) : undefined
        return {
          ...s,
          topic_name: topic?.name,
          subject_name: subject?.name
        }
      })

    setSubtopics(allSubtopics)
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

  const loadTopics = async (subjectId: string) => {
    const { data } = await topicService.getBySubject(subjectId)
    if (data) setTopics(data)
  }


  const handleCreate = () => {
    setEditing(null)
    setFormData({ name: '', topic_id: '' })
    setSelectedQualification('')
    setSelectedExamBoard('')
    setSelectedSubject('')
    setSelectedTopic('')
    setIsDialogOpen(true)
  }

  const handleEdit = async (subtopic: Subtopic) => {
    setEditing(subtopic)
    setFormData({ name: subtopic.name, topic_id: subtopic.topic_id })
    
    // Load the topic's subject to populate topics dropdown
    const { data: allQuals } = await qualificationService.getAll()
    if (allQuals) {
      for (const qual of allQuals) {
        const { data: boards } = await examBoardService.getByQualification(qual.id)
        if (boards) {
          for (const board of boards) {
            const { data: subjectsData } = await subjectService.getByExamBoard(board.id)
            if (subjectsData) {
              for (const subject of subjectsData) {
                const { data: topicsData } = await topicService.getBySubject(subject.id)
                if (topicsData?.some(t => t.id === subtopic.topic_id)) {
                  // Found the topic, load its subject's topics
                  setSubjects(subjectsData)
                  setTopics(topicsData)
                  break
                }
              }
            }
          }
        }
      }
    }
    
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.topic_id) return

    if (editing) {
      const { error } = await subtopicService.update(editing.id, formData)
      if (!error) {
        await loadAllSubtopics()
        setIsDialogOpen(false)
      }
    } else {
      const { error } = await subtopicService.create(formData)
      if (!error) {
        await loadAllSubtopics()
        setIsDialogOpen(false)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this subtopic?')) return
    const { error } = await subtopicService.delete(id)
    if (!error) {
      await loadAllSubtopics()
    }
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Subtopics</CardTitle>
            <CardDescription>Manage subtopics by topic</CardDescription>
          </div>
          <div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Subtopic
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {subtopics.length === 0 ? (
              <p className="text-muted-foreground">No subtopics found</p>
            ) : (
              subtopics.map((subtopic) => (
                <div
                  key={subtopic.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{subtopic.name}</p>
                    {(subtopic.topic_name || subtopic.subject_name) && (
                      <p className="text-sm text-muted-foreground">
                        Topic: {subtopic.topic_name}
                        {subtopic.subject_name && ` • Subject: ${subtopic.subject_name}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(subtopic)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(subtopic.id)}
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
              {editing ? 'Edit Subtopic' : 'Create Subtopic'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Update the subtopic details' : 'Add a new subtopic'}
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
                      setSelectedTopic('')
                      setFormData({ ...formData, topic_id: '' })
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
                        setSelectedTopic('')
                        setFormData({ ...formData, topic_id: '' })
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
                      value={selectedSubject ? { value: selectedSubject, label: subjects.find(s => s.id === selectedSubject)?.name || '' } : null}
                      onChange={async (option) => {
                        const subjectId = option?.value || ''
                        setSelectedSubject(subjectId)
                        setSelectedTopic('')
                        setFormData({ ...formData, topic_id: '' })
                        if (subjectId) {
                          await loadTopics(subjectId)
                        } else {
                          setTopics([])
                        }
                      }}
                    />
                  </div>
                )}
                {selectedSubject && (
                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic *</Label>
                    <Select
                      id="topic"
                      options={topics.map(t => ({ value: t.id, label: t.name }))}
                      value={formData.topic_id ? { value: formData.topic_id, label: topics.find(t => t.id === formData.topic_id)?.name || '' } : null}
                      onChange={(option) => setFormData({ ...formData, topic_id: option?.value || '' })}
                    />
                  </div>
                )}
              </>
            )}
            {editing && (
              <div className="space-y-2">
                <Label htmlFor="topic">Topic *</Label>
                <Select
                  id="topic"
                  options={topics.map(t => ({ value: t.id, label: t.name }))}
                  value={formData.topic_id ? { value: formData.topic_id, label: topics.find(t => t.id === formData.topic_id)?.name || '' } : null}
                  onChange={(option) => setFormData({ ...formData, topic_id: option?.value || '' })}
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
                placeholder="e.g., Linear Equations, Quadratic Functions"
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

