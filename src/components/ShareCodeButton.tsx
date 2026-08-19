import { useState } from "react";
import { Share2, Copy, MessageCircle, MessageSquare, Mail, MoreHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const APK_DOWNLOAD_URL = "https://fleettrackmate.com/downloads/FleetTrackMate.apk";

function buildInviteMessage(code: string, deviceName?: string) {
  return `You've been added to the fleet on FleetTrackMate${deviceName ? ` (${deviceName})` : ""}.

Your connection code: ${code}

1. Download the driver app: ${APK_DOWNLOAD_URL}
2. Install it (allow "unknown sources" if Android asks)
3. Open the app, enter your name and this code

Location sharing starts only when you go on duty.`;
}

interface ShareCodeButtonProps {
  code: string;
  deviceName?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  /** Icon-only trigger for tight rows */
  iconOnly?: boolean;
}

/**
 * Share a driver connection code through the channels dispatchers
 * actually use: WhatsApp, SMS, email, copy, or the device share sheet.
 */
export function ShareCodeButton({
  code,
  deviceName,
  variant = "default",
  size = "sm",
  className,
  iconOnly = false,
}: ShareCodeButtonProps) {
  const [copied, setCopied] = useState(false);
  const message = buildInviteMessage(code, deviceName);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — long-press the code to copy it manually.");
    }
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  };

  const shareSMS = () => {
    // `?body=` works on Android; iOS tolerates it in modern versions.
    window.location.href = `sms:?body=${encodeURIComponent(message)}`;
  };

  const shareEmail = () => {
    const subject = `Your FleetTrackMate driver code${deviceName ? ` — ${deviceName}` : ""}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title: "FleetTrackMate driver code", text: message });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        copyText(message, "Invite copied — paste it anywhere.");
      }
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={iconOnly ? "icon" : size} className={className} aria-label={`Share code ${code}`}>
          <Share2 className="h-4 w-4" />
          {!iconOnly && <span className="ml-1.5">Share code</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-mono text-xs tracking-widest">{code}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => copyText(code, "Code copied!")} className="cursor-pointer">
          {copied ? <Check className="mr-2 h-4 w-4 text-success" /> : <Copy className="mr-2 h-4 w-4" />}
          Copy code only
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => copyText(message, "Invite copied — paste it anywhere.")} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          Copy full invite
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={shareWhatsApp} className="cursor-pointer">
          <MessageCircle className="mr-2 h-4 w-4" />
          WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareSMS} className="cursor-pointer">
          <MessageSquare className="mr-2 h-4 w-4" />
          Text message
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareEmail} className="cursor-pointer">
          <Mail className="mr-2 h-4 w-4" />
          Email
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && !!navigator.share && (
          <DropdownMenuItem onClick={shareNative} className="cursor-pointer">
            <MoreHorizontal className="mr-2 h-4 w-4" />
            More options
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
