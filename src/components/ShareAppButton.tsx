import { useState } from "react";
import { Share2, Copy, MessageCircle, MoreHorizontal, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";

const APK_DOWNLOAD_URL = "https://github.com/legalcliqueltd-dev/gobo-fleet-mate/releases/download/v1.0.0/FleetTrackMate.3.apk";

const SHARE_MESSAGE = `🚗 Download the FleetTrackMate Driver App

Track your location, receive tasks, and stay connected with your fleet.

📱 Download now: ${APK_DOWNLOAD_URL}

Install steps:
1. Click the link to download
2. Enable "Install from unknown sources" if prompted
3. Open the APK and tap Install
4. Enter your admin's connection code`;

interface ShareAppButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function ShareAppButton({ variant = "outline", size = "default", className }: ShareAppButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(APK_DOWNLOAD_URL);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The download link has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Failed to copy",
        description: "Please try again or copy the link manually.",
        variant: "destructive",
      });
    }
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(SHARE_MESSAGE)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "FleetTrackMate Driver App",
          text: SHARE_MESSAGE,
          url: APK_DOWNLOAD_URL,
        });
      } catch (err) {
        // User cancelled or share failed silently
        if ((err as Error).name !== "AbortError") {
          toast({
            title: "Share failed",
            description: "Please try copying the link instead.",
            variant: "destructive",
          });
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Share2 className="h-4 w-4 mr-2" />
          Share Link
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
          {copied ? (
            <Check className="h-4 w-4 mr-2 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          Copy Link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsAppShare} className="cursor-pointer">
          <MessageCircle className="h-4 w-4 mr-2" />
          Share via WhatsApp
        </DropdownMenuItem>
        {typeof navigator !== "undefined" && navigator.share && (
          <DropdownMenuItem onClick={handleNativeShare} className="cursor-pointer">
            <MoreHorizontal className="h-4 w-4 mr-2" />
            More Options
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
