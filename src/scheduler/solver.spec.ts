import { HttpStatus } from '@nestjs/common';
import { AxiosError, AxiosResponse } from 'axios';
import {
  DEFAULT_SOLVER_URL,
  describeSolverFailure,
  solverEndpoint,
  solverTimeoutMs,
} from './solver';

const SOLVE_URL = 'http://127.0.0.1:8000/solve';
const THIRTY_MINUTES = 30 * 60 * 1000;

describe('solverEndpoint', () => {
  it('uses the local scheduler-brain when SOLVER_URL is missing or empty', () => {
    expect(solverEndpoint(undefined)).toBe(`${DEFAULT_SOLVER_URL}/solve`);
    expect(solverEndpoint('   ')).toBe(`${DEFAULT_SOLVER_URL}/solve`);
  });

  it('adds /solve to SOLVER_URL, without spaces or a trailing slash', () => {
    expect(solverEndpoint(' http://brain.internal:9000/ ')).toBe(
      'http://brain.internal:9000/solve',
    );
  });
});

describe('solverTimeoutMs', () => {
  it('waits 30 minutes when SOLVER_TIMEOUT_SECONDS is missing', () => {
    expect(solverTimeoutMs(undefined)).toBe(THIRTY_MINUTES);
  });

  it('reads a whole number of seconds, and 0 for no limit', () => {
    expect(solverTimeoutMs('600')).toBe(600000);
    expect(solverTimeoutMs('0')).toBe(0);
  });

  it('ignores a value that is not a whole number of seconds', () => {
    expect(solverTimeoutMs('ten')).toBe(THIRTY_MINUTES);
    expect(solverTimeoutMs('-5')).toBe(THIRTY_MINUTES);
    expect(solverTimeoutMs('1.5')).toBe(THIRTY_MINUTES);
  });
});

describe('describeSolverFailure', () => {
  it('says that scheduler-brain cannot be reached when nothing answers', () => {
    const error = new AxiosError('connect ECONNREFUSED', 'ECONNREFUSED');

    const result = describeSolverFailure(error, SOLVE_URL, THIRTY_MINUTES);

    expect(result.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(result.message).toBe(
      'Cannot reach scheduler-brain at http://127.0.0.1:8000/solve. Start it, then try again.',
    );
  });

  it('says how long it waited when scheduler-brain is too slow', () => {
    const error = new AxiosError('timeout exceeded', 'ECONNABORTED');

    const slow = describeSolverFailure(error, SOLVE_URL, THIRTY_MINUTES);
    const short = describeSolverFailure(error, SOLVE_URL, 90000);

    expect(slow.getStatus()).toBe(HttpStatus.GATEWAY_TIMEOUT);
    expect(slow.message).toContain('did not answer within 30 minutes');
    expect(slow.message).toContain('SOLVER_TIMEOUT_SECONDS');
    expect(short.message).toContain('did not answer within 90 seconds');
  });

  it('reports the status when scheduler-brain answers with an error', () => {
    const error = new AxiosError('Request failed', 'ERR_BAD_REQUEST');
    error.response = { status: 422 } as AxiosResponse;

    const result = describeSolverFailure(error, SOLVE_URL, THIRTY_MINUTES);

    expect(result.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
    expect(result.message).toContain('answered with an error (HTTP 422)');
  });

  it('gives a general message for any other problem', () => {
    const result = describeSolverFailure(
      new Error('database is down'),
      SOLVE_URL,
      THIRTY_MINUTES,
    );

    expect(result.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(result.message).toBe(
      'Could not finish the timetable. The brain_server terminal shows the details.',
    );
  });
});
