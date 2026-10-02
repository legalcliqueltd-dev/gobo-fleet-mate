import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // OFF used to be `bg-input` — 82% lightness on a 100% white card, which
      // all but vanished. The knob floated there looking like a stray grey
      // circle rather than a switch you could throw. OFF now carries real
      // contrast and an inner shadow so the track reads as a track.
      "peer inline-flex h-[26px] w-[46px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-inner transition-colors data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        // White in both themes, the way a physical switch reads, with a
        // hairline ring so it keeps its edge against a pale OFF track.
        "pointer-events-none block h-[22px] w-[22px] rounded-full bg-white shadow-md ring-1 ring-black/10 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
