import { setup, assign } from "xstate";

/** Stop reasons for the autosubmit machine. */
export type StopReason =
  | "cancelled"
  | "navigated"
  | "submit_failed"
  | "rate_limited"
  | "timeout"
  | "max_retries"
  | "recovery_failed";

/** Context for the autosubmit state machine. */
export interface AutosubmitContext {
  attempt: number;
  maxRetries: number;
  isExtend: boolean;
  sourceImageId: string | null;
  stopReason: StopReason | null;
}

/** Events for the autosubmit state machine. */
export type AutosubmitEvent =
  | { type: "START"; sourceImageId: string; maxRetries: number; isExtend?: boolean }
  | { type: "SUBMITTED" }
  | { type: "SUBMIT_FAILED" }
  | { type: "GENERATING" }
  | { type: "SUCCESS" }
  | { type: "MODERATED" }
  | { type: "RATE_LIMITED" }
  | { type: "TIMEOUT" }
  | { type: "RECOVERED" }
  | { type: "RECOVERY_FAILED" }
  | { type: "RETRY" }
  | { type: "CANCEL" }
  | { type: "NAVIGATED" };

/** XState v5 state machine for autosubmit workflow. */
export const autosubmitMachine = setup({
  types: {
    context: {} as AutosubmitContext,
    events: {} as AutosubmitEvent,
  },
  guards: {
    /** Returns true if more retry attempts are available. */
    canRetry: ({ context }) => context.attempt < context.maxRetries,

    /** Returns true if in extend mode and more retry attempts are available. */
    isExtendAndCanRetry: ({ context }) =>
      context.isExtend && context.attempt < context.maxRetries,

    /** Returns true if not in extend mode and more retry attempts are available. */
    isNotExtendAndCanRetry: ({ context }) =>
      !context.isExtend && context.attempt < context.maxRetries,
  },
  actions: {
    /** Initializes context from START event. */
    initializeContext: assign(({ event }) => {
      if (event.type !== "START") return {};
      return {
        sourceImageId: event.sourceImageId,
        maxRetries: event.maxRetries,
        isExtend: event.isExtend ?? false,
        attempt: 1,
        stopReason: null,
      };
    }),

    /** Increments the attempt counter. */
    incrementAttempt: assign({
      attempt: ({ context }) => context.attempt + 1,
    }),

    /** Sets the stop reason to cancelled. */
    setCancelled: assign({ stopReason: "cancelled" as const }),

    /** Sets the stop reason to navigated. */
    setNavigated: assign({ stopReason: "navigated" as const }),

    /** Sets the stop reason to submit_failed. */
    setSubmitFailed: assign({ stopReason: "submit_failed" as const }),

    /** Sets the stop reason to rate_limited. */
    setRateLimited: assign({ stopReason: "rate_limited" as const }),

    /** Sets the stop reason to timeout. */
    setTimeout: assign({ stopReason: "timeout" as const }),

    /** Sets the stop reason to max_retries. */
    setMaxRetries: assign({ stopReason: "max_retries" as const }),

    /** Sets the stop reason to recovery_failed. */
    setRecoveryFailed: assign({ stopReason: "recovery_failed" as const }),
  },
}).createMachine({
  id: "autosubmit",
  initial: "idle",
  context: {
    attempt: 0,
    maxRetries: 10,
    isExtend: false,
    sourceImageId: null,
    stopReason: null,
  },
  states: {
    idle: {
      on: {
        START: {
          target: "submitting",
          actions: "initializeContext",
        },
      },
    },

    submitting: {
      on: {
        SUBMITTED: "waitingForGeneration",
        SUBMIT_FAILED: {
          target: "stopped",
          actions: "setSubmitFailed",
        },
        CANCEL: {
          target: "stopped",
          actions: "setCancelled",
        },
        NAVIGATED: {
          target: "stopped",
          actions: "setNavigated",
        },
      },
    },

    waitingForGeneration: {
      on: {
        GENERATING: "generating",
        RATE_LIMITED: {
          target: "stopped",
          actions: "setRateLimited",
        },
        TIMEOUT: {
          target: "stopped",
          actions: "setTimeout",
        },
        CANCEL: {
          target: "stopped",
          actions: "setCancelled",
        },
        NAVIGATED: {
          target: "stopped",
          actions: "setNavigated",
        },
      },
    },

    generating: {
      on: {
        SUCCESS: "success",
        RATE_LIMITED: {
          target: "stopped",
          actions: "setRateLimited",
        },
        MODERATED: [
          {
            target: "recovering",
            guard: "isExtendAndCanRetry",
          },
          {
            target: "retrying",
            guard: "isNotExtendAndCanRetry",
          },
          {
            target: "stopped",
            actions: "setMaxRetries",
          },
        ],
        CANCEL: {
          target: "stopped",
          actions: "setCancelled",
        },
        NAVIGATED: {
          target: "stopped",
          actions: "setNavigated",
        },
      },
    },

    recovering: {
      on: {
        RECOVERED: "retrying",
        RECOVERY_FAILED: {
          target: "stopped",
          actions: "setRecoveryFailed",
        },
        CANCEL: {
          target: "stopped",
          actions: "setCancelled",
        },
        NAVIGATED: {
          target: "stopped",
          actions: "setNavigated",
        },
      },
    },

    retrying: {
      on: {
        RETRY: {
          target: "submitting",
          actions: "incrementAttempt",
        },
        CANCEL: {
          target: "stopped",
          actions: "setCancelled",
        },
        NAVIGATED: {
          target: "stopped",
          actions: "setNavigated",
        },
      },
    },

    success: {
      type: "final",
    },

    stopped: {
      type: "final",
    },
  },
});
