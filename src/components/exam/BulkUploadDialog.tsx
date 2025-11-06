import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpload: (data: any[]) => Promise<void>
  title: string
  description: string
  example: string
}

export function BulkUploadDialog({
  open,
  onOpenChange,
  onUpload,
  title,
  description,
  example,
}: BulkUploadDialogProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = async () => {
    setError(null)
    setLoading(true)

    try {
      // Parse JSON or CSV
      let data: any[]
      
      if (content.trim().startsWith('[')) {
        // JSON format
        data = JSON.parse(content)
      } else {
        // CSV format - simple parser
        const lines = content.trim().split('\n')
        const headers = lines[0].split(',').map(h => h.trim())
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim())
          const obj: any = {}
          headers.forEach((header, index) => {
            obj[header] = values[index] || ''
          })
          return obj
        })
      }

      await onUpload(data)
      setContent('')
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to parse data. Please check the format.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-content">Data (JSON array or CSV)</Label>
            <Textarea
              id="bulk-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={example}
              className="min-h-[200px] font-mono text-sm"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium mb-2">Example JSON format:</p>
            <pre className="text-xs overflow-auto">{example}</pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={loading || !content.trim()}>
            {loading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

