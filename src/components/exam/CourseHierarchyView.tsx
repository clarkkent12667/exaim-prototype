import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  qualificationService, 
  examBoardService, 
  subjectService, 
  topicService, 
  subtopicService,
  type Qualification,
  type ExamBoard,
  type Subject,
  type Topic,
  type Subtopic
} from '@/lib/qualificationService'
import { ChevronRight, ChevronDown, BookOpen, GraduationCap, FileText, Layers, BookMarked } from 'lucide-react'

interface HierarchyNode {
  qualification: Qualification
  examBoards: Array<{
    board: ExamBoard
    subjects: Array<{
      subject: Subject
      topics: Array<{
        topic: Topic
        subtopics: Subtopic[]
      }>
    }>
  }>
}

export function CourseHierarchyView() {
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadHierarchy()
  }, [])

  const loadHierarchy = async () => {
    setLoading(true)
    try {
      // Load all qualifications
      const { data: qualifications } = await qualificationService.getAll()
      if (!qualifications) {
        setLoading(false)
        return
      }

      // Load all data in parallel
      const hierarchyData: HierarchyNode[] = []

      for (const qual of qualifications) {
        // Load exam boards for this qualification
        const { data: boards } = await examBoardService.getByQualification(qual.id)
        if (!boards || boards.length === 0) continue

        const examBoardData: HierarchyNode['examBoards'][0][] = []

        // Load subjects for all boards in parallel
        const subjectPromises = boards.map(board => subjectService.getByExamBoard(board.id))
        const subjectResults = await Promise.all(subjectPromises)

        for (let i = 0; i < boards.length; i++) {
          const board = boards[i]
          const { data: subjects } = subjectResults[i]
          
          if (!subjects || subjects.length === 0) continue

          const subjectData: HierarchyNode['examBoards'][0]['subjects'][0][] = []

          // Load topics for all subjects in parallel
          const topicPromises = subjects.map(subject => topicService.getBySubject(subject.id))
          const topicResults = await Promise.all(topicPromises)

          for (let j = 0; j < subjects.length; j++) {
            const subject = subjects[j]
            const { data: topics } = topicResults[j]

            if (!topics || topics.length === 0) continue

            const topicData: HierarchyNode['examBoards'][0]['subjects'][0]['topics'][0][] = []

            // Load subtopics for all topics in parallel
            const subtopicPromises = topics.map(topic => subtopicService.getByTopic(topic.id))
            const subtopicResults = await Promise.all(subtopicPromises)

            for (let k = 0; k < topics.length; k++) {
              const topic = topics[k]
              const { data: subtopics } = subtopicResults[k]

              topicData.push({
                topic,
                subtopics: subtopics || []
              })
            }

            subjectData.push({
              subject,
              topics: topicData
            })
          }

          examBoardData.push({
            board,
            subjects: subjectData
          })
        }

        hierarchyData.push({
          qualification: qual,
          examBoards: examBoardData
        })
      }

      setHierarchy(hierarchyData)
      
      // Expand first qualification by default
      if (hierarchyData.length > 0) {
        setExpanded(new Set([hierarchyData[0].qualification.id]))
      }
    } catch (error: any) {
      // Error loading hierarchy
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpanded(newExpanded)
  }

  const expandAll = () => {
    const allIds = new Set<string>()
    hierarchy.forEach(qual => {
      allIds.add(qual.qualification.id)
      qual.examBoards.forEach(board => {
        allIds.add(board.board.id)
        board.subjects.forEach(subject => {
          allIds.add(subject.subject.id)
          subject.topics.forEach(topic => {
            allIds.add(topic.topic.id)
          })
        })
      })
    })
    setExpanded(allIds)
  }

  const collapseAll = () => {
    setExpanded(new Set())
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading hierarchy...</p>
        </CardContent>
      </Card>
    )
  }

  if (hierarchy.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No hierarchy data found. Add qualifications, exam boards, subjects, topics, and subtopics to see the hierarchy.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Course Hierarchy</CardTitle>
            <CardDescription>Visual representation of the qualification structure</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              Collapse All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {hierarchy.map((qualNode) => (
            <div key={qualNode.qualification.id} className="border rounded-lg overflow-hidden">
              {/* Qualification Level */}
              <div
                className="flex items-center gap-2 p-3 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-colors"
                onClick={() => toggleExpand(qualNode.qualification.id)}
              >
                {expanded.has(qualNode.qualification.id) ? (
                  <ChevronDown className="h-4 w-4 text-primary" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-primary" />
                )}
                <GraduationCap className="h-5 w-5 text-primary" />
                <span className="font-semibold text-lg">{qualNode.qualification.name}</span>
                {qualNode.qualification.description && (
                  <span className="text-sm text-muted-foreground ml-2">
                    - {qualNode.qualification.description}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {qualNode.examBoards.length} exam board{qualNode.examBoards.length !== 1 ? 's' : ''}
                </span>
              </div>

              {expanded.has(qualNode.qualification.id) && (
                <div className="pl-4 border-l-2 border-primary/20 ml-2">
                  {qualNode.examBoards.map((boardNode) => {
                    const boardId = `board-${boardNode.board.id}`
                    return (
                      <div key={boardNode.board.id} className="mt-2">
                        {/* Exam Board Level */}
                        <div
                          className="flex items-center gap-2 p-2 bg-secondary/50 hover:bg-secondary cursor-pointer transition-colors rounded"
                          onClick={() => toggleExpand(boardId)}
                        >
                          {expanded.has(boardId) ? (
                            <ChevronDown className="h-4 w-4 text-secondary-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-secondary-foreground" />
                          )}
                          <BookOpen className="h-4 w-4 text-secondary-foreground" />
                          <span className="font-medium">{boardNode.board.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {boardNode.subjects.length} subject{boardNode.subjects.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {expanded.has(boardId) && (
                          <div className="pl-4 border-l-2 border-secondary/30 ml-2 mt-1">
                            {boardNode.subjects.map((subjectNode) => {
                              const subjectId = `subject-${subjectNode.subject.id}`
                              return (
                                <div key={subjectNode.subject.id} className="mt-2">
                                  {/* Subject Level */}
                                  <div
                                    className="flex items-center gap-2 p-2 bg-accent/50 hover:bg-accent cursor-pointer transition-colors rounded"
                                    onClick={() => toggleExpand(subjectId)}
                                  >
                                    {expanded.has(subjectId) ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                    <FileText className="h-4 w-4" />
                                    <span className="font-medium">{subjectNode.subject.name}</span>
                                    <span className="ml-auto text-xs text-muted-foreground">
                                      {subjectNode.topics.length} topic{subjectNode.topics.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>

                                  {expanded.has(subjectId) && (
                                    <div className="pl-4 border-l-2 border-accent/30 ml-2 mt-1">
                                      {subjectNode.topics.map((topicNode) => {
                                        const topicId = `topic-${topicNode.topic.id}`
                                        return (
                                          <div key={topicNode.topic.id} className="mt-2">
                                            {/* Topic Level */}
                                            <div
                                              className="flex items-center gap-2 p-2 bg-muted hover:bg-muted/80 cursor-pointer transition-colors rounded"
                                              onClick={() => toggleExpand(topicId)}
                                            >
                                              {expanded.has(topicId) ? (
                                                <ChevronDown className="h-4 w-4" />
                                              ) : (
                                                <ChevronRight className="h-4 w-4" />
                                              )}
                                              <Layers className="h-4 w-4" />
                                              <span>{topicNode.topic.name}</span>
                                              <span className="ml-auto text-xs text-muted-foreground">
                                                {topicNode.subtopics.length} subtopic{topicNode.subtopics.length !== 1 ? 's' : ''}
                                              </span>
                                            </div>

                                            {expanded.has(topicId) && topicNode.subtopics.length > 0 && (
                                              <div className="pl-4 border-l-2 border-muted/30 ml-2 mt-1">
                                                {topicNode.subtopics.map((subtopic) => (
                                                  <div
                                                    key={subtopic.id}
                                                    className="flex items-center gap-2 p-2 text-sm text-muted-foreground hover:text-foreground transition-colors rounded"
                                                  >
                                                    <BookMarked className="h-3 w-3" />
                                                    <span>{subtopic.name}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}




