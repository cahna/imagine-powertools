import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getInterceptEnabled,
  setInterceptEnabled,
  onInterceptEnabledChange,
} from "./interceptSettings";

describe("interceptSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getInterceptEnabled", () => {
    it("returns false when not set", async () => {
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue(
        {},
      );
      const enabled = await getInterceptEnabled();
      expect(enabled).toBe(false);
    });

    it("returns true when set to true", async () => {
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        interceptEnabled: true,
      });
      const enabled = await getInterceptEnabled();
      expect(enabled).toBe(true);
    });

    it("returns false when set to false", async () => {
      (chrome.storage.local.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        interceptEnabled: false,
      });
      const enabled = await getInterceptEnabled();
      expect(enabled).toBe(false);
    });
  });

  describe("setInterceptEnabled", () => {
    it("stores true value", async () => {
      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      await setInterceptEnabled(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        interceptEnabled: true,
      });
    });

    it("stores false value", async () => {
      vi.mocked(chrome.storage.local.set).mockResolvedValue();
      await setInterceptEnabled(false);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        interceptEnabled: false,
      });
    });
  });

  describe("onInterceptEnabledChange", () => {
    it("registers a storage change listener", () => {
      const callback = vi.fn();
      onInterceptEnabledChange(callback);
      expect(chrome.storage.onChanged.addListener).toHaveBeenCalled();
    });

    it("returns an unsubscribe function that removes the listener", () => {
      const callback = vi.fn();
      const unsubscribe = onInterceptEnabledChange(callback);

      unsubscribe();

      expect(chrome.storage.onChanged.removeListener).toHaveBeenCalled();
    });

    it("calls callback when interceptEnabled changes in local storage", () => {
      const callback = vi.fn();
      type StorageListener = Parameters<
        typeof chrome.storage.onChanged.addListener
      >[0];
      let registeredListener: StorageListener = () => {};

      vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(
        (listener) => {
          registeredListener = listener;
        },
      );

      onInterceptEnabledChange(callback);

      // Simulate storage change
      registeredListener(
        { interceptEnabled: { oldValue: false, newValue: true } },
        "local",
      );

      expect(callback).toHaveBeenCalledWith(true);
    });

    it("does not call callback for changes in sync storage", () => {
      const callback = vi.fn();
      type StorageListener = Parameters<
        typeof chrome.storage.onChanged.addListener
      >[0];
      let registeredListener: StorageListener = () => {};

      vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(
        (listener) => {
          registeredListener = listener;
        },
      );

      onInterceptEnabledChange(callback);

      // Simulate storage change in sync area
      registeredListener(
        { interceptEnabled: { oldValue: false, newValue: true } },
        "sync",
      );

      expect(callback).not.toHaveBeenCalled();
    });

    it("does not call callback for other storage keys", () => {
      const callback = vi.fn();
      type StorageListener = Parameters<
        typeof chrome.storage.onChanged.addListener
      >[0];
      let registeredListener: StorageListener = () => {};

      vi.mocked(chrome.storage.onChanged.addListener).mockImplementation(
        (listener) => {
          registeredListener = listener;
        },
      );

      onInterceptEnabledChange(callback);

      // Simulate storage change for different key
      registeredListener(
        { someOtherKey: { oldValue: "a", newValue: "b" } },
        "local",
      );

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
