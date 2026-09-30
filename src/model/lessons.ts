import type { Id, Lesson, StudyGroup } from './types'

/** Resolved teachers of a lesson: `lesson.teacherIds` when set, else the group's fixed teachers. */
export function lessonTeacherIds(group: Pick<StudyGroup, 'teacherIds'>, lesson: Pick<Lesson, 'teacherIds'>): Id[] {
  return lesson.teacherIds && lesson.teacherIds.length ? lesson.teacherIds : group.teacherIds
}

/** A group is "auto" when it has no fixed teacher (the solver assigns one). */
export function isAutoGroup(group: Pick<StudyGroup, 'teacherIds'>): boolean {
  return group.teacherIds.length === 0
}
