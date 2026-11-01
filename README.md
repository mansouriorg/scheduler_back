# brain_server

The API of the university scheduler, built with NestJS 11 and Prisma 7 on PostgreSQL.
It stores campuses, buildings, floors, rooms, professors, cohorts, terms, courses and
course offerings. To build a timetable it sends this data to scheduler-brain (the
Python solver) and saves the answer.

## Requirements

- Node.js and pnpm (developed with Node.js 24.19 and pnpm 10.17)
- PostgreSQL
- scheduler-brain running, for timetable generation

## Setup

Run these once, inside this folder:

    pnpm install
    cp .env.example .env
    pnpm prisma generate
    pnpm prisma migrate deploy

- Edit `.env` after copying it: at least `DATABASE_URL`.
- `prisma generate` writes the database client to `generated/prisma`.
- `prisma migrate deploy` creates the tables from `prisma/migrations`.

## Run

    pnpm start:dev

The API listens on http://localhost:3001 (or on `PORT`) and reloads on every change.

## Settings (.env)

| Name                     | Meaning                                                        | Default                 |
|--------------------------|----------------------------------------------------------------|-------------------------|
| `DATABASE_URL`           | PostgreSQL connection string                                   | none, required          |
| `PORT`                   | port of this API                                               | `3001`                  |
| `CORS_ORIGIN`            | web addresses allowed to call the API, separated by commas     | `http://localhost:3000` |
| `SOLVER_URL`             | address of scheduler-brain; timetables are sent to `.../solve` | `http://127.0.0.1:8000` |
| `SOLVER_TIMEOUT_SECONDS` | how long to wait for scheduler-brain; `0` means no limit       | `1800` (30 minutes)     |

Example for a deployed web app plus local development:

    CORS_ORIGIN=http://localhost:3000,https://admin.example.edu

## Resources

Each folder in `src/` holds one resource with its controller, service and DTOs:
`campuses`, `buildings`, `floors`, `rooms`, `professors`, `cohorts`, `terms`,
`courses`, `course-offerings`.

`PATCH /professors/:id` changes the fields that are sent, and
`DELETE /professors/:id` deletes a teacher. A delete is refused (409, with the
reason) while classes are assigned to the teacher, so no class loses its teacher.

`PATCH /rooms/:id` and `DELETE /rooms/:id` do the same for rooms. While classes
are booked in a room, it cannot be deleted, and a change is refused (409, with
the reason) when a booked class would no longer fit: it needs its room type, a
seat for each of its students and its equipment, the rules scheduler-brain books
rooms by. A new name or floor is always accepted.

A class has as many students as the headcount of its cohort, or as are enrolled
in its course offering when there are more (`src/common/room-fit.ts`). The app
does not enroll students yet, so the headcount is what usually counts. That is
why `PATCH /cohorts/:id` refuses a larger headcount (409, with the reason) when a
class of the cohort is booked in a room that would then be too small.

`PATCH` and `DELETE` on `/campuses/:id`, `/buildings/:id` and `/floors/:id` change
or delete a place; a new `campusId` or `buildingId` moves a building or a floor. A
delete is refused (409, with the reason) while something is inside: a campus with
buildings, a building with floors or a floor with rooms. Otherwise the database
would delete everything inside along with it.

`PATCH /cohorts/:id` changes a cohort, and `DELETE /cohorts/:id` deletes one that
has no course offerings and no students. Otherwise the delete is refused (409, with
the reason): the database would delete its course offerings and their classes, and
it cannot delete a cohort that students belong to.

`PATCH /terms/:id` changes a term; the end date must stay after the start date (400
otherwise). `DELETE /terms/:id` deletes a term without course offerings. Otherwise
the delete is refused (409, with the reason), because the database would delete its
course offerings and their classes along with it.

`PATCH /courses/:id` changes a course. The hours of its parts must still add up to
the course hours (400 otherwise), and the code must not belong to another course
(409). Sent parts (`componentsTemplate`) replace the old ones. A course offering
copies the parts into its classes when it is created, so existing offerings keep
their classes and only new offerings use the changed parts. `DELETE /courses/:id`
deletes a course without course offerings. Otherwise the delete is refused (409,
with the reason), because the database would delete its course offerings and their
classes along with it.

`POST /course-offerings` refuses (409) a course that the cohort already has in that
term. `PATCH /course-offerings/:id` moves an offering to another term or cohort; its
course cannot change (400), because its classes were made from that course. A move
takes the offering's classes out of the timetable (their rooms and times were chosen
for the old term and cohort); generating the timetable places them again.
`DELETE /course-offerings/:id` deletes an offering together with its classes. It is
refused (409, with the reason) while students are enrolled, because their enrollment
would be lost and the app cannot enroll students yet.

`POST /scheduler/generate` builds the timetable through scheduler-brain. When it
cannot, the answer says why, and the web app shows that message:

- 400: some classes fit in no room (wrong type, too few seats or missing
  equipment); the message names them, and scheduler-brain is not called.
- 400: no timetable is possible; the message is scheduler-brain's own reason.
- 502: scheduler-brain answered with an error; its terminal shows the details.
- 503: scheduler-brain cannot be reached at `SOLVER_URL`.
- 504: scheduler-brain did not answer within `SOLVER_TIMEOUT_SECONDS`.
- 500: anything else, for example a failed save.

The timetable is saved in one database transaction: if saving fails, no class
is changed.

The data model is in `prisma/schema.prisma`.

## Scripts

| Command                   | What it does                                  |
|---------------------------|-----------------------------------------------|
| `pnpm start:dev`          | run the API and reload on change              |
| `pnpm build`              | compile to `dist/`                            |
| `pnpm test`               | unit tests (Jest, files ending in `.spec.ts`) |
| `pnpm exec jest NAME`     | only the tests whose file name contains NAME  |
| `pnpm test:e2e`           | end-to-end tests; they need the database      |
| `pnpm lint`               | ESLint; note that it also fixes files         |
| `pnpm format`             | Prettier; rewrites the files in `src/`        |

## Tests

`pnpm test` runs the unit tests in `src/`. They need neither the database nor
scheduler-brain: PrismaService and the call to scheduler-brain are replaced by
stand-ins.

- `src/scheduler/scheduler.service.spec.ts`: timetable generation (which classes
  are picked, the data sent to scheduler-brain, how its answer is saved in one
  transaction, its reason when no timetable is possible, and the errors when it
  cannot be reached or saving fails).
- `src/scheduler/solver.spec.ts`: the `SOLVER_URL` and `SOLVER_TIMEOUT_SECONDS`
  settings, and the error messages listed under Resources.
- `src/professors/professors.service.spec.ts`: changing and deleting teachers.
- `src/rooms/rooms.service.spec.ts`: changing and deleting rooms.
- `src/common/room-fit.spec.ts`: the class size and which room a class fits in.
- `src/campuses/`, `src/buildings/` and `src/floors/`, `*.service.spec.ts`: changing
  and deleting campuses, buildings and floors.
- `src/cohorts/cohorts.service.spec.ts`: changing and deleting cohorts.
- `src/terms/terms.service.spec.ts`: changing and deleting terms.
- `src/courses/courses.service.spec.ts`: changing and deleting courses.
- `src/course-offerings/course-offerings.service.spec.ts`: adding, moving and
  deleting course offerings.
- `src/prisma/prisma.service.spec.ts`: the message when `DATABASE_URL` is missing.
- `src/cors-origins.spec.ts`: reading `CORS_ORIGIN`.
- The other files, made by the Nest generator, check little more than that each
  controller and service can be created.

The Jest settings are in `package.json` (`"jest"`) and `test/jest-e2e.json`.
`moduleNameMapper` lets Jest load the Prisma client from `generated/prisma`, and
`test/jest-setup.ts` keeps dotenv from printing a line in every test file.
