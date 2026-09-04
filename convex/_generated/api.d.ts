/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as crons from "../crons.js";
import type * as cycles from "../cycles.js";
import type * as emails from "../emails.js";
import type * as guardian from "../guardian.js";
import type * as http from "../http.js";
import type * as lib_cycle from "../lib/cycle.js";
import type * as lib_cycleRules from "../lib/cycleRules.js";
import type * as lib_decisionRules from "../lib/decisionRules.js";
import type * as lib_errorCodes from "../lib/errorCodes.js";
import type * as lib_guardianRules from "../lib/guardianRules.js";
import type * as lib_html from "../lib/html.js";
import type * as lib_mexicanStates from "../lib/mexicanStates.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_registrationLimits from "../lib/registrationLimits.js";
import type * as lib_registrationRules from "../lib/registrationRules.js";
import type * as lib_registrationSchema from "../lib/registrationSchema.js";
import type * as lib_staffRules from "../lib/staffRules.js";
import type * as lib_tokens from "../lib/tokens.js";
import type * as preSignups from "../preSignups.js";
import type * as registrations from "../registrations.js";
import type * as staff from "../staff.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  crons: typeof crons;
  cycles: typeof cycles;
  emails: typeof emails;
  guardian: typeof guardian;
  http: typeof http;
  "lib/cycle": typeof lib_cycle;
  "lib/cycleRules": typeof lib_cycleRules;
  "lib/decisionRules": typeof lib_decisionRules;
  "lib/errorCodes": typeof lib_errorCodes;
  "lib/guardianRules": typeof lib_guardianRules;
  "lib/html": typeof lib_html;
  "lib/mexicanStates": typeof lib_mexicanStates;
  "lib/permissions": typeof lib_permissions;
  "lib/registrationLimits": typeof lib_registrationLimits;
  "lib/registrationRules": typeof lib_registrationRules;
  "lib/registrationSchema": typeof lib_registrationSchema;
  "lib/staffRules": typeof lib_staffRules;
  "lib/tokens": typeof lib_tokens;
  preSignups: typeof preSignups;
  registrations: typeof registrations;
  staff: typeof staff;
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
