import { destroySession } from "@/lib/auth/session";
import { successResponse, handleApiError } from "@/lib/api/response";

export async function POST() {
  try {
    await destroySession();
    return successResponse({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
