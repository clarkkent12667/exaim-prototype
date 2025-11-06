import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { TeacherAnalytics, StudentAnalytics } from './analyticsService'

export const exportService = {
  exportTeacherAnalyticsToPDF(analytics: TeacherAnalytics, teacherName: string) {
    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(20)
    doc.text('Teacher Analytics Report', 14, 20)
    doc.setFontSize(12)
    doc.text(`Generated for: ${teacherName}`, 14, 30)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 37)

    let yPos = 50

    // Overview Section
    doc.setFontSize(16)
    doc.text('Overview', 14, yPos)
    yPos += 10

    doc.setFontSize(10)
    const overviewData = [
      ['Total Classes', analytics.totalClasses.toString()],
      ['Total Students', analytics.totalStudents.toString()],
      ['Total Exams', analytics.totalExams.toString()],
      ['Total Attempts', analytics.totalAttempts.toString()],
      ['Average Score', analytics.averageScore.toFixed(2)],
      ['Completion Rate', `${analytics.completionRate.toFixed(2)}%`],
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: overviewData,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
    })

    yPos = (doc as any).lastAutoTable.finalY + 20

    // Class Performance
    if (analytics.classPerformance.length > 0) {
      doc.setFontSize(16)
      doc.text('Class Performance', 14, yPos)
      yPos += 10

      const classData = analytics.classPerformance.map(cp => [
        cp.class_name,
        cp.student_count.toString(),
        cp.average_score.toFixed(2),
        `${cp.completion_rate.toFixed(2)}%`,
        cp.total_attempts.toString(),
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Class Name', 'Students', 'Avg Score', 'Completion Rate', 'Total Attempts']],
        body: classData,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202] },
      })

      yPos = (doc as any).lastAutoTable.finalY + 20
    }

    // Exam Performance
    if (analytics.examPerformance.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(16)
      doc.text('Exam Performance', 14, yPos)
      yPos += 10

      const examData = analytics.examPerformance.map(ep => [
        ep.exam_title,
        ep.total_attempts.toString(),
        ep.average_score.toFixed(2),
        `${ep.completion_rate.toFixed(2)}%`,
        ep.total_students.toString(),
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Exam Title', 'Attempts', 'Avg Score', 'Completion Rate', 'Students']],
        body: examData,
        theme: 'striped',
        headStyles: { fillColor: [66, 139, 202] },
      })

      yPos = (doc as any).lastAutoTable.finalY + 20
    }

    // At-Risk Students
    if (analytics.atRiskStudents.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(16)
      doc.text('At-Risk Students', 14, yPos)
      yPos += 10

      const atRiskData = analytics.atRiskStudents.map(ars => [
        ars.student_name,
        ars.class_name,
        ars.low_scores.toString(),
        ars.incomplete_attempts.toString(),
        ars.recommendation,
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['Student Name', 'Class', 'Low Scores', 'Incomplete', 'Recommendation']],
        body: atRiskData,
        theme: 'striped',
        headStyles: { fillColor: [220, 53, 69] },
        columnStyles: {
          4: { cellWidth: 80 },
        },
      })
    }

    doc.save(`teacher-analytics-${new Date().toISOString().split('T')[0]}.pdf`)
  },

  exportTeacherAnalyticsToCSV(analytics: TeacherAnalytics): string {
    let csv = 'Teacher Analytics Report\n'
    csv += `Generated on: ${new Date().toLocaleDateString()}\n\n`

    // Overview
    csv += 'Overview\n'
    csv += 'Metric,Value\n'
    csv += `Total Classes,${analytics.totalClasses}\n`
    csv += `Total Students,${analytics.totalStudents}\n`
    csv += `Total Exams,${analytics.totalExams}\n`
    csv += `Total Attempts,${analytics.totalAttempts}\n`
    csv += `Average Score,${analytics.averageScore.toFixed(2)}\n`
    csv += `Completion Rate,${analytics.completionRate.toFixed(2)}%\n\n`

    // Class Performance
    if (analytics.classPerformance.length > 0) {
      csv += 'Class Performance\n'
      csv += 'Class Name,Students,Avg Score,Completion Rate,Total Attempts\n'
      analytics.classPerformance.forEach(cp => {
        csv += `${cp.class_name},${cp.student_count},${cp.average_score.toFixed(2)},${cp.completion_rate.toFixed(2)}%,${cp.total_attempts}\n`
      })
      csv += '\n'
    }

    // Exam Performance
    if (analytics.examPerformance.length > 0) {
      csv += 'Exam Performance\n'
      csv += 'Exam Title,Attempts,Avg Score,Completion Rate,Students\n'
      analytics.examPerformance.forEach(ep => {
        csv += `${ep.exam_title},${ep.total_attempts},${ep.average_score.toFixed(2)},${ep.completion_rate.toFixed(2)}%,${ep.total_students}\n`
      })
      csv += '\n'
    }

    // At-Risk Students
    if (analytics.atRiskStudents.length > 0) {
      csv += 'At-Risk Students\n'
      csv += 'Student Name,Class,Low Scores,Incomplete Attempts,Recommendation\n'
      analytics.atRiskStudents.forEach(ars => {
        csv += `${ars.student_name},${ars.class_name},${ars.low_scores},${ars.incomplete_attempts},"${ars.recommendation}"\n`
      })
    }

    return csv
  },

  exportStudentAnalyticsToPDF(analytics: StudentAnalytics, studentName: string) {
    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(20)
    doc.text('Student Analytics Report', 14, 20)
    doc.setFontSize(12)
    doc.text(`Generated for: ${studentName}`, 14, 30)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 37)

    let yPos = 50

    // Overview
    doc.setFontSize(16)
    doc.text('Overview', 14, yPos)
    yPos += 10

    doc.setFontSize(10)
    const overviewData = [
      ['Total Attempts', analytics.totalAttempts.toString()],
      ['Average Score', analytics.averageScore.toFixed(2)],
      ['Completion Rate', `${analytics.completionRate.toFixed(2)}%`],
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: overviewData,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
    })

    yPos = (doc as any).lastAutoTable.finalY + 20

    // Question Type Performance
    doc.setFontSize(16)
    doc.text('Question Type Performance', 14, yPos)
    yPos += 10

    const questionTypeData = [
      ['Multiple Choice', analytics.questionTypePerformance.mcq.correct, analytics.questionTypePerformance.mcq.total, `${analytics.questionTypePerformance.mcq.percentage.toFixed(2)}%`],
      ['Fill in the Blank', analytics.questionTypePerformance.fib.correct, analytics.questionTypePerformance.fib.total, `${analytics.questionTypePerformance.fib.percentage.toFixed(2)}%`],
      ['Open-Ended', analytics.questionTypePerformance.open_ended.correct, analytics.questionTypePerformance.open_ended.total, `${analytics.questionTypePerformance.open_ended.percentage.toFixed(2)}%`],
    ]

    autoTable(doc, {
      startY: yPos,
      head: [['Question Type', 'Correct', 'Total', 'Percentage']],
      body: questionTypeData,
      theme: 'striped',
      headStyles: { fillColor: [66, 139, 202] },
    })

    yPos = (doc as any).lastAutoTable.finalY + 20

    // Strengths
    if (analytics.strengths.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(16)
      doc.text('Strengths', 14, yPos)
      yPos += 10

      doc.setFontSize(10)
      analytics.strengths.forEach((strength, index) => {
        doc.text(`${index + 1}. ${strength}`, 14, yPos)
        yPos += 7
      })
      yPos += 5
    }

    // Weaknesses
    if (analytics.weaknesses.length > 0) {
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(16)
      doc.text('Areas for Improvement', 14, yPos)
      yPos += 10

      doc.setFontSize(10)
      analytics.improvementAreas.forEach((area, index) => {
        doc.text(`${index + 1}. ${area}`, 14, yPos)
        yPos += 7
      })
    }

    doc.save(`student-analytics-${new Date().toISOString().split('T')[0]}.pdf`)
  },

  exportStudentAnalyticsToCSV(analytics: StudentAnalytics): string {
    let csv = 'Student Analytics Report\n'
    csv += `Generated on: ${new Date().toLocaleDateString()}\n\n`

    // Overview
    csv += 'Overview\n'
    csv += 'Metric,Value\n'
    csv += `Total Attempts,${analytics.totalAttempts}\n`
    csv += `Average Score,${analytics.averageScore.toFixed(2)}\n`
    csv += `Completion Rate,${analytics.completionRate.toFixed(2)}%\n\n`

    // Question Type Performance
    csv += 'Question Type Performance\n'
    csv += 'Question Type,Correct,Total,Percentage\n'
    csv += `Multiple Choice,${analytics.questionTypePerformance.mcq.correct},${analytics.questionTypePerformance.mcq.total},${analytics.questionTypePerformance.mcq.percentage.toFixed(2)}%\n`
    csv += `Fill in the Blank,${analytics.questionTypePerformance.fib.correct},${analytics.questionTypePerformance.fib.total},${analytics.questionTypePerformance.fib.percentage.toFixed(2)}%\n`
    csv += `Open-Ended,${analytics.questionTypePerformance.open_ended.correct},${analytics.questionTypePerformance.open_ended.total},${analytics.questionTypePerformance.open_ended.percentage.toFixed(2)}%\n\n`

    // Score Trend
    if (analytics.scoreTrend.length > 0) {
      csv += 'Score Trend\n'
      csv += 'Date,Exam,Score,Percentage\n'
      analytics.scoreTrend.forEach(st => {
        csv += `${new Date(st.date).toLocaleDateString()},"${st.exam_title}",${st.score},${st.percentage.toFixed(2)}%\n`
      })
      csv += '\n'
    }

    // Strengths
    if (analytics.strengths.length > 0) {
      csv += 'Strengths\n'
      analytics.strengths.forEach((strength, index) => {
        csv += `${index + 1}. ${strength}\n`
      })
      csv += '\n'
    }

    // Improvement Areas
    if (analytics.improvementAreas.length > 0) {
      csv += 'Areas for Improvement\n'
      analytics.improvementAreas.forEach((area, index) => {
        csv += `${index + 1}. ${area}\n`
      })
    }

    return csv
  },

  downloadCSV(csv: string, filename: string) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
}

