import React, { InputHTMLAttributes } from 'react';
import clsx, { type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, icon, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-xs font-bold text-text-primary mb-1.5 uppercase tracking-wide">
            {label}
            {props.required && <span className="text-error ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full bg-background border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted transition-all focus:outline-none focus:ring-2 focus:ring-accent/20",
              icon ? "pl-10" : "",
              error ? "border-error focus:border-error" : "border-border hover:border-border-light focus:border-accent",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-[10px] text-error mt-1 font-medium">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
