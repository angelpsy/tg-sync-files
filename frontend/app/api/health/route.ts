import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import pkgJson from '../../../package.json';

// Capture process start to expose simple uptime
const processStartedAt = Date.now();

// Read version from frontend package.json (bundled at build time)
const version: string = (pkgJson as { version?: string })?.version ?? '0.0.0';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'tg-sync-files-frontend',
      version,
      uptimeMs: Date.now() - processStartedAt,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      data: {
        message: 'Command received',
        payload: body,
      },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request body',
      },
      { status: 400 }
    );
  }
}
