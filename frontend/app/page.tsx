export default function HomePage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-foreground mb-4">Telegram FileSync</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Frontend is under active development. This app will provide an interface to manage file
          synchronization and monitor the system state.
        </p>

        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
          <span>Status: WIP</span>
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border p-6">
        <h2 className="text-2xl font-semibold mb-3 text-foreground">What’s next</h2>
        <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
          <li>WebSocket connection to backend (as a separate widget)</li>
          <li>Jobs queue and logs screen</li>
          <li>Sync settings and channel profiles</li>
        </ul>
      </div>

      <div className="text-sm text-muted-foreground">
        Check health API:{' '}
        <a className="text-blue-600 underline" href="/api/health">
          /api/health
        </a>
      </div>
    </div>
  );
}
