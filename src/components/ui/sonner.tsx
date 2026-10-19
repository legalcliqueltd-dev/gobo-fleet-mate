import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Branded toasts. Every toast is the navy slab — the same `brand-ink` ground
 * as the screen headers, in both themes — with light ink, one solid neon
 * action and the status carried by the icon's colour alone. Sonner's own
 * white card and richColors (a green or red BACKGROUND) are both off-brand,
 * so the toast is unstyled and drawn entirely here.
 */
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      {...props}
      toastOptions={{
        ...toastOptions,
        unstyled: true,
        classNames: {
          toast:
            "mx-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl bg-brand-ink px-3 py-2 font-sans text-brand-ink-foreground shadow-lg ring-1 ring-brand-ink-foreground/10",
          content: "min-w-0 flex-1",
          title: "text-[13px] font-semibold leading-tight",
          description: "truncate text-[11px] leading-tight text-brand-ink-foreground/65",
          icon: "flex !h-auto !w-auto shrink-0 items-center justify-center",
          actionButton:
            "shrink-0 rounded-full bg-signal px-3 py-1 text-[11px] font-bold text-signal-foreground",
          cancelButton:
            "shrink-0 rounded-full bg-brand-ink-foreground/10 px-3 py-1.5 text-xs font-semibold text-brand-ink-foreground",
          closeButton: "text-brand-ink-foreground/60",
          success: "[&_[data-icon]]:text-signal",
          error: "[&_[data-icon]]:text-sos",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-brand-ink-foreground",
        },
      }}
    />
  );
};

export { Toaster, toast };
