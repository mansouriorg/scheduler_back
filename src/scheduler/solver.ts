import { HttpException, HttpStatus } from '@nestjs/common';
import { isAxiosError } from 'axios';
import type { DayOfWeek } from 'generated/prisma/client';

// Settings and error messages for the call to scheduler-brain (the Python solver).

export const DEFAULT_SOLVER_URL = 'http://127.0.0.1:8000';
export const DEFAULT_SOLVER_TIMEOUT_SECONDS = 1800;

// What scheduler-brain answers to /solve (the fields this API uses).
export type ScheduledClass = {
  classId: string;
  roomId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
};

export type SolverAnswer = {
  success: boolean;
  message?: string;
  scheduledClasses: ScheduledClass[];
  // The classes placed (partly) outside the time of day their teacher prefers.
  outsidePreference?: string[];
};

// The /solve address of scheduler-brain, from SOLVER_URL (for example
// http://127.0.0.1:8000). Spaces and a trailing slash are ignored.
export function solverEndpoint(value: string | undefined): string {
  const base = (value ?? '').trim().replace(/\/+$/, '');
  return `${base || DEFAULT_SOLVER_URL}/solve`;
}

// How long to wait for scheduler-brain, in milliseconds, from
// SOLVER_TIMEOUT_SECONDS. 0 means no limit. A missing or invalid value
// (not a whole number of seconds) means the default, 30 minutes.
export function solverTimeoutMs(value: string | undefined): number {
  const text = (value ?? '').trim();
  const seconds = /^\d+$/.test(text)
    ? Number(text)
    : DEFAULT_SOLVER_TIMEOUT_SECONDS;
  return seconds * 1000;
}

// "30 minutes", "1 minute", "90 seconds".
function describeDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds >= 60 && seconds % 60 === 0) {
    const minutes = seconds / 60;
    return minutes === 1 ? '1 minute' : `${minutes} minutes`;
  }
  return seconds === 1 ? '1 second' : `${seconds} seconds`;
}

// What the brain_server terminal shows when the call to scheduler-brain failed:
// the answer of scheduler-brain when it sent one, or else the error message.
export function solverErrorDetail(error: unknown): unknown {
  if (isAxiosError(error)) {
    const answer: unknown = error.response?.data;
    if (answer) {
      return answer;
    }
  }
  return error instanceof Error ? error.message : error;
}

// Turns a failed call to scheduler-brain into an error whose message says what
// went wrong and what to do. The web app shows this message as it is.
export function describeSolverFailure(
  error: unknown,
  solverUrl: string,
  timeoutMs: number,
): HttpException {
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' && timeoutMs > 0) {
      return new HttpException(
        `scheduler-brain did not answer within ${describeDuration(timeoutMs)}. Try again, or raise SOLVER_TIMEOUT_SECONDS in the .env file of brain_server.`,
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }
    if (error.response) {
      return new HttpException(
        `scheduler-brain answered with an error (HTTP ${error.response.status}). Its terminal shows the details.`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    return new HttpException(
      `Cannot reach scheduler-brain at ${solverUrl}. Start it, then try again.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
  return new HttpException(
    'Could not finish the timetable. The brain_server terminal shows the details.',
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
