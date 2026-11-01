import {
  busiestTerm,
  findTeacherProblems,
  hoursText,
  refusalAdvice,
  timesOverlap,
  weeklyHours,
  type TeacherClass,
  type TeacherLimits,
} from './teacher-fit';

// Tests for the checks made before a teacher gets a class: the weekly hours,
// and the time of classes that are already in the timetable.

const amal: TeacherLimits = {
  name: 'Amal Ben Ali',
  maxHoursPerWeek: 12,
  unavailability: [],
};

// A class on a day and at a time, or not in the timetable (day null).
const lesson = (
  label: string,
  durationMinutes: number,
  dayOfWeek: string | null = null,
  startTime: string | null = null,
  endTime: string | null = null,
): TeacherClass => ({ label, durationMinutes, dayOfWeek, startTime, endTime });

const DEV = 'DEV-101 LECTURE for SE - Year 1';
const DB_TD = 'DB-201 TD for SE - Year 2';
const DB_TP = 'DB-201 TP for SE - Year 2';
const lecture = lesson(DEV, 90, 'MONDAY', '08:30', '10:00');
const at = (startTime: string, endTime: string) => ({ startTime, endTime });

describe('timesOverlap and hoursText', () => {
  it('sees shared minutes, but lets a class start when another ends', () => {
    expect(timesOverlap(at('08:30', '10:00'), at('09:30', '11:00'))).toBe(true);
    expect(timesOverlap(at('08:30', '10:00'), at('10:00', '11:30'))).toBe(
      false,
    );
  });

  it('writes the hours of a number of minutes', () => {
    expect(hoursText(60)).toBe('1 hour');
    expect(hoursText(810)).toBe('13.5 hours');
    expect(hoursText(720)).toBe('12 hours');
  });
});

describe('findTeacherProblems', () => {
  it('finds nothing when the teacher has the hours and the time', () => {
    const kept = [
      lesson(DB_TD, 120, 'MONDAY', '10:00', '12:00'),
      lesson(DB_TP, 120, 'TUESDAY', '08:30', '10:30'),
    ];

    expect(findTeacherProblems(amal, [lecture], kept, 'Fall 2026')).toEqual({
      time: [],
      hours: [],
    });
  });

  it('refuses a class at a time when the teacher teaches another one', () => {
    const kept = [lesson(DB_TD, 120, 'MONDAY', '09:00', '11:00')];

    expect(
      findTeacherProblems(amal, [lecture], kept, 'Fall 2026').time,
    ).toEqual([
      'Amal Ben Ali cannot teach DEV-101 LECTURE for SE - Year 1 on Monday from 08:30 to 10:00, because at that time Amal Ben Ali teaches DB-201 TD for SE - Year 2 (09:00 to 11:00).',
    ]);
  });

  it('refuses a class at a time when the teacher is not available', () => {
    const away: TeacherLimits = {
      ...amal,
      unavailability: [{ dayOfWeek: 'MONDAY', ...at('08:00', '12:00') }],
    };

    expect(findTeacherProblems(away, [lecture], [], 'Fall 2026').time).toEqual([
      'Amal Ben Ali cannot teach DEV-101 LECTURE for SE - Year 1 on Monday from 08:30 to 10:00, because Amal Ben Ali is not available on Monday from 08:00 to 12:00.',
    ]);
  });

  it('refuses two new classes at the same time', () => {
    const td = lesson(
      'DEV-101 TD for SE - Year 1',
      60,
      'MONDAY',
      '09:30',
      '10:30',
    );

    expect(
      findTeacherProblems(amal, [lecture, td], [], 'Fall 2026').time,
    ).toEqual([
      'Amal Ben Ali cannot teach DEV-101 TD for SE - Year 1 on Monday from 09:30 to 10:30, because at that time Amal Ben Ali would also teach DEV-101 LECTURE for SE - Year 1 (08:30 to 10:00).',
    ]);
  });

  it('counts every class of the term for the weekly hours, placed or not', () => {
    const limited: TeacherLimits = { ...amal, maxHoursPerWeek: 3 };
    const kept = [lesson(DB_TP, 120)];

    expect(findTeacherProblems(limited, [lecture], kept, 'Fall 2026')).toEqual({
      time: [],
      hours: [
        'Amal Ben Ali can teach at most 3 hours a week, but would teach 3.5 hours a week in Fall 2026 with this class.',
      ],
    });
  });

  it('accepts a class that reaches the maximum exactly', () => {
    const limited: TeacherLimits = { ...amal, maxHoursPerWeek: 3.5 };
    const kept = [lesson(DB_TP, 120)];

    expect(
      findTeacherProblems(limited, [lecture], kept, 'Fall 2026').hours,
    ).toEqual([]);
  });
});

// A class of minutes in a term, from one date to another.
const inTerm = (minutes: number, name: string, from: string, to: string) => ({
  durationMinutes: minutes,
  courseOffering: {
    term: { id: name, name, startDate: new Date(from), endDate: new Date(to) },
  },
});

describe('weeklyHours and busiestTerm', () => {
  it('adds up the classes of each term, with those of terms whose dates overlap', () => {
    const weeks = weeklyHours([
      inTerm(300, 'Summer 2027', '2027-06-01', '2027-07-31'),
      inTerm(90, 'Fall 2026', '2026-09-01', '2027-01-31'),
      inTerm(120, 'Winter School', '2027-01-10', '2027-02-10'),
      inTerm(180, 'Fall 2026', '2026-09-01', '2027-01-31'),
    ]);

    // In date order. Winter School shares January with Fall 2026, so both
    // count 90 + 120 + 180 minutes; Summer 2027 overlaps neither.
    expect(weeks).toEqual([
      { termId: 'Fall 2026', termName: 'Fall 2026', minutesPerWeek: 390 },
      {
        termId: 'Winter School',
        termName: 'Winter School',
        minutesPerWeek: 390,
      },
      { termId: 'Summer 2027', termName: 'Summer 2027', minutesPerWeek: 300 },
    ]);
    expect(busiestTerm(weeks)?.termName).toBe('Fall 2026');
  });

  it('counts a term that ends on the day another starts as the same weeks', () => {
    const weeks = weeklyHours([
      inTerm(60, 'Block A', '2026-09-01', '2026-10-15'),
      inTerm(90, 'Block B', '2026-10-15', '2026-12-01'),
    ]);

    expect(weeks.map((week) => week.minutesPerWeek)).toEqual([150, 150]);
  });

  it('lists terms that start on the same day by name', () => {
    const weeks = weeklyHours([
      inTerm(60, 'Year 2 Fall', '2026-09-01', '2027-01-31'),
      inTerm(90, 'Year 1 Fall', '2026-09-01', '2027-01-31'),
    ]);

    expect(weeks.map((week) => week.termName)).toEqual([
      'Year 1 Fall',
      'Year 2 Fall',
    ]);
  });

  it('finds the busiest term, and nothing for a teacher without classes', () => {
    const weeks = weeklyHours([
      inTerm(90, 'Fall 2026', '2026-09-01', '2027-01-31'),
      inTerm(240, 'Spring 2027', '2027-02-15', '2027-06-15'),
    ]);

    expect(busiestTerm(weeks)).toEqual({
      termId: 'Spring 2027',
      termName: 'Spring 2027',
      minutesPerWeek: 240,
    });
    expect(weeklyHours([])).toEqual([]);
    expect(busiestTerm([])).toBeUndefined();
  });
});

describe('refusalAdvice', () => {
  it('names the way out that fits the problems', () => {
    expect(refusalAdvice(false, false)).toBe('Choose another teacher.');
    expect(refusalAdvice(true, false)).toBe(
      'Choose another teacher, or raise the maximum hours on the Teachers page.',
    );
    expect(refusalAdvice(false, true)).toBe(
      'Choose another teacher, or clear the timetable and generate it again, so that the classes get times that suit their teachers.',
    );
    expect(refusalAdvice(true, true)).toBe(
      'Choose another teacher, raise the maximum hours on the Teachers page, or clear the timetable and generate it again, so that the classes get times that suit their teachers.',
    );
  });
});
