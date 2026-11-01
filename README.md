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
seat for each enrolled student and its equipment, the rules scheduler-brain
books rooms by. A new name or floor is always accepted.

`PATCH` and `DELETE` on `/campuses/:id`, `/buildings/:id` and `/floors/:id` change
or delete a place; a new `campusId` or `buildingId` moves a building or a floor. A
delete is refused (409, with the reason) while something is inside: a campus with
buildings, a building with floors or a floor with rooms. Otherwise the database
would delete everything inside along with it.

`POST /scheduler/generate` builds the timetable through scheduler-brain. When it
cannot, the answer says why, and the web app shows that message:

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
- `src/campuses/`, `src/buildings/` and `src/floors/`, `*.service.spec.ts`: changing
  and deleting campuses, buildings and floors.
- `src/prisma/prisma.service.spec.ts`: the message when `DATABASE_URL` is missing.
- `src/cors-origins.spec.ts`: reading `CORS_ORIGIN`.
- The other files, made by the Nest generator, check little more than that each
  controller and service can be created.

The Jest settings are in `package.json` (`"jest"`) and `test/jest-e2e.json`.
`moduleNameMapper` lets Jest load the Prisma client from `generated/prisma`, and
`test/jest-setup.ts` keeps dotenv from printing a line in every test file.
