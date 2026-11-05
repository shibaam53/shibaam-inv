import { useEffect, useRef } from "react";

function safeCssEscape(str: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(str);
  }
  return str.replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@\\])/g, "\\$1");
}

/**
 * Checks whether the user has requested reduced motion in their system preferences.
 */
export function isPrefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Scrolls an element into view smoothly (or immediately if reduced motion is preferred),
 * and focuses the element or its first interactive control.
 */
export function scrollAndFocusElement(
  element: HTMLElement | null,
  options?: {
    focus?: boolean;
    block?: ScrollLogicalPosition;
  },
): boolean {
  if (!element) return false;

  const isReduced = isPrefersReducedMotion();

  try {
    element.scrollIntoView({
      behavior: isReduced ? "auto" : "smooth",
      block: options?.block ?? "nearest",
      inline: "nearest",
    });
  } catch {
    element.scrollIntoView();
  }

  if (options?.focus !== false) {
    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    // If the element itself is an interactive control, focus it directly
    if (
      tagName === "input" ||
      tagName === "select" ||
      tagName === "textarea" ||
      tagName === "button"
    ) {
      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }
    } else {
      // Find the first interactive control inside this container/group
      const focusable = element.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable) {
        try {
          focusable.focus({ preventScroll: true });
        } catch {
          focusable.focus();
        }
      } else if (element.getAttribute("role") === "alert") {
        // Ensure screen readers and assistive devices notice the alert
        element.tabIndex = -1;
        try {
          element.focus({ preventScroll: true });
        } catch {
          element.focus();
        }
      }
    }
  }

  return true;
}

/**
 * Finds the first invalid form control or error alert inside a container.
 */
export function findFirstErrorElement(
  container: HTMLElement | Document = document,
  specificFieldId?: string | null,
): HTMLElement | null {
  if (specificFieldId) {
    const el = container.querySelector<HTMLElement>(
      `#${safeCssEscape(specificFieldId)}`,
    );
    if (el) return el;
  }

  // 1. Control explicitly marked with aria-invalid="true"
  const ariaInvalid = container.querySelector<HTMLElement>(
    'input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"], [aria-invalid="true"]',
  );
  if (ariaInvalid) return ariaInvalid;

  // 2. Control failing native HTML5 validation
  const invalidControl = container.querySelector<HTMLElement>(
    "input:invalid, select:invalid, textarea:invalid",
  );
  if (invalidControl) return invalidControl;

  // 3. Error alert banner or message element
  const alertEl = container.querySelector<HTMLElement>(
    '[role="alert"], [data-form-error], .text-destructive[role="alert"]',
  );
  if (alertEl) return alertEl;

  return null;
}

export interface UseFormErrorVisibilityOptions {
  /**
   * General error message string (e.g. from useState `error` or `modalError`).
   */
  error?: string | null;

  /**
   * Errors object from React Hook Form or manual field error map.
   */
  formErrors?: Record<string, unknown> | null;

  /**
   * Optional ref to the form or scrollable modal container.
   */
  containerRef?: React.RefObject<HTMLElement | null>;

  /**
   * Optional specific field ID to scroll to when error occurs.
   */
  fieldId?: string | null;

  /**
   * Whether to disable automatic scrolling/focusing.
   */
  disabled?: boolean;
}

/**
 * Reusable hook that monitors form error states and automatically brings
 * the first invalid field or error banner into view and focuses it.
 */
export function useFormErrorVisibility({
  error,
  formErrors,
  containerRef,
  fieldId,
  disabled = false,
}: UseFormErrorVisibilityOptions) {
  const lastErrorRef = useRef<string | null>(null);
  const lastFormErrorKeysRef = useRef<string>("");

  useEffect(() => {
    if (disabled) return;

    const currentError = error || null;
    const currentFormErrorKeys = formErrors
      ? Object.keys(formErrors)
          .filter((k) => !!formErrors[k])
          .join(",")
      : "";

    const hasNewError = currentError && currentError !== lastErrorRef.current;
    const hasNewFormErrors =
      currentFormErrorKeys &&
      currentFormErrorKeys !== lastFormErrorKeysRef.current;

    lastErrorRef.current = currentError;
    lastFormErrorKeysRef.current = currentFormErrorKeys;

    if (!hasNewError && !hasNewFormErrors) return;

    // Use requestAnimationFrame so the DOM has finished painting the error element
    const frameId = requestAnimationFrame(() => {
      const root = containerRef?.current || document;

      let target: HTMLElement | null = null;
      if (formErrors) {
        const firstKey = Object.keys(formErrors).find((k) => !!formErrors[k]);
        if (firstKey) {
          target =
            root.querySelector<HTMLElement>(`[name="${safeCssEscape(firstKey)}"]`) ||
            root.querySelector<HTMLElement>(`#${safeCssEscape(firstKey)}`);
        }
      }

      if (!target) {
        target = findFirstErrorElement(root, fieldId);
      }

      if (target) {
        scrollAndFocusElement(target, { block: "center" });
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [error, formErrors, containerRef, fieldId, disabled]);
}
