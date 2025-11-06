import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import type { AtRiskStudent } from '@/lib/analyticsService'

interface InterventionListProps {
  students: AtRiskStudent[]
}

export function InterventionList({ students }: InterventionListProps) {
  if (students.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>At-Risk Students</CardTitle>
          <CardDescription>Students who may need additional support</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No at-risk students identified.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
          At-Risk Students ({students.length})
        </CardTitle>
        <CardDescription>Students who may need additional support</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {students.map((student) => (
            <div key={student.student_id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold">{student.student_name}</h4>
                  <p className="text-sm text-muted-foreground">{student.student_email}</p>
                  <p className="text-sm text-muted-foreground">Class: {student.class_name}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {student.low_scores > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Low Scores:</span> {student.low_scores} exam(s)
                  </div>
                )}
                {student.incomplete_attempts > 0 && (
                  <div className="text-sm">
                    <span className="font-medium">Incomplete Attempts:</span> {student.incomplete_attempts}
                  </div>
                )}
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm font-medium text-blue-900">Recommendation:</p>
                  <p className="text-sm text-blue-800">{student.recommendation}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

