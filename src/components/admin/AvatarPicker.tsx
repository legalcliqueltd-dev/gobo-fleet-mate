import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { clearAvatar, uploadAvatar } from '@/services/adminProfile';
import { capturePhotoAsFile } from '@/utils/nativeCamera';
import { detectNativePlatform } from '@/utils/platformDetection';
import { cn } from '@/lib/utils';

/**
 * Pick, replace or remove the manager's profile picture.
 *
 * On native this goes through the Capacitor camera so the manager can take a
 * photo rather than hunt for one in the gallery — the common case is someone
 * setting this up for the first time with no suitable picture already on the
 * phone. `capturePhotoAsFile` returns null when the sheet is cancelled, which
 * is not an error and must not be reported as one.
 *
 * On web it is a plain file input, hidden behind the same button.
 *
 * The fallback while empty is the initial on a coloured disc, which is what
 * the settings screen already showed, so nothing shifts when a picture is
 * added or removed.
 */
export default function AvatarPicker({
  userId,
  currentUrl,
  displayName,
  onChange,
  size = 'lg',
}: {
  userId: string;
  currentUrl: string | null;
  displayName: string;
  onChange: (url: string | null) => void;
  size?: 'md' | 'lg';
}) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isNative = detectNativePlatform();

  const dimension = size === 'lg' ? 'h-20 w-20 text-2xl' : 'h-14 w-14 text-lg';

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const url = await uploadAvatar(userId, file);
      onChange(url);
      toast.success('Picture updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not upload that picture.');
    } finally {
      setBusy(false);
    }
  };

  const handlePick = async () => {
    if (!isNative) {
      fileRef.current?.click();
      return;
    }
    try {
      const file = await capturePhotoAsFile('camera');
      // Cancelling the native sheet returns null — a decision, not a failure.
      if (file) await handleFile(file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not open the camera.');
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await clearAvatar(userId);
      onChange(null);
      toast.success('Picture removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove the picture.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={handlePick}
        disabled={busy}
        aria-label={currentUrl ? 'Change profile picture' : 'Add a profile picture'}
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-heading font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60',
          dimension
        )}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (displayName.charAt(0) || '?').toUpperCase()
        )}

        <span className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/45 py-1">
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
          ) : (
            <Camera className="h-3.5 w-3.5 text-white" />
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Profile picture</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isNative ? 'Tap the photo to take a new one.' : 'Click the photo to choose a file.'}
        </p>

        {currentUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={handleRemove}
            className="mt-1 h-8 px-2 text-xs text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reset so re-picking the same file still fires a change event.
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
