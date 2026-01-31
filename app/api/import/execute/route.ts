import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { parseCSV, parseCSVText } from "@/lib/import/parser";
import { executeImport } from "@/lib/import/executor";
import {
  successResponse,
  errorResponse,
  handleApiError,
  checkRateLimit,
} from "@/lib/api/response";

export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const rateLimit = checkRateLimit(`import:${session.userId}`, 5, 60 * 60 * 1000);

    if (!rateLimit.allowed) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many imports. Please wait before importing again.",
        429
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let mapping;
    let format = "csv";
    let rows: Record<string, string>[] = [];

    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (!body?.csv || !body?.mapping) {
        return errorResponse("MISSING_DATA", "File and mapping required", 400);
      }
      mapping = body.mapping;
      format = body.format || "csv";
      const parsed = await parseCSVText(body.csv as string);
      rows = parsed.rows;
    } else {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const mappingStr = formData.get("mapping") as string | null;
      format = (formData.get("format") as string) || "csv";

      if (!file || !mappingStr) {
        return errorResponse("MISSING_DATA", "File and mapping required", 400);
      }

      mapping = JSON.parse(mappingStr);
      const parsed = await parseCSV(file);
      rows = parsed.rows;
    }

    const result = await executeImport(
      session.userId,
      rows,
      mapping,
      format as "csv" | "goodreads" | "storygraph"
    );

    return successResponse({ result });
  } catch (error) {
    return handleApiError(error);
  }
});
