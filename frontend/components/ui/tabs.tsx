import * as React from 'react';

export interface TabsProps {
  value: string;
  onValueChange: (val: string) => void;
  children: React.ReactNode;
}

export function Tabs({ value, onValueChange: _onValueChange, children }: TabsProps) {
  return <div data-value={value}>{children}</div>;
}

export function TabsList({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`inline-flex h-9 items-center justify-center rounded-lg bg-secondary p-1 ${className}`}
      {...props}
    />
  );
}

export function TabsTrigger({
  className = '',
  value,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  return (
    <button
      data-value={value}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm text-foreground hover:bg-background ${className}`}
      {...props}
    />
  );
}

export function TabsContent({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`mt-2 ${className}`} {...props} />;
}
