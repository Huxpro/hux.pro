// Fails to type-check if ./index and ../bezel.d.ts disagree: an export missing
// on either side, or a different type. Nothing here runs.

import type * as Contract from "../bezel";
import type * as Implementation from "./index";

type C = typeof Contract;
type I = typeof Implementation;

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type AllTrue<T extends Record<PropertyKey, true>> = T;

/** Every contract export exists in the implementation, with the same type. */
export type ImplementsContract = AllTrue<{
  [K in keyof C]: K extends keyof I ? Same<C[K], I[K]> : false;
}>;

/** The implementation exports nothing the contract does not declare. */
export type NoUndeclaredExports = AllTrue<{
  [K in keyof I]: K extends keyof C ? true : false;
}>;
