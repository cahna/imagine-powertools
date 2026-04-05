/** DOM operation errors. */
export type DomError =
  | { type: "element_not_found"; element: string }
  | { type: "menu_not_open"; menu: string }
  | { type: "timeout"; operation: string; ms: number }
  | { type: "invalid_state"; expected: string; actual: string };

/** Storage operation errors. */
export type StorageError =
  | { type: "not_found"; key: string }
  | { type: "read_failed"; message: string }
  | { type: "write_failed"; message: string };

/** Formats a DomError into a human-readable message. */
export function formatDomError(error: DomError): string {
  switch (error.type) {
    case "element_not_found":
      return `Element not found: ${error.element}`;
    case "menu_not_open":
      return `Menu not open: ${error.menu}`;
    case "timeout":
      return `Timeout waiting for ${error.operation} (${error.ms}ms)`;
    case "invalid_state":
      return `Invalid state: expected ${error.expected}, got ${error.actual}`;
  }
}

/** Formats a StorageError into a human-readable message. */
export function formatStorageError(error: StorageError): string {
  switch (error.type) {
    case "not_found":
      return `Not found: ${error.key}`;
    case "read_failed":
      return `Read failed: ${error.message}`;
    case "write_failed":
      return `Write failed: ${error.message}`;
  }
}
