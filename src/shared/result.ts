import { Result, ok, err } from "neverthrow";
export { Result, ok, err, ResultAsync, okAsync, errAsync } from "neverthrow";

/** JSON-serializable Result format for Chrome messaging. */
export type SerializedResult<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** Converts a Result to a JSON-serializable format for Chrome messaging. */
export function serialize<T, E>(result: Result<T, E>): SerializedResult<T, E> {
  return result.match(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  );
}

/** Converts a serialized Result back to a neverthrow Result. */
export function deserialize<T, E>(data: SerializedResult<T, E>): Result<T, E> {
  return data.ok ? ok(data.value) : err(data.error);
}
