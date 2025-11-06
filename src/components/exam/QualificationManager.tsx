import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { qualificationService, type Qualification } from '@/lib/qualificationService'
import { Plus, Trash2, Edit2 } from 'lucide-react'

export function QualificationManager() {
  const [qualifications, setQualifications] = useState<Qualification[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Qualification | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formData, setFormData] = useState({ name: '', description: '' })

  useEffect(() => {
    loadQualifications()
  }, [])

  const loadQualifications = async () => {
    setLoading(true)
    const { data, error } = await qualificationService.getAll()
    if (!error && data) {
      setQualifications(data)
    }
    setLoading(false)
  }

  const handleCreate = () => {
    setEditing(null)
    setFormData({ name: '', description: '' })
    setIsDialogOpen(true)
  }

  const handleEdit = (qualification: Qualification) => {
    setEditing(qualification)
    setFormData({ name: qualification.name, description: qualification.description || '' })
    setIsDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) return

    if (editing) {
      const { error } = await qualificationService.update(editing.id, formData)
      if (!error) {
        await loadQualifications()
        setIsDialogOpen(false)
      }
    } else {
      const { error } = await qualificationService.create(formData)
      if (!error) {
        await loadQualifications()
        setIsDialogOpen(false)
      }
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this qualification?')) return
    const { error } = await qualificationService.delete(id)
    if (!error) {
      await loadQualifications()
    }
  }


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Qualifications</CardTitle>
            <CardDescription>Manage qualifications</CardDescription>
          </div>
          <div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Qualification
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-2">
            {qualifications.length === 0 ? (
              <p className="text-muted-foreground">No qualifications found</p>
            ) : (
              qualifications.map((qual) => (
                <div
                  key={qual.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{qual.name}</p>
                    {qual.description && (
                      <p className="text-sm text-muted-foreground">{qual.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(qual)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(qual.id)}
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
              {editing ? 'Edit Qualification' : 'Create Qualification'}
            </DialogTitle>
            <DialogDescription>
              {editing ? 'Update the qualification details' : 'Add a new qualification'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., GCSE, A-Level"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
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

