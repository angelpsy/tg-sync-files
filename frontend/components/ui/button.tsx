import * as React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'md', ...props }, ref) => {
    const variantCls = {
      default: 'bg-primary text-primary-foreground hover:opacity-90',
      secondary: 'bg-secondary text-secondary-foreground hover:opacity-90',
      outline: 'border border-border hover:bg-secondary',
      ghost: 'hover:bg-secondary',
      destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
    }[variant];
    const sizeCls = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-9 px-4 text-sm',
      lg: 'h-10 px-5 text-base',
    }[size];
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-md ${variantCls} ${sizeCls} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
