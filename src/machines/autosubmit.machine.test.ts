import { describe, it, expect, vi, beforeEach } from "vitest";
import { createActor, waitFor } from "xstate";
import {
  autosubmitMachine,
  type AutosubmitContext,
  type AutosubmitEvent,
} from "./autosubmit.machine";

describe("autosubmitMachine", () => {
  describe("initial state", () => {
    it("starts in idle state", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("idle");
      expect(actor.getSnapshot().context.attempt).toBe(0);

      actor.stop();
    });

    it("has default context values", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      const ctx = actor.getSnapshot().context;
      expect(ctx.maxRetries).toBe(10);
      expect(ctx.isExtend).toBe(false);
      expect(ctx.sourceImageId).toBeNull();
      expect(ctx.stopReason).toBeNull();

      actor.stop();
    });
  });

  describe("START transition", () => {
    it("transitions from idle to submitting on START", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({
        type: "START",
        sourceImageId: "test-uuid",
        maxRetries: 5,
        isExtend: false,
      });

      expect(actor.getSnapshot().value).toBe("submitting");

      actor.stop();
    });

    it("initializes context from START event", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({
        type: "START",
        sourceImageId: "test-uuid",
        maxRetries: 5,
        isExtend: true,
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.sourceImageId).toBe("test-uuid");
      expect(ctx.maxRetries).toBe(5);
      expect(ctx.isExtend).toBe(true);
      expect(ctx.attempt).toBe(1);

      actor.stop();
    });
  });

  describe("submitting state", () => {
    it("transitions to waitingForGeneration on SUBMITTED", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      expect(actor.getSnapshot().value).toBe("submitting");

      actor.send({ type: "SUBMITTED" });
      expect(actor.getSnapshot().value).toBe("waitingForGeneration");

      actor.stop();
    });

    it("transitions to stopped on SUBMIT_FAILED", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMIT_FAILED" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("submit_failed");

      actor.stop();
    });
  });

  describe("waitingForGeneration state", () => {
    it("transitions to generating on GENERATING", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });

      expect(actor.getSnapshot().value).toBe("generating");

      actor.stop();
    });

    it("transitions to stopped on RATE_LIMITED", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "RATE_LIMITED" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("rate_limited");

      actor.stop();
    });

    it("transitions to stopped on TIMEOUT", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "TIMEOUT" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("timeout");

      actor.stop();
    });
  });

  describe("generating state", () => {
    it("transitions to success on SUCCESS", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "SUCCESS" });

      expect(actor.getSnapshot().value).toBe("success");

      actor.stop();
    });

    it("transitions to stopped on RATE_LIMITED", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "RATE_LIMITED" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("rate_limited");

      actor.stop();
    });

    it("transitions to retrying on MODERATED when canRetry", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      // Start with attempt 1, maxRetries 5
      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });

      expect(actor.getSnapshot().value).toBe("retrying");

      actor.stop();
    });

    it("transitions to stopped on MODERATED when max retries reached", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      // Start with attempt 1, maxRetries 1 (so this is the last attempt)
      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 1 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("max_retries");

      actor.stop();
    });

    it("transitions to recovering on MODERATED when isExtend and canRetry", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({
        type: "START",
        sourceImageId: "uuid",
        maxRetries: 5,
        isExtend: true,
      });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });

      expect(actor.getSnapshot().value).toBe("recovering");

      actor.stop();
    });
  });

  describe("recovering state", () => {
    it("transitions to retrying on RECOVERED", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({
        type: "START",
        sourceImageId: "uuid",
        maxRetries: 5,
        isExtend: true,
      });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });
      expect(actor.getSnapshot().value).toBe("recovering");

      actor.send({ type: "RECOVERED" });
      expect(actor.getSnapshot().value).toBe("retrying");

      actor.stop();
    });

    it("transitions to stopped on RECOVERY_FAILED", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({
        type: "START",
        sourceImageId: "uuid",
        maxRetries: 5,
        isExtend: true,
      });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });
      actor.send({ type: "RECOVERY_FAILED" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("recovery_failed");

      actor.stop();
    });
  });

  describe("retrying state", () => {
    it("transitions to submitting on RETRY", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });
      expect(actor.getSnapshot().value).toBe("retrying");

      actor.send({ type: "RETRY" });
      expect(actor.getSnapshot().value).toBe("submitting");

      actor.stop();
    });

    it("increments attempt on RETRY", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      expect(actor.getSnapshot().context.attempt).toBe(1);

      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });
      actor.send({ type: "RETRY" });

      expect(actor.getSnapshot().context.attempt).toBe(2);

      actor.stop();
    });
  });

  describe("CANCEL event", () => {
    it("transitions to stopped with cancelled reason from any running state", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "CANCEL" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("cancelled");

      actor.stop();
    });

    it("can cancel from generating state", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "CANCEL" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("cancelled");

      actor.stop();
    });

    it("can cancel from recovering state", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({
        type: "START",
        sourceImageId: "uuid",
        maxRetries: 5,
        isExtend: true,
      });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });
      expect(actor.getSnapshot().value).toBe("recovering");

      actor.send({ type: "CANCEL" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("cancelled");

      actor.stop();
    });
  });

  describe("NAVIGATED event", () => {
    it("transitions to stopped with navigated reason", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "NAVIGATED" });

      expect(actor.getSnapshot().value).toBe("stopped");
      expect(actor.getSnapshot().context.stopReason).toBe("navigated");

      actor.stop();
    });
  });

  describe("final states", () => {
    it("success is a final state", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "SUCCESS" });

      expect(actor.getSnapshot().status).toBe("done");

      actor.stop();
    });

    it("stopped is a final state", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 5 });
      actor.send({ type: "CANCEL" });

      expect(actor.getSnapshot().status).toBe("done");

      actor.stop();
    });
  });

  describe("happy path - full cycle", () => {
    it("completes successfully: idle -> submitting -> waitingForGeneration -> generating -> success", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      expect(actor.getSnapshot().value).toBe("idle");

      actor.send({ type: "START", sourceImageId: "test-uuid", maxRetries: 5 });
      expect(actor.getSnapshot().value).toBe("submitting");

      actor.send({ type: "SUBMITTED" });
      expect(actor.getSnapshot().value).toBe("waitingForGeneration");

      actor.send({ type: "GENERATING" });
      expect(actor.getSnapshot().value).toBe("generating");

      actor.send({ type: "SUCCESS" });
      expect(actor.getSnapshot().value).toBe("success");
      expect(actor.getSnapshot().status).toBe("done");

      actor.stop();
    });
  });

  describe("retry cycle", () => {
    it("retries after moderation and eventually succeeds", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      // First attempt - moderated
      actor.send({ type: "START", sourceImageId: "uuid", maxRetries: 3 });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });
      expect(actor.getSnapshot().value).toBe("retrying");
      expect(actor.getSnapshot().context.attempt).toBe(1);

      // Second attempt - moderated again
      actor.send({ type: "RETRY" });
      expect(actor.getSnapshot().context.attempt).toBe(2);
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });
      expect(actor.getSnapshot().value).toBe("retrying");

      // Third attempt - success
      actor.send({ type: "RETRY" });
      expect(actor.getSnapshot().context.attempt).toBe(3);
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "SUCCESS" });
      expect(actor.getSnapshot().value).toBe("success");

      actor.stop();
    });
  });

  describe("extend mode recovery cycle", () => {
    it("recovers extend mode after moderation", () => {
      const actor = createActor(autosubmitMachine);
      actor.start();

      // Start in extend mode
      actor.send({
        type: "START",
        sourceImageId: "uuid",
        maxRetries: 3,
        isExtend: true,
      });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "MODERATED" });

      // Should go to recovering (not retrying) for extend mode
      expect(actor.getSnapshot().value).toBe("recovering");

      // Recovery completes
      actor.send({ type: "RECOVERED" });
      expect(actor.getSnapshot().value).toBe("retrying");

      // Retry and succeed
      actor.send({ type: "RETRY" });
      actor.send({ type: "SUBMITTED" });
      actor.send({ type: "GENERATING" });
      actor.send({ type: "SUCCESS" });
      expect(actor.getSnapshot().value).toBe("success");

      actor.stop();
    });
  });
});
