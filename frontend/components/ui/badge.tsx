import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  const variantCls = {
    default: 'bg-secondary text-secondary-foreground',
    secondary: 'bg-muted text-foreground',
    outline: 'border border-border',
    destructive: 'bg-destructive text-destructive-foreground',
  }[variant];
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs ${variantCls} ${className}`}
      {...props}
    />
  );
}
