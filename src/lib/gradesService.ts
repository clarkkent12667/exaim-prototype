/**
 * Grades Service
 * Utility functions for calculating statistics and aggregating grades
 */

export interface GradeStatistics {
  average: number
  median: number
  highest: number
  lowest: number
  totalStudents: number
  gradeDistribution: {
    A: number
    B: number
    C: number
    D: number
    F: number
  }
}

export interface StudentGrade {
  student_id: string
  student_name: string
  student_email: string
  score: number
  percentage: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  submitted_at?: string
  attempt_id: string
}

/**
 * Calculate grade letter based on percentage
 */
export function calculateGradeLetter(percentage: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (percentage >= 90) return 'A'
  if (percentage >= 80) return 'B'
  if (percentage >= 70) return 'C'
  if (percentage >= 60) return 'D'
  return 'F'
}

/**
 * Calculate average from an array of numbers
 */
export function calculateAverage(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sum = numbers.reduce((acc, num) => acc + num, 0)
  return sum / numbers.length
}

/**
 * Calculate median from an array of numbers
 */
export function calculateMedian(numbers: number[]): number {
  if (numbers.length === 0) return 0
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

/**
 * Calculate grade distribution from an array of percentages
 */
export function calculateGradeDistribution(percentages: number[]): GradeStatistics['gradeDistribution'] {
  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 }
  
  percentages.forEach(percentage => {
    const grade = calculateGradeLetter(percentage)
    distribution[grade]++
  })
  
  return distribution
}

/**
 * Calculate comprehensive statistics from student grades
 */
export function calculateStatistics(
  scores: number[],
  totalMarks: number
): GradeStatistics {
  if (scores.length === 0) {
    return {
      average: 0,
      median: 0,
      highest: 0,
      lowest: 0,
      totalStudents: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 }
    }
  }

  const percentages = scores.map(score => (score / totalMarks) * 100)
  const average = calculateAverage(percentages)
  const median = calculateMedian(percentages)
  const highest = Math.max(...percentages)
  const lowest = Math.min(...percentages)
  const gradeDistribution = calculateGradeDistribution(percentages)

  return {
    average: Math.round(average * 10) / 10, // Round to 1 decimal
    median: Math.round(median * 10) / 10,
    highest: Math.round(highest * 10) / 10,
    lowest: Math.round(lowest * 10) / 10,
    totalStudents: scores.length,
    gradeDistribution
  }
}

/**
 * Get color class for grade letter
 */
export function getGradeColor(grade: 'A' | 'B' | 'C' | 'D' | 'F'): string {
  switch (grade) {
    case 'A':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'B':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'C':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'D':
      return 'text-orange-600 bg-orange-50 border-orange-200'
    case 'F':
      return 'text-red-600 bg-red-50 border-red-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

/**
 * Get color class for percentage (for progress bars)
 */
export function getPercentageColor(percentage: number): string {
  if (percentage >= 90) return 'bg-green-500'
  if (percentage >= 80) return 'bg-blue-500'
  if (percentage >= 70) return 'bg-yellow-500'
  if (percentage >= 60) return 'bg-orange-500'
  return 'bg-red-500'
}

