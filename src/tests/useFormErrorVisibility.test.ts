import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isPrefersReducedMotion,
  scrollAndFocusElement,
  findFirstErrorElement,
} from "@/app/lib/useFormErrorVisibility";

describe("useFormErrorVisibility utilities", () => {
  const originalWindow = globalThis.window;

  afterEach(() => {
    // Restore window
    if (originalWindow === undefined) {
      // @ts-expect-error cleanup
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  describe("isPrefersReducedMotion", () => {
    it("returns false when window is undefined (e.g. SSR/Node)", () => {
      // @ts-expect-error simulate SSR
      delete globalThis.window;
      expect(isPrefersReducedMotion()).toBe(false);
    });

    it("returns true when matchMedia matches reduce", () => {
      // @ts-expect-error mock window
      globalThis.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      };
      expect(isPrefersReducedMotion()).toBe(true);
    });

    it("returns false when matchMedia does not match reduce", () => {
      // @ts-expect-error mock window
      globalThis.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      };
      expect(isPrefersReducedMotion()).toBe(false);
    });
  });

  describe("scrollAndFocusElement", () => {
    it("returns false safely when element is null or undefined", () => {
      expect(scrollAndFocusElement(null)).toBe(false);
    });

    it("invokes scrollIntoView and focus on target element", () => {
      const scrollIntoView = vi.fn();
      const focus = vi.fn();

      const mockElement = {
        scrollIntoView,
        focus,
        getAttribute: vi.fn().mockReturnValue(null),
        querySelector: vi.fn().mockReturnValue(null),
      } as unknown as HTMLElement;

      const result = scrollAndFocusElement(mockElement);
      expect(result).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();
    });

    it("skips focus if options.focus is false", () => {
      const scrollIntoView = vi.fn();
      const focus = vi.fn();

      const mockElement = {
        scrollIntoView,
        focus,
      } as unknown as HTMLElement;

      const result = scrollAndFocusElement(mockElement, { focus: false });
      expect(result).toBe(true);
      expect(scrollIntoView).toHaveBeenCalled();
      expect(focus).not.toHaveBeenCalled();
    });
  });

  describe("findFirstErrorElement", () => {
    it("returns element by specific fieldId when provided", () => {
      const target = {} as HTMLElement;
      const querySelector = vi.fn().mockImplementation((selector: string) => {
        if (selector === "#test-field") return target;
        return null;
      });

      const container = { querySelector } as unknown as HTMLElement;
      const result = findFirstErrorElement(container, "test-field");
      expect(result).toBe(target);
    });

    it("finds element marked with aria-invalid='true'", () => {
      const target = {} as HTMLElement;
      const querySelector = vi.fn().mockImplementation((selector: string) => {
        if (selector.includes('aria-invalid="true"')) return target;
        return null;
      });

      const container = { querySelector } as unknown as HTMLElement;
      const result = findFirstErrorElement(container);
      expect(result).toBe(target);
    });

    it("finds element with role='alert' when no input is invalid", () => {
      const alertTarget = {} as HTMLElement;
      const querySelector = vi.fn().mockImplementation((selector: string) => {
        if (selector.includes('role="alert"')) return alertTarget;
        return null;
      });

      const container = { querySelector } as unknown as HTMLElement;
      const result = findFirstErrorElement(container);
      expect(result).toBe(alertTarget);
    });

    it("returns null when no error element is found", () => {
      const querySelector = vi.fn().mockReturnValue(null);
      const container = { querySelector } as unknown as HTMLElement;
      const result = findFirstErrorElement(container);
      expect(result).toBeNull();
    });
  });
});
