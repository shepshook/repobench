export class SessionCrashedError extends Error {
  constructor(message: string = 'The session has crashed and is no longer responsive.') {
    super(message);
    this.name = 'SessionCrashedError';
  }
}
