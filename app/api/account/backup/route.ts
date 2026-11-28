import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { exportBackup, restoreBackup, libraryCSV, NonemptyLibraryError } from '@/lib/backup/service';
import { backupSchema, backupSummary } from '@/lib/backup/validation';
import { errorResponse, handleApiError, successResponse } from '@/lib/api/response';
export async function GET(request: NextRequest) {
  try { const session = await requireAuth(); const backup = await exportBackup(session.userId); const csv = request.nextUrl.searchParams.get('format') === 'csv'; return new NextResponse(csv ? libraryCSV(backup) : JSON.stringify(backup, null, 2), { headers: { 'Content-Type': csv ? 'text/csv; charset=utf-8' : 'application/json', 'Content-Disposition': `attachment; filename="tome-tracker-${new Date().toISOString().slice(0, 10)}.${csv ? 'csv' : 'json'}"`, 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return handleApiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (Number(request.headers.get('content-length')) > 20 * 1024 * 1024) return errorResponse('TOO_LARGE', 'Backup files must be under 20 MB.', 413);
    const reader = request.body?.getReader(); if (!reader) return errorResponse('INVALID_BACKUP', 'Choose a backup file.', 400);
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 20 * 1024 * 1024) { await reader.cancel(); return errorResponse('TOO_LARGE', 'Backup files must be under 20 MB.', 413); } chunks.push(value); }
    const backup = backupSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    if (request.nextUrl.searchParams.get('preview') === '1') return successResponse({ summary: backupSummary(backup) });
    if (request.headers.get('X-Confirm-Restore') !== 'yes') return errorResponse('CONFIRM_REQUIRED', 'Preview and confirm the restore first.', 400);
    return successResponse(await restoreBackup(session.userId, backup));
  } catch (error) { if (error instanceof NonemptyLibraryError) return errorResponse('LIBRARY_NOT_EMPTY', error.message, 409); return handleApiError(error); }
}
