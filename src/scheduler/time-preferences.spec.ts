import {
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
