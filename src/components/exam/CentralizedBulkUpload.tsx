import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { 
  qualificationService, 
  examBoardService, 
  subjectService, 
  topicService, 
  subtopicService 
} from '@/lib/qualificationService'
import { Download, Upload, FileText } from 'lucide-react'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploadComplete: () => void
}

interface CSVRow {
  Qualification: string
  'Exam Board': string
  Subject: string
  Topic: string
  Subtopic: string
}

export function CentralizedBulkUpload({
  open,
  onOpenChange,
  onUploadComplete,
}: BulkUploadDialogProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string>('')
  const [uploadMode, setUploadMode] = useState<'paste' | 'file'>('paste')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const csvTemplate = `Qualification,Exam Board,Subject,Topic,Subtopic
GCSE,AQA,Mathematics,Algebra,Linear Equations
GCSE,AQA,Mathematics,Algebra,Quadratic Functions
GCSE,Edexcel,Mathematics,Geometry,Triangles
GCSE,Edexcel,Mathematics,Geometry,Circles
A-Level,OCR,Physics,Mechanics,Forces
A-Level,OCR,Physics,Mechanics,Energy`

  const downloadTemplate = () => {
    const blob = new Blob([csvTemplate], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'qualification_hierarchy_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file')
      return
    }

    try {
      const text = await file.text()
      setContent(text)
      setUploadMode('paste')
      setError(null)
    } catch (err: any) {
      setError('Failed to read file: ' + err.message)
    }
  }

  const handleFileUpload = () => {
    fileInputRef.current?.click()
  }

  const parseCSV = (csvText: string): CSVRow[] => {
    const lines = csvText.trim().split('\n').filter(line => line.trim())
    if (lines.length < 2) throw new Error('CSV must have at least a header and one data row')
    
    // Simple CSV parser that handles quoted values
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Escaped quote
            current += '"'
            i++
          } else {
            // Toggle quote state
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          // Field separator
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }
    
    const headers = parseCSVLine(lines[0])
    const requiredHeaders = ['Qualification', 'Exam Board', 'Subject', 'Topic', 'Subtopic']
    
    // Check if headers match (case-insensitive)
    const normalizedHeaders = headers.map(h => h.trim())
    const hasAllHeaders = requiredHeaders.every(h => 
      normalizedHeaders.some(nh => nh.toLowerCase() === h.toLowerCase())
    )
    if (!hasAllHeaders) {
      throw new Error(`CSV must have headers: ${requiredHeaders.join(', ')}`)
    }

    // Create a mapping from normalized headers to actual headers
    const headerMap: Record<string, string> = {}
    requiredHeaders.forEach(reqHeader => {
      const found = normalizedHeaders.find(h => h.toLowerCase() === reqHeader.toLowerCase())
      if (found) {
        const index = normalizedHeaders.indexOf(found)
        headerMap[reqHeader] = headers[index]
      }
    })

    const data: CSVRow[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const row: any = {}
      
      requiredHeaders.forEach((reqHeader, idx) => {
        const actualHeader = headerMap[reqHeader]
        const headerIndex = headers.indexOf(actualHeader)
        row[reqHeader === 'Exam Board' ? 'Exam Board' : reqHeader] = values[headerIndex] || ''
      })
      
      // Skip completely empty rows
      if (row.Qualification || row['Exam Board'] || row.Subject || row.Topic || row.Subtopic) {
        data.push(row as CSVRow)
      }
    }
    
    return data
  }

  const handleUpload = async () => {
    setError(null)
    setLoading(true)
    setProgress('')

    try {
      // Parse CSV
      const rows = parseCSV(content)
      if (rows.length === 0) {
        throw new Error('No valid data rows found')
      }

      setProgress('Parsing CSV data...')

      // Create a map to track created entities and avoid duplicates
      const qualificationMap = new Map<string, string>() // name -> id
      const examBoardMap = new Map<string, string>() // "qual:board" -> id
      const subjectMap = new Map<string, string>() // "board:subject" -> id
      const topicMap = new Map<string, string>() // "subject:topic" -> id
      const subtopicMap = new Map<string, string>() // "topic:subtopic" -> id

      let createdCount = 0
      let skippedCount = 0

      // Process rows in order
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        setProgress(`Processing row ${i + 1} of ${rows.length}...`)

        try {
          // 1. Ensure Qualification exists
          let qualificationId = qualificationMap.get(row.Qualification)
          if (!qualificationId && row.Qualification) {
            // Check if it already exists
            const { data: existing } = await qualificationService.getAll()
            const existingQual = existing?.find(q => q.name === row.Qualification)
            
            if (existingQual) {
              qualificationId = existingQual.id
              qualificationMap.set(row.Qualification, qualificationId)
            } else {
              const { data: newQual, error } = await qualificationService.create({
                name: row.Qualification,
              })
              if (error) throw new Error(`Failed to create qualification "${row.Qualification}": ${error.message}`)
              if (newQual) {
                qualificationId = newQual.id
                qualificationMap.set(row.Qualification, qualificationId)
                createdCount++
              }
            }
          }

          // 2. Ensure Exam Board exists
          let examBoardId = qualificationId && row['Exam Board'] 
            ? examBoardMap.get(`${qualificationId}:${row['Exam Board']}`)
            : undefined

          if (!examBoardId && qualificationId && row['Exam Board']) {
            const key = `${qualificationId}:${row['Exam Board']}`
            // Check if it already exists
            const { data: existing } = await examBoardService.getByQualification(qualificationId)
            const existingBoard = existing?.find(b => b.name === row['Exam Board'])
            
            if (existingBoard) {
              examBoardId = existingBoard.id
              examBoardMap.set(key, examBoardId)
            } else {
              const { data: newBoard, error } = await examBoardService.create({
                name: row['Exam Board'],
                qualification_id: qualificationId,
              })
              if (error) throw new Error(`Failed to create exam board "${row['Exam Board']}": ${error.message}`)
              if (newBoard) {
                examBoardId = newBoard.id
                examBoardMap.set(key, examBoardId)
                createdCount++
              }
            }
          }

          // 3. Ensure Subject exists
          let subjectId = examBoardId && row.Subject
            ? subjectMap.get(`${examBoardId}:${row.Subject}`)
            : undefined

          if (!subjectId && examBoardId && row.Subject) {
            const key = `${examBoardId}:${row.Subject}`
            // Check if it already exists
            const { data: existing } = await subjectService.getByExamBoard(examBoardId)
            const existingSubject = existing?.find(s => s.name === row.Subject)
            
            if (existingSubject) {
              subjectId = existingSubject.id
              subjectMap.set(key, subjectId)
            } else {
              const { data: newSubject, error } = await subjectService.create({
                name: row.Subject,
                exam_board_id: examBoardId,
              })
              if (error) throw new Error(`Failed to create subject "${row.Subject}": ${error.message}`)
              if (newSubject) {
                subjectId = newSubject.id
                subjectMap.set(key, subjectId)
                createdCount++
              }
            }
          }

          // 4. Ensure Topic exists
          let topicId = subjectId && row.Topic
            ? topicMap.get(`${subjectId}:${row.Topic}`)
            : undefined

          if (!topicId && subjectId && row.Topic) {
            const key = `${subjectId}:${row.Topic}`
            // Check if it already exists
            const { data: existing } = await topicService.getBySubject(subjectId)
            const existingTopic = existing?.find(t => t.name === row.Topic)
            
            if (existingTopic) {
              topicId = existingTopic.id
              topicMap.set(key, topicId)
            } else {
              const { data: newTopic, error } = await topicService.create({
                name: row.Topic,
                subject_id: subjectId,
              })
              if (error) throw new Error(`Failed to create topic "${row.Topic}": ${error.message}`)
              if (newTopic) {
                topicId = newTopic.id
                topicMap.set(key, topicId)
                createdCount++
              }
            }
          }

          // 5. Ensure Subtopic exists
          if (topicId && row.Subtopic) {
            const key = `${topicId}:${row.Subtopic}`
            if (!subtopicMap.has(key)) {
              // Check if it already exists
              const { data: existing } = await subtopicService.getByTopic(topicId)
              const existingSubtopic = existing?.find(s => s.name === row.Subtopic)
              
              if (!existingSubtopic) {
                const { data: newSubtopic, error } = await subtopicService.create({
                  name: row.Subtopic,
                  topic_id: topicId,
                })
                if (error) throw new Error(`Failed to create subtopic "${row.Subtopic}": ${error.message}`)
                if (newSubtopic) {
                  subtopicMap.set(key, newSubtopic.id)
                  createdCount++
                }
              } else {
                subtopicMap.set(key, existingSubtopic.id)
                skippedCount++
              }
            } else {
              skippedCount++
            }
          }
        } catch (rowError: any) {
          throw new Error(`Row ${i + 1}: ${rowError.message}`)
        }
      }

      setProgress(`Success! Created ${createdCount} entities, skipped ${skippedCount} duplicates.`)
      
      // Wait a moment to show success message
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      setContent('')
      onUploadComplete()
      onOpenChange(false)
    } catch (err: any) {
      setError(err.message || 'Failed to process CSV. Please check the format.')
      setProgress('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Upload Hierarchy</DialogTitle>
          <DialogDescription>
            Upload all qualifications, exam boards, subjects, topics, and subtopics in one CSV file
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label>Upload Method</Label>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>

          <div className="flex gap-2 border-b pb-4">
            <Button
              variant={uploadMode === 'paste' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setUploadMode('paste')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Paste CSV
            </Button>
            <Button
              variant={uploadMode === 'file' ? 'default' : 'outline'}
              size="sm"
              onClick={handleFileUpload}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {uploadMode === 'paste' && (
            <div className="space-y-2">
              <Label htmlFor="bulk-content">Paste CSV Data</Label>
              <Textarea
                id="bulk-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={csvTemplate}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
          )}

          {uploadMode === 'file' && content && (
            <div className="space-y-2">
              <Label>CSV Content (from file)</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
            </div>
          )}

          {uploadMode === 'file' && !content && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">Click "Upload File" to select a CSV file</p>
              <p className="text-sm text-muted-foreground">Or switch to "Paste CSV" mode</p>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {progress && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-700">{progress}</p>
            </div>
          )}
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2">CSV Format:</p>
              <p className="text-xs text-muted-foreground mb-2">
                The CSV must have these exact column headers: <strong>Qualification,Exam Board,Subject,Topic,Subtopic</strong>
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                All columns are required. The system will create the hierarchy automatically, skipping duplicates.
              </p>
              <div className="mt-3">
                <p className="text-xs font-medium mb-1">Example:</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-auto">
{`Qualification,Exam Board,Subject,Topic,Subtopic
GCSE,AQA,Mathematics,Algebra,Linear Equations
GCSE,AQA,Mathematics,Algebra,Quadratic Functions
GCSE,Edexcel,English,Literature,Shakespeare`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
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

