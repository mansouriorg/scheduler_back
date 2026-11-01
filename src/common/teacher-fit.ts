// Checks whether a teacher can take on some classes: the hours they may teach
// in a week and, for classes already in the timetable, whether they are free.

// A class as these checks see it. The day and times are null while the class
// is not in the timetable.
export type TeacherClass = {
  label: string; // for example "DEV-101 LECTURE for SE - Year 1"
  durationMinutes: number;
  dayOfWeek: string | null;
  startTime: string | null; // "HH:mm"
  endTime: string | null;
};

// A day and the times on it, "HH:mm".
type When = { dayOfWeek: string; startTime: string; endTime: string };

export type TeacherLimits = {
  name: string;
  maxHoursPerWeek: number;
  unavailability: When[];
};

// What stops a teacher from taking on the classes, one sentence each.
export type TeacherProblems = { time: string[]; hours: string[] };

// "MONDAY" -> "Monday".
export function dayName(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

// Minutes since midnight of an "HH:mm" time.
function minutesOf(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// True when two times on the same day overlap. A class that ends at 10:00 and
// one that starts at 10:00 do not.
export function timesOverlap(
  a: { startTime: string; endTime: string },
  b: { startTime: string; endTime: string },
): boolean {
  return (
    minutesOf(a.startTime) < minutesOf(b.endTime) &&
    minutesOf(b.startTime) < minutesOf(a.endTime)
  );
}

// "1 hour", "13.5 hours".
export function hoursText(minutes: number): string {
  const hours = Number((minutes / 60).toFixed(2));
  return hours === 1 ? '1 hour' : `${hours} hours`;
}

// A class that is in the timetable: it has a day and times.
type Placed = TeacherClass & When;

const isPlaced = (cls: TeacherClass): cls is Placed =>
  cls.dayOfWeek !== null && cls.startTime !== null && cls.endTime !== null;

// added: the classes the teacher would get. kept: the classes the teacher
// already teaches in the same weeks (terms whose dates overlap). termName
// names the term of the added classes.
export function findTeacherProblems(
  teacher: TeacherLimits,
  added: TeacherClass[],
  kept: TeacherClass[],
  termName: string,
): TeacherProblems {
  const time: string[] = [];
  const name = teacher.name;
  const keptPlaced = kept.filter(isPlaced);
  const addedPlaced: Placed[] = [];

  // A class in the timetable keeps its day and time: the teacher must be
  // available then, and must not teach another class at that time. One
  // reason per class is enough.
  for (const cls of added.filter(isPlaced)) {
    const when = `on ${dayName(cls.dayOfWeek)} from ${cls.startTime} to ${cls.endTime}`;
    const sameDay = (other: When) =>
      other.dayOfWeek === cls.dayOfWeek && timesOverlap(other, cls);
    const away = teacher.unavailability.find(sameDay);
    const busy = keptPlaced.find(sameDay);
    const twice = addedPlaced.find(sameDay);
    if (away !== undefined) {
      time.push(
        `${name} cannot teach ${cls.label} ${when}, because ${name} is not available on ${dayName(away.dayOfWeek)} from ${away.startTime} to ${away.endTime}.`,
      );
    } else if (busy !== undefined) {
      time.push(
        `${name} cannot teach ${cls.label} ${when}, because at that time ${name} teaches ${busy.label} (${busy.startTime} to ${busy.endTime}).`,
      );
    } else if (twice !== undefined) {
      time.push(
        `${name} cannot teach ${cls.label} ${when}, because at that time ${name} would also teach ${twice.label} (${twice.startTime} to ${twice.endTime}).`,
      );
    }
    addedPlaced.push(cls);
  }

  // Every class takes place every week, so all of them count, whether they
  // are in the timetable yet or not.
  const hours: string[] = [];
  const total = [...added, ...kept].reduce(
    (sum, cls) => sum + cls.durationMinutes,
    0,
  );
  if (total > teacher.maxHoursPerWeek * 60) {
    const these = added.length === 1 ? 'this class' : 'these classes';
    hours.push(
      `${name} can teach at most ${hoursText(teacher.maxHoursPerWeek * 60)} a week, but would teach ${hoursText(total)} a week in ${termName} with ${these}.`,
    );
  }
  return { time, hours };
}

// What to do after a refusal: always another teacher; more hours when the
// hours were the problem; new times when the time was.
export function refusalAdvice(hours: boolean, time: boolean): string {
  const ways = ['Choose another teacher'];
  if (hours) {
    ways.push('raise the maximum hours on the Teachers page');
  }
  if (time) {
    ways.push(
      'clear the timetable and generate it again, so that the classes get times that suit their teachers',
    );
  }
  if (ways.length === 1) {
    return `${ways[0]}.`;
  }
  return `${ways.slice(0, -1).join(', ')}, or ${ways[ways.length - 1]}.`;
}
