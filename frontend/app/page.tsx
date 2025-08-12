import { EventFeed } from '@/widgets/event-feed/EventFeed';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Telegram FileSync</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Manage sync, monitor events, and control actions via WebSocket.
        </p>
      </div>

      <EventFeed />

      <div className="text-sm text-muted-foreground">
        Check health API:{' '}
        <a className="text-blue-600 underline" href="/api/health">
          /api/health
        </a>
      </div>
    </div>
  );
}
