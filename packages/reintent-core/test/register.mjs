// `node --import ./packages/reintent-core/test/register.mjs --test …`: see hooks.mjs.
import { register } from "node:module";

register(new URL("./hooks.mjs", import.meta.url));
