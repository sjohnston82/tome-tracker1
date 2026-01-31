import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { createPreview, createPreviewFromText } from "@/lib/import/parser";
import { GOODREADS_MAPPING } from "@/lib/import/goodreads";
import { successResponse, errorResponse, handleApiError } from "@/lib/api/response";

export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const contentType = request.headers.get("content-type") || "";
    let preview;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (!body?.csv) {
        return errorResponse("NO_FILE", "No file provided", 400);
      }
      preview = await createPreviewFromText(body.csv as string);
    } else {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return errorResponse("NO_FILE", "No file provided", 400);
      }

      if (!file.name.endsWith(".csv")) {
        return errorResponse("INVALID_FORMAT", "Only CSV files are supported", 400);
      }

      preview = await createPreview(file);
    }

    if (preview.format === "goodreads") {
      preview.suggestedMapping = GOODREADS_MAPPING;
    }

    return successResponse({ preview });
  } catch (error) {
    return handleApiError(error);
  }
});
