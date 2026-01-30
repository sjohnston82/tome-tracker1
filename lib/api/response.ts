import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiError {
  error_code: string;
  message: string;
  details?: unknown;
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(
  errorCode: string,
  message: string,
  status: number,
  details?: unknown
) {
  const body: ApiError = { error_code: errorCode, message };
  if (details) body.details = details;
  return NextResponse.json(body, { status });
}

export function handleApiError(error: unknown) {
  console.error("API Error:", error);

  if (error instanceof ZodError) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Invalid request data",
      400,
      error.flatten().fieldErrors
    );
  }

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return errorResponse("UNAUTHORIZED", "Authentication required", 401);
    }
    if (error.message === "Forbidden") {
      return errorResponse("FORBIDDEN", "Insufficient permissions", 403);
    }
  }

  return errorResponse(
    "INTERNAL_ERROR",
    "An unexpected error occurred",
    500
  );
}

// Simple in-memory rate limiter for serverless
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimits.get(key);

  if (!record || record.resetAt < now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count };
}
