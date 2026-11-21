import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { errorResponse, handleApiError, successResponse } from '@/lib/api/response';
import { calendarDate, validTimeZone } from '@/lib/reading/activity';
import { getReadingActivity } from '@/lib/reading/activity-service';
export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const timeZone = request.nextUrl.searchParams.get('timeZone') ?? 'UTC';
    if (timeZone.length > 100 || !validTimeZone(timeZone)) return errorResponse('INVALID_TIME_ZONE', 'Choose a valid time zone.', 400);
    const input = request.nextUrl.searchParams.get('year');
    const year = input === null ? calendarDate(timeZone)(new Date()).year : z.coerce.number().int().min(1900).max(9999).parse(input);
    const response = successResponse(await getReadingActivity(session.userId, year, timeZone));
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (error) { return handleApiError(error); }
});
