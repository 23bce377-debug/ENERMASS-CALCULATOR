'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  error?: string;
  confirmRef?: React.RefObject<HTMLInputElement | null>;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, icon, error, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          label={label}
          icon={icon}
          error={error}
          className="pr-12"
          {...props}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className={`absolute right-3 p-1 text-text-muted hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded transition-colors ${
            label ? 'top-[34px] -translate-y-1.5' : 'top-1/2 -translate-y-1/2'
          }`}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
