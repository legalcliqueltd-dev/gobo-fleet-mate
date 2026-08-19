import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { useAppRole, type AppRole } from '@/contexts/AppRoleContext';
import { detectNativePlatform } from '@/utils/platformDetection';

const TARGET: Record<AppRole, { label: string; to: string }> = {
  driver: { label: "I'm a driver", to: '/app/driver' },
  admin: { label: "I'm a fleet manager", to: '/app/admin' },
};

/**
 * Escape hatch on the two entry screens (driver connect / manager sign-in) for
 * someone who picked the wrong mode.
 *
 * It lives here rather than only in Settings because the mistake is discovered
 * *before* anyone has connected or signed in — at which point Settings is
 * unreachable. Switching from here is immediate and needs no confirmation:
 * nothing has been entered yet, so there is nothing to lose. The Settings
 * version keeps its confirm dialog because by then a session exists.
 */
export default function SwitchModeLink({ to }: { to: AppRole }) {
  const { chooseRole } = useAppRole();
  const navigate = useNavigate();

  // The website reaches these screens as ordinary pages; the mode concept is
  // native-only.
  if (!detectNativePlatform()) return null;

  const target = TARGET[to];

  return (
    <button
      type="button"
      onClick={() => {
        chooseRole(to);
        navigate(target.to, { replace: true });
      }}
      className="mx-auto flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      <ArrowLeftRight className="h-4 w-4" />
      Wrong screen? {target.label}
    </button>
  );
}
