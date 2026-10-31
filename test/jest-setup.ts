// Runs before every test file (see "setupFiles" in package.json and in
// test/jest-e2e.json). src/prisma/prisma.service.ts loads .env with dotenv,
// and dotenv 17 prints a line each time; this keeps it out of the test output.
process.env.DOTENV_CONFIG_QUIET = 'true';
