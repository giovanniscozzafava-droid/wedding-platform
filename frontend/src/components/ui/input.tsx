import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-lg border bg-[rgb(var(--bg-elev))] px-3 py-2 text-sm transition-colors',
      'border-[rgb(var(--border-strong))] text-[rgb(var(--fg))] placeholder:text-[rgb(var(--fg-subtle))]',
      'focus-visible:outline-none focus-visible:border-[rgb(var(--fg))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--fg)/.1)]',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

export { Input }

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex w-full rounded-lg border bg-[rgb(var(--bg-elev))] px-3 py-2 text-sm transition-colors',
        'border-[rgb(var(--border-strong))] text-[rgb(var(--fg))] placeholder:text-[rgb(var(--fg-subtle))]',
        'focus-visible:outline-none focus-visible:border-[rgb(var(--fg))]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-lg border bg-[rgb(var(--bg-elev))] px-3 py-2 text-sm transition-colors',
        'border-[rgb(var(--border-strong))] text-[rgb(var(--fg))]',
        'focus-visible:outline-none focus-visible:border-[rgb(var(--fg))]',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
