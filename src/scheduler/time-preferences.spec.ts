import {
  describeLectureOrder,
  describeSaturdayClasses,
  describeTimePreferences,
  type PreferenceClass,
  type PreferenceTeacher,
} from './time-preferences';

const amal: PreferenceTeacher = {
  id: 'prof-1',
  name: 'Dr. Amal Ben Salah',
  timePreference: 'MORNING',
};
const karim: PreferenceTeacher = {
  id: 'prof-2',
  name: 'Dr. Karim Haddad',
  timePreference: 'EVENING',
};
const sara: PreferenceTeacher = {
  id: 'prof-3',
  name: 'Dr. Sara Trabelsi',
  timePreference: 'NO_PREFERENCE',
};

function aClass(
  id: string,
  type: string,
  teacherId: string | null,
  code = 'DEV-101',
): PreferenceClass {
  return {
    id,
    type,
    assignedProfessorId: teacherId,
    courseOffering: { course: { code } },
  };
}

describe('describeTimePreferences', () => {
  it('says nothing when no teacher of the classes prefers a time of day', () => {
    const classes = [
      aClass('c1', 'LECTURE', 'prof-3'),
      aClass('c2', 'TD', null),
    ];

    expect(describeTimePreferences(classes, [sara], ['c1'])).toBe('');
  });

  it('says so when every such class is at the preferred time', () => {
    const one = [aClass('c1', 'LECTURE', 'prof-1')];
    const three = [
      aClass('c1', 'LECTURE', 'prof-1'),
      aClass('c2', 'TD', 'prof-2'),
      aClass('c3', 'TP', 'prof-3'),
      aClass('c4', 'TP', 'prof-2'),
    ];

    expect(describeTimePreferences(one, [amal], [])).toBe(
      'The class whose teacher prefers a time of day is at that time.',
    );
    expect(describeTimePreferences(three, [amal, karim, sara], [])).toBe(
      'All 3 classes whose teacher prefers a time of day are at that time.',
    );
  });

  it('names the classes that are not at the preferred time, with their teacher', () => {
    const classes = [
      aClass('c1', 'LECTURE', 'prof-1'),
      aClass('c2', 'TD', 'prof-2', 'DB-201'),
      aClass('c3', 'TP', 'prof-1'),
    ];

    expect(describeTimePreferences(classes, [amal, karim], ['c2'])).toBe(
      '2 of 3 classes whose teacher prefers a time of day are at that time. Not at that time: DB-201 TD (Dr. Karim Haddad prefers evenings).',
    );
    expect(
      describeTimePreferences(classes, [amal, karim], ['c1', 'c2', 'c3']),
    ).toBe(
      'None of the 3 classes whose teacher prefers a time of day is at that time: DEV-101 LECTURE (Dr. Amal Ben Salah prefers mornings), DB-201 TD (Dr. Karim Haddad prefers evenings), DEV-101 TP (Dr. Amal Ben Salah prefers mornings).',
    );
    expect(
      describeTimePreferences([aClass('c1', 'TD', 'prof-1')], [amal], ['c1']),
    ).toBe(
      'The class whose teacher prefers a time of day is not at that time: DEV-101 TD (Dr. Amal Ben Salah prefers mornings).',
    );
  });

  it('names five classes at most and counts the others', () => {
    const classes = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'].map((id) =>
      aClass(id, 'TD', 'prof-1', id.toUpperCase()),
    );

    const sentence = describeTimePreferences(
      classes,
      [amal],
      ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'],
    );

    expect(sentence).toBe(
      '1 of 8 classes whose teacher prefers a time of day are at that time. Not at that time: C1 TD (Dr. Amal Ben Salah prefers mornings), C2 TD (Dr. Amal Ben Salah prefers mornings), C3 TD (Dr. Amal Ben Salah prefers mornings), C4 TD (Dr. Amal Ben Salah prefers mornings), C5 TD (Dr. Amal Ben Salah prefers mornings), and 2 more.',
    );
  });

  it('leaves out classes without a teacher or whose teacher has no preference', () => {
    const classes = [
      aClass('c1', 'LECTURE', 'prof-1'),
      aClass('c2', 'TD', null),
      aClass('c3', 'TP', 'prof-3'),
      aClass('c4', 'TP', 'prof-gone'),
    ];

    expect(
      describeTimePreferences(classes, [amal, sara], ['c2', 'c3', 'c4']),
    ).toBe('The class whose teacher prefers a time of day is at that time.');
  });
});

describe('describeSaturdayClasses', () => {
  const classes = [
    aClass('c1', 'LECTURE', 'prof-1'),
    aClass('c2', 'TD', null, 'DB-201'),
    aClass('c3', 'TP', 'prof-2'),
  ];
  const on = (classId: string, dayOfWeek: string) => ({ classId, dayOfWeek });

  it('says nothing when no new class is on Saturday', () => {
    expect(
      describeSaturdayClasses(classes, [
        on('c1', 'MONDAY'),
        on('c2', 'FRIDAY'),
      ]),
    ).toBe('');
  });

  it('names the classes on Saturday', () => {
    expect(
      describeSaturdayClasses(classes, [
        on('c1', 'MONDAY'),
        on('c2', 'SATURDAY'),
        on('c3', 'TUESDAY'),
      ]),
    ).toBe(
      '1 class is on Saturday (DB-201 TD): no time from Monday to Friday was found for it.',
    );
    expect(
      describeSaturdayClasses(classes, [
        on('c1', 'SATURDAY'),
        on('c2', 'SATURDAY'),
        on('c3', 'TUESDAY'),
      ]),
    ).toBe(
      '2 classes are on Saturday (DEV-101 LECTURE, DB-201 TD): no time from Monday to Friday was found for them.',
    );
  });

  it('names five classes at most and counts the others', () => {
    const many = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((id) =>
      aClass(id, 'TD', null, id.toUpperCase()),
    );

    expect(
      describeSaturdayClasses(
        many,
        many.map((cls) => on(cls.id, 'SATURDAY')),
      ),
    ).toBe(
      '7 classes are on Saturday (C1 TD, C2 TD, C3 TD, C4 TD, C5 TD, and 2 more): no time from Monday to Friday was found for them.',
    );
  });
});

describe('describeLectureOrder', () => {
  const ofCohort = (cls: PreferenceClass, name: string) => ({
    ...cls,
    courseOffering: { ...cls.courseOffering, cohort: { name } },
  });
  const classes = [
    ofCohort(aClass('c1', 'LECTURE', 'prof-1'), 'SE - Year 1'),
    ofCohort(aClass('c2', 'TD', 'prof-2'), 'SE - Year 1'),
    ofCohort(aClass('c3', 'TP', 'prof-2'), 'SE - Year 2'),
  ];

  it('says nothing when every lecture comes first', () => {
    expect(describeLectureOrder(classes, [])).toBe('');
  });

  it('names the classes earlier in the week than their lecture, with their cohort', () => {
    expect(describeLectureOrder(classes, ['c2'])).toBe(
      '1 class is earlier in the week than the lecture of its course: DEV-101 TD (SE - Year 1).',
    );
    expect(describeLectureOrder(classes, ['c2', 'c3'])).toBe(
      '2 classes are earlier in the week than the lecture of their course: DEV-101 TD (SE - Year 1), DEV-101 TP (SE - Year 2).',
    );
  });
});
