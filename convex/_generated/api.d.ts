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
import type * as guardian from "../guardian.js";
import type * as http from "../http.js";
import type * as lib_cycle from "../lib/cycle.js";
import type * as lib_errorCodes from "../lib/errorCodes.js";
import type * as lib_html from "../lib/html.js";
import type * as lib_registrationSchema from "../lib/registrationSchema.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as preSignups from "../preSignups.js";
import type * as registrations from "../registrations.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  emails: typeof emails;
  guardian: typeof guardian;
  http: typeof http;
  "lib/cycle": typeof lib_cycle;
  "lib/errorCodes": typeof lib_errorCodes;
  "lib/html": typeof lib_html;
  "lib/registrationSchema": typeof lib_registrationSchema;
  "lib/tokens": typeof lib_tokens;
  preSignups: typeof preSignups;
  registrations: typeof registrations;
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
