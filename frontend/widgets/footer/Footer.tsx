'use client';
import { HealthInline } from '@/widgets/health/HealthInline';
import { WSStatus } from '@/widgets/ws-status/WSStatus';

export function Footer() {
  return (
    <footer className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex items-end justify-end p-2">
      <div className="pointer-events-auto flex items-center gap-3">
        <HealthInline />
        <WSStatus />
      </div>
    </footer>
  );
}
