/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as emails from "../emails.js";
import type * as http from "../http.js";
import type * as lib_ciclo from "../lib/ciclo.js";
import type * as lib_html from "../lib/html.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as preAltas from "../preAltas.js";
import type * as registros from "../registros.js";
import type * as tutor from "../tutor.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  emails: typeof emails;
  http: typeof http;
  "lib/ciclo": typeof lib_ciclo;
  "lib/html": typeof lib_html;
  "lib/tokens": typeof lib_tokens;
  preAltas: typeof preAltas;
  registros: typeof registros;
  tutor: typeof tutor;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  resend: import("@convex-dev/resend/_generated/component.js").ComponentApi<"resend">;
};
