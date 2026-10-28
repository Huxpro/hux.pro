"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

// =============================================================================
// State a component owns unless its parent passes `prop`: the controlled /
// uncontrolled pattern. Stands in for @radix-ui/react-use-controllable-state,
// which the AI Elements components ask for; the site's primitives are Base
// UI, and this is the one Radix piece they used. Same call shape.
// =============================================================================

export function useControllableState<T>({
  prop,
  defaultProp,
  onChange,
}: {
  prop?: T;
  defaultProp: T;
  onChange?: (value: T) => void;
}): [T, (next: T | ((prev: T) => T)) => void] {
  const [uncontrolled, setUncontrolled] = useState(defaultProp);
  const controlled = prop !== undefined;
  const value = controlled ? prop : uncontrolled;

  // The latest value and callback, for a setter that stays the same function.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (prev: T) => T)(valueRef.current) : next;
      if (Object.is(resolved, valueRef.current)) return;
      if (!controlled) setUncontrolled(resolved);
      onChangeRef.current?.(resolved);
    },
    [controlled],
  );

  return [value, setValue];
}
