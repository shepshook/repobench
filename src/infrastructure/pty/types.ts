export type PtyRequestType = 'spawn' | 'write' | 'close' | 'injectData';

export interface PtyRequest {
  type: PtyRequestType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  id: string;
}

export interface PtyResponseBase {
  type: 'response' | 'data' | 'exit' | 'error';
}

export interface PtyResponseSuccess extends PtyResponseBase {
  type: 'response';
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
}

export interface PtyResponseError extends PtyResponseBase {
  type: 'response';
  id: string;
  error: string;
}

export interface PtyResponseErrorWorker extends PtyResponseBase {
  type: 'error';
  error: string;
}

export interface PtyResponseData extends PtyResponseBase {
  type: 'data';
  data: Uint8Array;
}

export interface PtyResponseExit extends PtyResponseBase {
  type: 'exit';
  code: number;
}

export type PtyResponse = PtyResponseSuccess | PtyResponseError | PtyResponseData | PtyResponseExit | PtyResponseErrorWorker;
