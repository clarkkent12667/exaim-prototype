import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { examBoardService, type ExamBoard } from '@/lib/qualificationService'
import { qualificationService, type Qualification } from '@/lib/qualificationService'
import { Plus, Trash2, Edit2 } from 'lucide-react'
import Select from 'react-select'

export function ExamBoardManager() {
  const [examBoards, setExamBoards] = useState<(ExamBoard & { qualification_name?: string })[]>([])
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ExamBoard | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', qualification_id: '' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    const qualRes = await qualificationService.getAll()
    if (!qualRes.error && qualRes.data) {
      setQualifications(qualRes.data)
    }
    await loadAllExamBoards()
    setLoading(false)
  }

  const loadAllExamBoards = async () => {
    // Fetch all exam boards and qualifications in parallel
    const [boardsResult, qualsResult] = await Promise.all([
      examBoardService.getAll(),
      qualificationService.getAll()
    ])
    
    if (!boardsResult.data || !qualsResult.data) return
    
    // Map qualification names to exam boards
    const qualMap = new Map(qualsResult.data.map(q => [q.id, q.name]))
    const allBoards: (ExamBoard & { qualification_name?: string })[] = boardsResult.data.map(b => ({
      ...b,
      qualification_name: qualMap.get(b.qualification_id)
    }))
    
    setExamBoards(allBoards)
  }

  const loadExamBoards = async (qualificationId: string) => {
    const { data, error } = await examBoardService.getByQualification(qualificationId)
    if (!error && data) {
      const qual = qualifications.find(q => q.id === qualificationId)
      setExamBoards(data.map(b => ({ ...b, qualification_name: qual?.name })))
    }
  }

  const handleCreate = () => {
    setEditing(null)
    setFormData({ name: '', qualification_id: '' })
    setIsDialogOpen(true)
  }

  const handleEdit = (examBoard: ExamBoard) => {
    setEditing(examBoard)
    setFormData({ name: examBoard.name, qualification_id: examBoard.qualification_id })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.qualification_id) return

    if (editing) {
      const { error } = await examBoardService.update(editing.id, formData)
      if (!error) {
        await loadAllExamBoards()
        setIsDialogOpen(false)
      }
    } else {
      const { error } = await examBoardService.create(formData)
      if (!error) {
        await loadAllExamBoards()
        setIsDialogOpen(false)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this exam board?')) return
    const { error } = await examBoardService.delete(id)
    if (!error) {
      await loadAllExamBoards()
    }
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Exam Boards</CardTitle>
            <CardDescription>Manage exam boards by qualification</CardDescription>
          </div>
          <div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Exam Board
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {examBoards.length === 0 ? (
              <p className="text-muted-foreground">No exam boards found</p>
            ) : (
              examBoards.map((board) => (
                <div
                  key={board.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{board.name}</p>
                    {board.qualification_name && (
                      <p className="text-sm text-muted-foreground">Qualification: {board.qualification_name}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(board)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(board.id)}
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
              {editing ? 'Edit Exam Board' : 'Create Exam Board'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Update the exam board details' : 'Add a new exam board'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="qualification">Qualification *</Label>
              <Select
                id="qualification"
                options={qualifications.map(q => ({ value: q.id, label: q.name }))}
                value={formData.qualification_id ? { value: formData.qualification_id, label: qualifications.find(q => q.id === formData.qualification_id)?.name || '' } : null}
                onChange={(option) => setFormData({ ...formData, qualification_id: option?.value || '' })}
                isDisabled={!!editing}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., AQA, Edexcel, OCR"
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

