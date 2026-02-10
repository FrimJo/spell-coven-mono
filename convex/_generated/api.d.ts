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
import type * as bans from "../bans.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as errors from "../errors.js";
import type * as http from "../http.js";
import type * as http_previewLogin from "../http/previewLogin.js";
import type * as players from "../players.js";
import type * as previewAuth from "../previewAuth.js";
import type * as rooms from "../rooms.js";
import type * as signals from "../signals.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  bans: typeof bans;
  constants: typeof constants;
  crons: typeof crons;
  errors: typeof errors;
  http: typeof http;
  "http/previewLogin": typeof http_previewLogin;
  players: typeof players;
  previewAuth: typeof previewAuth;
  rooms: typeof rooms;
  signals: typeof signals;
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

export declare const components: {};
