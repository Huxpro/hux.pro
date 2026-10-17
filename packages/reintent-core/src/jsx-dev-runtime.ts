// The development entry of the JSX runtime: the same, with the extra arguments ignored.
import { jsx } from "./jsx-runtime";

export { Fragment, type JSX } from "./jsx-runtime";
export const jsxDEV = (type: Parameters<typeof jsx>[0], props: Record<string, unknown>, key?: string) => jsx(type, props, key);
