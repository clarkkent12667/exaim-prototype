import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface HeatMapCell {
  student_id: string
  exam_id: string
  score: number
  percentage: number
  attempt_id?: string
  submitted_at?: string
  time_spent_minutes?: number
}

export interface HeatMapStudent {
  id: string
  name: string
  email: string
  average_score: number
}

export interface HeatMapExam {
  id: string
  title: string
  total_marks: number
  average_score: number
}

export interface GradesHeatMapProps {
  students: HeatMapStudent[]
  exams: HeatMapExam[]
  cells: HeatMapCell[]
  onCellClick?: (cell: HeatMapCell, student: HeatMapStudent, exam: HeatMapExam) => void
  showRawScores?: boolean
}

type SortField = 'name' | 'average' | null
type SortDirection = 'asc' | 'desc'

const getColorForPercentage = (percentage: number | null): string => {
  if (percentage === null) return '#9ca3af' // Gray for no attempt
  if (percentage >= 90) return '#22c55e' // Dark green
  if (percentage >= 80) return '#4ade80' // Light green
  if (percentage >= 70) return '#eab308' // Yellow
  if (percentage >= 60) return '#f97316' // Orange
  if (percentage >= 40) return '#f87171' // Light red
  return '#dc2626' // Dark red
}

const formatTimeSpent = (minutes?: number): string => {
  if (!minutes) return 'N/A'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${mins}m`
}

export function GradesHeatMap({
  students,
  exams,
  cells,
  onCellClick,
  showRawScores = false,
}: GradesHeatMapProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [studentSort, setStudentSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: null,
    direction: 'asc',
  })
  const [examSort, setExamSort] = useState<{ field: SortField; direction: SortDirection }>({
    field: null,
    direction: 'asc',
  })

  // Create a map for quick cell lookup
  const cellMap = useMemo(() => {
    const map = new Map<string, HeatMapCell>()
    cells.forEach((cell) => {
      map.set(`${cell.student_id}-${cell.exam_id}`, cell)
    })
    return map
  }, [cells])

  // Filter and sort students
  const filteredAndSortedStudents = useMemo(() => {
    let filtered = students.filter((student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    if (studentSort.field) {
      filtered = [...filtered].sort((a, b) => {
        let comparison = 0
        if (studentSort.field === 'name') {
          comparison = a.name.localeCompare(b.name)
        } else if (studentSort.field === 'average') {
          comparison = a.average_score - b.average_score
        }
        return studentSort.direction === 'asc' ? comparison : -comparison
      })
    }

    return filtered
  }, [students, searchQuery, studentSort])

  // Sort exams
  const sortedExams = useMemo(() => {
    if (!examSort.field) return exams

    return [...exams].sort((a, b) => {
      let comparison = 0
      if (examSort.field === 'name') {
        comparison = a.title.localeCompare(b.title)
      } else if (examSort.field === 'average') {
        comparison = a.average_score - b.average_score
      }
      return examSort.direction === 'asc' ? comparison : -comparison
    })
  }, [exams, examSort])

  const handleStudentSort = (field: SortField) => {
    setStudentSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const handleExamSort = (field: SortField) => {
    setExamSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const getCell = (studentId: string, examId: string): HeatMapCell | null => {
    return cellMap.get(`${studentId}-${examId}`) || null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Markbook Heat Map</CardTitle>
            <CardDescription>
              Students (rows) × Exams (columns) - Click cells to view details
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Color Legend */}
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium">Legend:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#22c55e' }} />
            <span>90-100%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#4ade80' }} />
            <span>80-89%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#eab308' }} />
            <span>70-79%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f97316' }} />
            <span>60-69%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f87171' }} />
            <span>40-59%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#dc2626' }} />
            <span>&lt;40%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: '#9ca3af' }} />
            <span>No attempt</span>
          </div>
        </div>

        {/* Heat Map Grid */}
        <div className="overflow-auto max-h-[600px] border rounded-lg">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-background z-10">
              <tr>
                <th className="sticky left-0 z-20 bg-background border p-2 text-left font-semibold min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span>Student</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleStudentSort('name')}
                      title="Sort by name"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </div>
                </th>
                <th className="sticky left-[200px] z-20 bg-background border p-2 text-left font-semibold min-w-[100px]">
                  <div className="flex items-center gap-2">
                    <span>Avg</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleStudentSort('average')}
                      title="Sort by average"
                    >
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </div>
                </th>
                {sortedExams.map((exam) => (
                  <th
                    key={exam.id}
                    className="border p-2 text-center font-semibold min-w-[120px] max-w-[120px]"
                    title={exam.title}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs truncate w-full" title={exam.title}>
                        {exam.title.length > 15 ? `${exam.title.substring(0, 15)}...` : exam.title}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => handleExamSort('name')}
                          title="Sort exams"
                        >
                          <ArrowUpDown className="h-2 w-2" />
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Avg: {exam.average_score.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedStudents.map((student) => {
                const studentCells = sortedExams.map((exam) => getCell(student.id, exam.id))
                return (
                  <tr key={student.id} className="hover:bg-muted/50">
                    <td className="sticky left-0 z-10 bg-background border p-2 font-medium">
                      <div>
                        <div className="font-semibold">{student.name}</div>
                        <div className="text-xs text-muted-foreground">{student.email}</div>
                      </div>
                    </td>
                    <td className="sticky left-[200px] z-10 bg-background border p-2 text-center font-semibold">
                      {student.average_score.toFixed(1)}
                    </td>
                    {sortedExams.map((exam) => {
                      const cell = getCell(student.id, exam.id)
                      const percentage = cell?.percentage ?? null
                      const bgColor = getColorForPercentage(percentage)
                      const displayValue = cell
                        ? showRawScores
                          ? `${cell.score.toFixed(1)}/${exam.total_marks}`
                          : `${percentage?.toFixed(1)}%`
                        : '-'

                      return (
                        <td
                          key={exam.id}
                          className="border p-2 text-center cursor-pointer hover:opacity-80 transition-opacity relative group"
                          style={{ backgroundColor: bgColor, color: percentage !== null ? 'white' : 'inherit' }}
                          onClick={() => {
                            if (cell && onCellClick) {
                              onCellClick(cell, student, exam)
                            }
                          }}
                        >
                          <div className="font-semibold">{displayValue}</div>
                          {cell && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-30">
                              <div className="bg-popover border rounded-lg p-3 shadow-lg text-sm min-w-[200px]">
                                <div className="font-semibold mb-1">{student.name}</div>
                                <div className="text-xs mb-1">{exam.title}</div>
                                <div className="text-xs">
                                  Score: {cell.score.toFixed(1)} / {exam.total_marks}
                                </div>
                                <div className="text-xs">
                                  Percentage: {cell.percentage.toFixed(1)}%
                                </div>
                                {cell.submitted_at && (
                                  <div className="text-xs">
                                    Date: {new Date(cell.submitted_at).toLocaleDateString()}
                                  </div>
                                )}
                                {cell.time_spent_minutes && (
                                  <div className="text-xs">
                                    Time: {formatTimeSpent(cell.time_spent_minutes)}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {filteredAndSortedStudents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No students found matching your search.
          </div>
        )}
      </CardContent>
    </Card>
  )
}

