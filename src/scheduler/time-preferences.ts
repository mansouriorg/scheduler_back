// What Generate says about the times of day teachers prefer (the "Time
// Preference" of the Teachers page). It is a wish, not a rule: scheduler-brain
// puts a class in the part of the day its teacher prefers when it can, and
// names the classes it placed outside it.

// The parts of the day, as the sentence names them (NO_PREFERENCE is none).
const PARTS_OF_DAY: Partial<Record<string, string>> = {
  MORNING: 'mornings',
  AFTERNOON: 'afternoons',
  EVENING: 'evenings',
};

// How many classes the sentence names before "and N more".
const NAMED = 5;

// The fields of a class and of a teacher that the sentence needs.
export type PreferenceClass = {
  id: string;
  type: string;
  assignedProfessorId: string | null;
  courseOffering: { course: { code: string } };
};

export type PreferenceTeacher = {
  id: string;
  name: string;
  timePreference: string;
};

// One or two sentences about the classes just placed whose teacher prefers a
// time of day: how many are at that time, and which are not (outside: their ids,
// from scheduler-brain). Empty when no such class was placed.
export function describeTimePreferences(
  classes: PreferenceClass[],
  teachers: PreferenceTeacher[],
  outside: string[],
): string {
  const teacherOf = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const outsideIds = new Set(outside);
  const wished: string[] = [];
  const missed: string[] = [];
  for (const cls of classes) {
    const teacher =
      cls.assignedProfessorId === null
        ? undefined
        : teacherOf.get(cls.assignedProfessorId);
    const part =
      teacher === undefined ? undefined : PARTS_OF_DAY[teacher.timePreference];
    if (teacher === undefined || part === undefined) {
      continue;
    }
    wished.push(cls.id);
    if (outsideIds.has(cls.id)) {
      missed.push(
        `${cls.courseOffering.course.code} ${cls.type} (${teacher.name} prefers ${part})`,
      );
    }
  }
  const count = wished.length;
  if (count === 0) {
    return '';
  }
  if (missed.length === 0) {
    return count === 1
      ? 'The class whose teacher prefers a time of day is at that time.'
      : `All ${count} classes whose teacher prefers a time of day are at that time.`;
  }
  const more = missed.length - NAMED;
  const names =
    missed.slice(0, NAMED).join(', ') + (more > 0 ? `, and ${more} more` : '');
  if (missed.length === count) {
    return count === 1
      ? `The class whose teacher prefers a time of day is not at that time: ${names}.`
      : `None of the ${count} classes whose teacher prefers a time of day is at that time: ${names}.`;
  }
  return `${count - missed.length} of ${count} classes whose teacher prefers a time of day are at that time. Not at that time: ${names}.`;
}
