import { useState } from 'react'
import { QualificationManager } from '@/components/exam/QualificationManager'
import { ExamBoardManager } from '@/components/exam/ExamBoardManager'
import { SubjectManager } from '@/components/exam/SubjectManager'
import { TopicManager } from '@/components/exam/TopicManager'
import { SubtopicManager } from '@/components/exam/SubtopicManager'
import { CentralizedBulkUpload } from '@/components/exam/CentralizedBulkUpload'
import { CourseHierarchyView } from '@/components/exam/CourseHierarchyView'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

export function ManageQualifications() {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'qualifications' | 'exam_boards' | 'subjects' | 'topics' | 'subtopics'>('hierarchy')
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <>
    <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Manage Qualifications & Topics</h1>
            <p className="text-muted-foreground mt-2">Manage the qualification hierarchy for exams</p>
          </div>
          <Button onClick={() => setIsBulkUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Bulk Upload
          </Button>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <Button
            variant={activeTab === 'hierarchy' ? 'default' : 'outline'}
            onClick={() => setActiveTab('hierarchy')}
          >
            Course Hierarchy
          </Button>
          <Button
            variant={activeTab === 'qualifications' ? 'default' : 'outline'}
            onClick={() => setActiveTab('qualifications')}
          >
            Qualifications
          </Button>
          <Button
            variant={activeTab === 'exam_boards' ? 'default' : 'outline'}
            onClick={() => setActiveTab('exam_boards')}
          >
            Exam Boards
          </Button>
          <Button
            variant={activeTab === 'subjects' ? 'default' : 'outline'}
            onClick={() => setActiveTab('subjects')}
          >
            Subjects
          </Button>
          <Button
            variant={activeTab === 'topics' ? 'default' : 'outline'}
            onClick={() => setActiveTab('topics')}
          >
            Topics
          </Button>
          <Button
            variant={activeTab === 'subtopics' ? 'default' : 'outline'}
            onClick={() => setActiveTab('subtopics')}
          >
            Subtopics
          </Button>
        </div>

        {activeTab === 'hierarchy' && <CourseHierarchyView key={refreshKey} />}
        {activeTab === 'qualifications' && <QualificationManager key={refreshKey} />}
        {activeTab === 'exam_boards' && <ExamBoardManager key={refreshKey} />}
        {activeTab === 'subjects' && <SubjectManager key={refreshKey} />}
        {activeTab === 'topics' && <TopicManager key={refreshKey} />}
        {activeTab === 'subtopics' && <SubtopicManager key={refreshKey} />}
      </div>

      <CentralizedBulkUpload
        open={isBulkUploadOpen}
        onOpenChange={setIsBulkUploadOpen}
        onUploadComplete={() => {
          setRefreshKey(prev => prev + 1)
        }}
      />
    </>
  )
}

