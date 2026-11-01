import type { Equipment, RoomType } from 'generated/prisma/enums';

// Which room a class can have, by the same rule scheduler-brain uses: the room
// type the class needs, a seat for each of its students and all the equipment
// it needs.

// The names the web app shows for room types and equipment.
export const ROOM_TYPE_NAMES: Record<RoomType, string> = {
  AMPHI: 'Amphi',
  CLASSROOM: 'Classroom',
  COMPUTER_LAB: 'Computer Lab',
  WORKSHOP: 'Workshop',
  CHEMISTRY_LAB: 'Chemistry Lab',
};

export const EQUIPMENT_NAMES: Record<Equipment, string> = {
  COMPUTERS: 'PC Computers',
  MAC_COMPUTERS: 'Mac Computers',
  PROJECTOR: 'Projector',
  CHEMISTRY_HOOD: 'Chemistry Hood',
  WHITEBOARD: 'Whiteboard',
  SMARTBOARD: 'Smartboard',
};

// How many students a class has: the headcount of its cohort, or the number of
// students enrolled in its course offering when that is larger. The app does
// not enroll students yet, so the headcount is what usually counts.
export function classSize(cohortHeadcount: number, enrolled: number): number {
  return Math.max(cohortHeadcount, enrolled);
}

export type RoomForFit = {
  roomType: RoomType;
  capacity: number;
  equipment: Equipment[];
};

export type ClassForFit = {
  label: string; // for example "DEV-101 TP for SE - Year 1"
  size: number;
  requiresRoomType: RoomType;
  requiredEquipment: Equipment[];
};

const hasEquipment = (room: RoomForFit, needs: ClassForFit) =>
  needs.requiredEquipment.every((item) => room.equipment.includes(item));

export function roomFits(room: RoomForFit, needs: ClassForFit): boolean {
  return (
    room.roomType === needs.requiresRoomType &&
    room.capacity >= needs.size &&
    hasEquipment(room, needs)
  );
}

// The most classes the message below names one by one.
const MOST_LISTED = 5;

// Says why the timetable cannot be made when some classes fit in no room, or
// returns null when every class fits in at least one room.
export function describeClassesWithoutRoom(
  classes: ClassForFit[],
  rooms: RoomForFit[],
): string | null {
  const homeless = classes.filter((c) =>
    rooms.every((room) => roomFits(room, c) === false),
  );
  if (homeless.length === 0) {
    return null;
  }
  const count =
    homeless.length === 1
      ? '1 class has no room it fits in'
      : `${homeless.length} classes have no room they fit in`;
  const reasons = homeless
    .slice(0, MOST_LISTED)
    .map((c) => whyNoRoomFits(c, rooms));
  const rest = homeless.length - MOST_LISTED;
  if (rest > 0) {
    reasons.push(
      rest === 1
        ? '1 more class has no room either.'
        : `${rest} more classes have no room either.`,
    );
  }
  return [
    `The timetable cannot be made, because ${count}.`,
    ...reasons,
    'Add or change rooms on the Classrooms page, or check the headcount of the cohorts.',
  ].join(' ');
}

// One sentence about a class that fits in no room.
function whyNoRoomFits(needs: ClassForFit, rooms: RoomForFit[]): string {
  const type = `a room of type "${ROOM_TYPE_NAMES[needs.requiresRoomType]}"`;
  const ofType = rooms.filter(
    (room) => room.roomType === needs.requiresRoomType,
  );
  if (ofType.length === 0) {
    return `${needs.label} needs ${type}, and there is none.`;
  }
  const equipment = joinNames(
    needs.requiredEquipment.map((item) => EQUIPMENT_NAMES[item]),
  );
  const withEquipment = equipment === '' ? '' : ` with ${equipment}`;
  const equipped = ofType.filter((room) => hasEquipment(room, needs));
  if (equipped.length === 0) {
    return `${needs.label} needs ${type}${withEquipment}, and there is none.`;
  }
  const largest = Math.max(...equipped.map((room) => room.capacity));
  return `${needs.label} has ${needs.size} students, but the largest room of type "${ROOM_TYPE_NAMES[needs.requiresRoomType]}"${withEquipment} has ${largest} seats.`;
}

// "A", "A and B", "A, B and C".
export function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
