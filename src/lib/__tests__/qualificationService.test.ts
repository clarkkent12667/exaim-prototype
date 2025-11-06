import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  qualificationService,
  examBoardService,
  subjectService,
  topicService,
  subtopicService,
} from '../qualificationService'
import { supabase } from '../supabase'

// Mock supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('qualificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should get all qualifications', async () => {
      const mockQualifications = [
        { id: 'qual1', name: 'GCSE' },
        { id: 'qual2', name: 'A-Level' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockQualifications, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await qualificationService.getAll()

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockQualifications)
    })
  })

  describe('create', () => {
    it('should create a new qualification', async () => {
      const mockQualification = {
        id: 'qual1',
        name: 'GCSE',
        description: 'General Certificate of Secondary Education',
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockQualification, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await qualificationService.create({
        name: 'GCSE',
        description: 'General Certificate of Secondary Education',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockQualification)
    })
  })

  describe('update', () => {
    it('should update a qualification', async () => {
      const updatedQualification = {
        id: 'qual1',
        name: 'Updated GCSE',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedQualification, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await qualificationService.update('qual1', { name: 'Updated GCSE' })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedQualification)
    })
  })

  describe('delete', () => {
    it('should delete a qualification', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      const result = await qualificationService.delete('qual1')

      expect(result.error).toBeNull()
    })
  })

  describe('bulkCreate', () => {
    it('should create multiple qualifications', async () => {
      const mockQualifications = [
        { id: 'qual1', name: 'GCSE' },
        { id: 'qual2', name: 'A-Level' },
      ]

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockQualifications, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await qualificationService.bulkCreate([
        { name: 'GCSE' },
        { name: 'A-Level' },
      ])

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockQualifications)
    })
  })
})

describe('examBoardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should get all exam boards', async () => {
      const mockBoards = [
        { id: 'board1', name: 'AQA', qualification_id: 'qual1' },
        { id: 'board2', name: 'Edexcel', qualification_id: 'qual1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockBoards, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await examBoardService.getAll()

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockBoards)
    })
  })

  describe('getByQualification', () => {
    it('should get exam boards by qualification', async () => {
      const mockBoards = [
        { id: 'board1', name: 'AQA', qualification_id: 'qual1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockBoards, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await examBoardService.getByQualification('qual1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockBoards)
    })

    it('should return empty array for empty qualificationId', async () => {
      const result = await examBoardService.getByQualification('')

      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })
  })

  describe('create', () => {
    it('should create a new exam board', async () => {
      const mockBoard = {
        id: 'board1',
        name: 'AQA',
        qualification_id: 'qual1',
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockBoard, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await examBoardService.create({
        name: 'AQA',
        qualification_id: 'qual1',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockBoard)
    })
  })

  describe('update', () => {
    it('should update an exam board', async () => {
      const updatedBoard = {
        id: 'board1',
        name: 'Updated AQA',
        qualification_id: 'qual1',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedBoard, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await examBoardService.update('board1', { name: 'Updated AQA' })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedBoard)
    })
  })

  describe('delete', () => {
    it('should delete an exam board', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      const result = await examBoardService.delete('board1')

      expect(result.error).toBeNull()
    })
  })

  describe('bulkCreate', () => {
    it('should create multiple exam boards', async () => {
      const mockBoards = [
        { id: 'board1', name: 'AQA', qualification_id: 'qual1' },
        { id: 'board2', name: 'Edexcel', qualification_id: 'qual1' },
      ]

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockBoards, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await examBoardService.bulkCreate([
        { name: 'AQA', qualification_id: 'qual1' },
        { name: 'Edexcel', qualification_id: 'qual1' },
      ])

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockBoards)
    })
  })
})

describe('subjectService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should get all subjects', async () => {
      const mockSubjects = [
        { id: 'subject1', name: 'Mathematics', exam_board_id: 'board1' },
        { id: 'subject2', name: 'Physics', exam_board_id: 'board1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockSubjects, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await subjectService.getAll()

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubjects)
    })
  })

  describe('getByExamBoard', () => {
    it('should get subjects by exam board', async () => {
      const mockSubjects = [
        { id: 'subject1', name: 'Mathematics', exam_board_id: 'board1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockSubjects, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await subjectService.getByExamBoard('board1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubjects)
    })

    it('should return empty array for empty examBoardId', async () => {
      const result = await subjectService.getByExamBoard('')

      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })
  })

  describe('create', () => {
    it('should create a new subject', async () => {
      const mockSubject = {
        id: 'subject1',
        name: 'Mathematics',
        exam_board_id: 'board1',
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSubject, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await subjectService.create({
        name: 'Mathematics',
        exam_board_id: 'board1',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubject)
    })
  })

  describe('update', () => {
    it('should update a subject', async () => {
      const updatedSubject = {
        id: 'subject1',
        name: 'Updated Mathematics',
        exam_board_id: 'board1',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedSubject, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await subjectService.update('subject1', { name: 'Updated Mathematics' })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedSubject)
    })
  })

  describe('delete', () => {
    it('should delete a subject', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      const result = await subjectService.delete('subject1')

      expect(result.error).toBeNull()
    })
  })

  describe('bulkCreate', () => {
    it('should create multiple subjects', async () => {
      const mockSubjects = [
        { id: 'subject1', name: 'Mathematics', exam_board_id: 'board1' },
        { id: 'subject2', name: 'Physics', exam_board_id: 'board1' },
      ]

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockSubjects, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await subjectService.bulkCreate([
        { name: 'Mathematics', exam_board_id: 'board1' },
        { name: 'Physics', exam_board_id: 'board1' },
      ])

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubjects)
    })
  })
})

describe('topicService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should get all topics', async () => {
      const mockTopics = [
        { id: 'topic1', name: 'Algebra', subject_id: 'subject1' },
        { id: 'topic2', name: 'Geometry', subject_id: 'subject1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockTopics, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await topicService.getAll()

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockTopics)
    })
  })

  describe('getBySubject', () => {
    it('should get topics by subject', async () => {
      const mockTopics = [
        { id: 'topic1', name: 'Algebra', subject_id: 'subject1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockTopics, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await topicService.getBySubject('subject1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockTopics)
    })

    it('should return empty array for empty subjectId', async () => {
      const result = await topicService.getBySubject('')

      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })
  })

  describe('create', () => {
    it('should create a new topic', async () => {
      const mockTopic = {
        id: 'topic1',
        name: 'Algebra',
        subject_id: 'subject1',
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTopic, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await topicService.create({
        name: 'Algebra',
        subject_id: 'subject1',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockTopic)
    })
  })

  describe('update', () => {
    it('should update a topic', async () => {
      const updatedTopic = {
        id: 'topic1',
        name: 'Updated Algebra',
        subject_id: 'subject1',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedTopic, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await topicService.update('topic1', { name: 'Updated Algebra' })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedTopic)
    })
  })

  describe('delete', () => {
    it('should delete a topic', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      const result = await topicService.delete('topic1')

      expect(result.error).toBeNull()
    })
  })

  describe('bulkCreate', () => {
    it('should create multiple topics', async () => {
      const mockTopics = [
        { id: 'topic1', name: 'Algebra', subject_id: 'subject1' },
        { id: 'topic2', name: 'Geometry', subject_id: 'subject1' },
      ]

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockTopics, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await topicService.bulkCreate([
        { name: 'Algebra', subject_id: 'subject1' },
        { name: 'Geometry', subject_id: 'subject1' },
      ])

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockTopics)
    })
  })
})

describe('subtopicService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAll', () => {
    it('should get all subtopics', async () => {
      const mockSubtopics = [
        { id: 'subtopic1', name: 'Linear Equations', topic_id: 'topic1' },
        { id: 'subtopic2', name: 'Quadratic Equations', topic_id: 'topic1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: mockSubtopics, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await subtopicService.getAll()

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubtopics)
    })
  })

  describe('getByTopic', () => {
    it('should get subtopics by topic', async () => {
      const mockSubtopics = [
        { id: 'subtopic1', name: 'Linear Equations', topic_id: 'topic1' },
      ]

      const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockSubtopics, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect,
      } as any)

      const result = await subtopicService.getByTopic('topic1')

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubtopics)
    })

    it('should return empty array for empty topicId', async () => {
      const result = await subtopicService.getByTopic('')

      expect(result.error).toBeNull()
      expect(result.data).toEqual([])
    })
  })

  describe('create', () => {
    it('should create a new subtopic', async () => {
      const mockSubtopic = {
        id: 'subtopic1',
        name: 'Linear Equations',
        topic_id: 'topic1',
      }

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockSubtopic, error: null }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await subtopicService.create({
        name: 'Linear Equations',
        topic_id: 'topic1',
      })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubtopic)
    })
  })

  describe('update', () => {
    it('should update a subtopic', async () => {
      const updatedSubtopic = {
        id: 'subtopic1',
        name: 'Updated Linear Equations',
        topic_id: 'topic1',
      }

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedSubtopic, error: null }),
          }),
        }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        update: mockUpdate,
      } as any)

      const result = await subtopicService.update('subtopic1', { name: 'Updated Linear Equations' })

      expect(result.error).toBeNull()
      expect(result.data).toEqual(updatedSubtopic)
    })
  })

  describe('delete', () => {
    it('should delete a subtopic', async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        delete: mockDelete,
      } as any)

      const result = await subtopicService.delete('subtopic1')

      expect(result.error).toBeNull()
    })
  })

  describe('bulkCreate', () => {
    it('should create multiple subtopics', async () => {
      const mockSubtopics = [
        { id: 'subtopic1', name: 'Linear Equations', topic_id: 'topic1' },
        { id: 'subtopic2', name: 'Quadratic Equations', topic_id: 'topic1' },
      ]

      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockSubtopics, error: null }),
      })

      vi.mocked(supabase.from).mockReturnValue({
        insert: mockInsert,
      } as any)

      const result = await subtopicService.bulkCreate([
        { name: 'Linear Equations', topic_id: 'topic1' },
        { name: 'Quadratic Equations', topic_id: 'topic1' },
      ])

      expect(result.error).toBeNull()
      expect(result.data).toEqual(mockSubtopics)
    })
  })
})

