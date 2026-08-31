import { NextResponse } from "next/server";

const STATUS_BY_MESSAGE: Record<string, number> = {
  UNAUTHORIZED: 401,
  NO_TEAM: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
};

/**
 * Maps thrown domain errors to responses. NOT_FOUND covers both "no such
 * project" and "not a member of it" so the two stay indistinguishable.
 */
export function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "ERROR";
  return NextResponse.json({ error: msg }, { status: STATUS_BY_MESSAGE[msg] ?? 400 });
}
