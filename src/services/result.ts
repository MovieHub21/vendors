export type Result<T = undefined> = { ok: true; data: T } | { ok: false; message: string; code: string };
export const ok = <T>(data: T): Result<T> => ({ ok: true, data });
export const fail = (code: string, message: string): Result<never> => ({ ok: false, code, message });
