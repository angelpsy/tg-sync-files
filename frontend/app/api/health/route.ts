import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'tg-sync-files-frontend',
      timestamp: new Date().toISOString(),
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Здесь можно добавить логику для взаимодействия с backend
    // Например, отправка команд через WebSocket

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
