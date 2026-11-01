import {
  findTeacherProblems,
  hoursText,
  refusalAdvice,
  timesOverlap,
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
