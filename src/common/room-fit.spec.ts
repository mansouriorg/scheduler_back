import {
  classSize,
  describeClassesWithoutRoom,
  roomFits,
  type ClassForFit,
  type RoomForFit,
} from './room-fit';

// Tests for the room rule that timetable generation, rooms and cohorts share.

const lab: RoomForFit = {
  roomType: 'COMPUTER_LAB',
  capacity: 30,
  equipment: ['COMPUTERS', 'PROJECTOR'],
};

const amphi: RoomForFit = {
  roomType: 'AMPHI',
  capacity: 200,
  equipment: ['PROJECTOR'],
};

const tp = (
  size: number,
  label = 'DEV-101 TP for SE - Year 1',
): ClassForFit => ({
  label,
  size,
  requiresRoomType: 'COMPUTER_LAB',
  requiredEquipment: ['COMPUTERS'],
});

describe('classSize', () => {
  it('is the headcount, or the enrolled students when there are more', () => {
    expect(classSize(45, 0)).toBe(45);
    expect(classSize(45, 50)).toBe(50);
  });
});

describe('roomFits', () => {
  it('needs the room type, a seat for each student and the equipment', () => {
    expect(roomFits(lab, tp(30))).toBe(true);
    expect(roomFits(lab, tp(31))).toBe(false);
    expect(roomFits(amphi, tp(30))).toBe(false);
    expect(
      roomFits(lab, { ...tp(30), requiredEquipment: ['MAC_COMPUTERS'] }),
    ).toBe(false);
  });
});

describe('describeClassesWithoutRoom', () => {
  it('says nothing when every class fits in a room', () => {
    expect(describeClassesWithoutRoom([tp(30)], [amphi, lab])).toBeNull();
  });

  it('names a class that is bigger than every room that fits it otherwise', () => {
    const bigLab = { ...lab, capacity: 40 };
    const noProjector = { ...lab, capacity: 60, equipment: [] };

    expect(
      describeClassesWithoutRoom([tp(45)], [lab, bigLab, noProjector, amphi]),
    ).toBe(
      'The timetable cannot be made, because 1 class has no room it fits in. ' +
        'DEV-101 TP for SE - Year 1 has 45 students, but the largest room of type "Computer Lab" with PC Computers has 40 seats. ' +
        'Add or change rooms on the Classrooms page, or check the headcount of the cohorts.',
    );
  });

  it('names a class whose room type or equipment no room has', () => {
    const workshop: ClassForFit = {
      label: 'MEC-110 TP for ME - Year 1',
      size: 20,
      requiresRoomType: 'WORKSHOP',
      requiredEquipment: [],
    };
    const mac = {
      ...tp(20, 'IOS-301 TP for SE - Year 3'),
      requiredEquipment: [
        'MAC_COMPUTERS',
        'PROJECTOR',
      ] as RoomForFit['equipment'],
    };

    expect(describeClassesWithoutRoom([workshop, mac], [lab, amphi])).toBe(
      'The timetable cannot be made, because 2 classes have no room they fit in. ' +
        'MEC-110 TP for ME - Year 1 needs a room of type "Workshop", and there is none. ' +
        'IOS-301 TP for SE - Year 3 needs a room of type "Computer Lab" with Mac Computers and Projector, and there is none. ' +
        'Add or change rooms on the Classrooms page, or check the headcount of the cohorts.',
    );
  });

  it('names 5 classes and counts the others', () => {
    const classes = [1, 2, 3, 4, 5, 6, 7].map((n) =>
      tp(45, `DEV-10${n} TP for SE - Year 1`),
    );

    const message = describeClassesWithoutRoom(classes, [lab]) ?? '';

    expect(message).toContain('because 7 classes have no room they fit in.');
    expect(message).toContain('DEV-105 TP for SE - Year 1 has 45 students');
    expect(message).not.toContain('DEV-106');
    expect(message).toContain('2 more classes have no room either.');
  });
});
