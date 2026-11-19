import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { allowedCoverURL } from '@/lib/metadata/offline-cover-url';
import { errorResponse, handleApiError } from '@/lib/api/response';
export async function GET(request: NextRequest) {
  try {
    await requireAuth(); const url = request.nextUrl.searchParams.get('url') ?? '';
    if (!allowedCoverURL(url)) return errorResponse('INVALID_URL', 'This cover provider is not supported for offline downloads.', 400);
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(12000) });
    const type = response.headers.get('content-type')?.split(';')[0] ?? '';
    if (!response.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return errorResponse('UNAVAILABLE', 'Cover unavailable.', 502);
    const reader = response.body?.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    if (!reader) return errorResponse('UNAVAILABLE', 'Cover unavailable.', 502);
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 3 * 1024 * 1024) { await reader.cancel(); return errorResponse('TOO_LARGE', 'Cover image is too large.', 413); } chunks.push(value); }
    return new NextResponse(Buffer.concat(chunks), { headers: { 'Content-Type': type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return handleApiError(error); }
}
