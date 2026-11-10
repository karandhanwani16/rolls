import { useCallback, useRef } from "react";

export type NavigationDirection = "next" | "previous";

const HORIZONTAL_NAVIGATION_KEYS = new Set([
  "Enter",
  "ArrowRight",
  "ArrowLeft",
]);

export function getNavigationDirection(
  e: React.KeyboardEvent
): NavigationDirection | null {
  if (e.key === "Enter" && !e.shiftKey) return "next";
  if (e.key === "Enter" && e.shiftKey) return "previous";
  if (e.key === "ArrowRight") return "next";
  if (e.key === "ArrowLeft") return "previous";
  return null;
}

export function getVerticalNavigationDirection(
  e: React.KeyboardEvent
): NavigationDirection | null {
  if (e.key === "ArrowDown") return "next";
  if (e.key === "ArrowUp") return "previous";
  return null;
}

function isHorizontalArrow(key: string) {
  return key === "ArrowLeft" || key === "ArrowRight";
}

function shouldNavigateOnArrow(e: React.KeyboardEvent): boolean {
  if (!isHorizontalArrow(e.key) && e.key !== "ArrowUp" && e.key !== "ArrowDown") {
    return true;
  }

  const target = e.currentTarget;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return true;
  }

  if (target instanceof HTMLTextAreaElement) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      return true;
    }
    const { selectionStart, selectionEnd, value } = target;
    if (selectionStart === null || selectionEnd === null) return true;
    if (e.key === "ArrowLeft" && selectionStart > 0) return false;
    if (e.key === "ArrowRight" && selectionEnd < value.length) return false;
    return true;
  }

  if (target.type === "number" || target.type === "date") {
    return true;
  }

  const { selectionStart, selectionEnd, value } = target;
  if (selectionStart === null || selectionEnd === null) return true;
  if (e.key === "ArrowLeft" && selectionStart > 0) return false;
  if (e.key === "ArrowRight" && selectionEnd < value.length) return false;
  return true;
}

export function handleInputNavigationKeyDown(
  e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  callbacks: {
    onNext?: () => void;
    onPrevious?: () => void;
    onRowNext?: () => void;
    onRowPrevious?: () => void;
  }
) {
  const verticalDirection = getVerticalNavigationDirection(e);
  if (verticalDirection) {
    if (!shouldNavigateOnArrow(e)) return;
    e.preventDefault();
    if (verticalDirection === "next") {
      callbacks.onRowNext?.();
    } else {
      callbacks.onRowPrevious?.();
    }
    return;
  }

  if (!HORIZONTAL_NAVIGATION_KEYS.has(e.key)) return;

  const direction = getNavigationDirection(e);
  if (!direction) return;
  if (!shouldNavigateOnArrow(e)) return;

  e.preventDefault();
  if (direction === "next") {
    callbacks.onNext?.();
  } else {
    callbacks.onPrevious?.();
  }
}

export function getFocusableInputs(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([readonly]):not([disabled]):not([type="hidden"]), textarea:not([readonly]):not([disabled])'
    )
  ).filter((el) => el.offsetParent !== null);
}

export function useFormSectionNavigation<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T>(null);

  const onKeyDownCapture = useCallback((e: React.KeyboardEvent) => {
    const direction = getNavigationDirection(e);
    if (!direction || !containerRef.current) return;

    const target = e.target;
    if (
      !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    ) {
      return;
    }

    if (!containerRef.current.contains(target)) return;
    if (!shouldNavigateOnArrow(e)) return;

    const focusable = getFocusableInputs(containerRef.current);
    const idx = focusable.indexOf(target);
    if (idx === -1) return;

    const nextIdx = direction === "next" ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < focusable.length) {
      e.preventDefault();
      focusable[nextIdx].focus();
      if (
        focusable[nextIdx] instanceof HTMLInputElement &&
        ["text", "search", "tel", "url", ""].includes(focusable[nextIdx].type)
      ) {
        focusable[nextIdx].select();
      }
    }
  }, []);

  return { containerRef, onKeyDownCapture };
}

interface TableInputNavigationOptions {
  fields: string[];
  rowCount: number;
  getFieldsForRow?: (rowIndex: number) => string[];
  onAddRow?: () => void;
}

export function useTableInputNavigation({
  fields,
  rowCount,
  getFieldsForRow,
  onAddRow,
}: TableInputNavigationOptions) {
  const inputRefs = useRef<Record<string, (HTMLInputElement | null)[]>>({});

  const setRef = useCallback(
    (field: string, index: number) => (element: HTMLInputElement | null) => {
      if (!inputRefs.current[field]) {
        inputRefs.current[field] = [];
      }
      inputRefs.current[field][index] = element;
    },
    []
  );

  const rowFields = useCallback(
    (rowIndex: number) => getFieldsForRow?.(rowIndex) ?? fields,
    [fields, getFieldsForRow]
  );

  const focusField = useCallback((rowIndex: number, field: string) => {
    const element = inputRefs.current[field]?.[rowIndex];
    if (!element || element.disabled || element.readOnly) return false;
    element.focus();
    if (["text", "search", "tel", "url", ""].includes(element.type)) {
      element.select();
    }
    return true;
  }, []);

  const focusNextField = useCallback(
    (rowIndex: number, currentField: string) => {
      const rowFieldList = rowFields(rowIndex);
      const currentFieldIndex = rowFieldList.indexOf(currentField);

      for (let f = currentFieldIndex + 1; f < rowFieldList.length; f++) {
        if (focusField(rowIndex, rowFieldList[f])) return;
      }

      for (let r = rowIndex + 1; r < rowCount; r++) {
        const nextRowFields = rowFields(r);
        for (const field of nextRowFields) {
          if (focusField(r, field)) return;
        }
      }

      if (onAddRow) {
        onAddRow();
        setTimeout(() => {
          const newRowFields = rowFields(rowCount);
          for (const field of newRowFields) {
            if (focusField(rowCount, field)) return;
          }
        }, 0);
      }
    },
    [focusField, onAddRow, rowCount, rowFields]
  );

  const focusPreviousField = useCallback(
    (rowIndex: number, currentField: string) => {
      const rowFieldList = rowFields(rowIndex);
      const currentFieldIndex = rowFieldList.indexOf(currentField);

      for (let f = currentFieldIndex - 1; f >= 0; f--) {
        if (focusField(rowIndex, rowFieldList[f])) return;
      }

      for (let r = rowIndex - 1; r >= 0; r--) {
        const prevRowFields = rowFields(r);
        for (let f = prevRowFields.length - 1; f >= 0; f--) {
          if (focusField(r, prevRowFields[f])) return;
        }
      }
    },
    [focusField, rowFields]
  );

  const focusNextRow = useCallback(
    (rowIndex: number, field: string) => {
      for (let r = rowIndex + 1; r < rowCount; r++) {
        if (focusField(r, field)) return;
      }
    },
    [focusField, rowCount]
  );

  const focusPreviousRow = useCallback(
    (rowIndex: number, field: string) => {
      for (let r = rowIndex - 1; r >= 0; r--) {
        if (focusField(r, field)) return;
      }
    },
    [focusField]
  );

  const createKeyDownHandler = useCallback(
    (rowIndex: number, field: string) =>
      (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        handleInputNavigationKeyDown(e, {
          onNext: () => focusNextField(rowIndex, field),
          onPrevious: () => focusPreviousField(rowIndex, field),
          onRowNext: () => focusNextRow(rowIndex, field),
          onRowPrevious: () => focusPreviousRow(rowIndex, field),
        });
      },
    [focusNextField, focusPreviousField, focusNextRow, focusPreviousRow]
  );

  return {
    setRef,
    focusNextField,
    focusPreviousField,
    focusNextRow,
    focusPreviousRow,
    createKeyDownHandler,
  };
}
