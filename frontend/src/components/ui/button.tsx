import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] hover:opacity-90 active:scale-[.98]',
        gold:    'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] hover:bg-[rgb(var(--gold-600))] active:scale-[.98] shadow-[0_1px_2px_rgba(170,140,60,.18),0_8px_24px_rgba(170,140,60,.18)]',
        outline: 'border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--bg-sunken))] active:scale-[.98]',
        ghost:   'text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] hover:text-[rgb(var(--fg))]',
        destructive: 'bg-[rgb(var(--rose-500))] text-white hover:bg-[rgb(var(--rose-700))] active:scale-[.98]',
        subtle:  'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg))] hover:bg-[rgb(var(--border))]',
        link:    'text-[rgb(var(--fg))] underline-offset-4 hover:underline px-0',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-11 px-6 text-base',
        icon: 'h-10 w-10 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
