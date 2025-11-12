import { AuthPanel } from '@/widgets/auth/AuthPanel';
import { EventFeed } from '@/widgets/event-feed/EventFeed';
import { DownloadProgressWidget } from '@/widgets/file-download';
import { FolderTree } from '@/widgets/folder-tree/FolderTree';
import { TopicsDashboard } from '@/widgets/topics-dashboard/TopicsDashboard';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Telegram FileSync</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Manage sync, monitor events, and control actions via WebSocket.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <TopicsDashboard />
        </div>
        <div className="space-y-4">
          <AuthPanel />
          <DownloadProgressWidget />
        </div>
      </div>

      <div className="space-y-6">
        <FolderTree />
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
