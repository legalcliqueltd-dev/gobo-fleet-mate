import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  GraduationCap,
  KeyRound,
  FileText,
  LogOut,
  Repeat,
  Shield,
  ShieldAlert,
  Trash2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAuth } from '@/contexts/AuthContext';
import ThemeSegmented from '@/components/ThemeSegmented';
import AdminTutorial from '@/components/admin/AdminTutorial';
import ProfileSheet from '@/components/admin/ProfileSheet';
import { useAppRole } from '@/contexts/AppRoleContext';
import { signOutAdmin } from '@/services/adminAuth';
import { cn } from '@/lib/utils';

function Row({
  icon: Icon,
  label,
  hint,
  onClick,
  destructive,
}: {
  icon: typeof UserRound;
  label: string;
  hint?: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-muted"
    >
      <Icon className={cn('h-5 w-5 shrink-0', destructive ? 'text-destructive' : 'text-muted-foreground')} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-medium', destructive && 'text-destructive')}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

/**
 * Manager account and app preferences.
 *
 * Deliberately contains no upgrade, subscribe, or billing calls-to-action —
 * the native bundle stays free of purchase surfaces so the iOS build remains a
 * free companion to the paid web tool (App Store guideline 3.1.3(f)).
 * Subscription state is shown as plain read-only status.
 */
export default function AdminAppSettings() {
  const navigate = useNavigate();
  const { user, subscription } = useAuth();
  const { clearRole } = useAppRole();

  const [signOutOpen, setSignOutOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const email = user?.email ?? '—';
  const displayName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() || email.split('@')[0];
  const initial = displayName.charAt(0).toUpperCase();

  const planLabel = (() => {
    if (subscription.status === 'active') {
      return subscription.plan ? `${subscription.plan.toUpperCase()} · active` : 'Active';
    }
    if (subscription.status === 'trial') {
      return subscription.trialExpired
        ? 'Trial ended'
        : `Trial · ${subscription.trialDaysRemaining} day${subscription.trialDaysRemaining === 1 ? '' : 's'} left`;
    }
    if (subscription.status === 'expired') return 'Expired';
    return 'Checking…';
  })();

  const handleSignOut = async () => {
    await signOutAdmin();
    navigate('/app/admin/login', { replace: true });
  };

  const handleSwitchMode = () => {
    clearRole();
    navigate('/app/role', { replace: true });
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-5">
      {/* Identity */}
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="mb-5 flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary font-heading text-lg font-bold text-primary-foreground">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-semibold text-foreground">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {/* Plan — status only, no purchase actions */}
      <div
        className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Plan
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{planLabel}</p>
        </div>
        <Shield className="h-5 w-5 shrink-0 text-muted-foreground" />
      </div>

      {/* Preferences */}
      <div
        className="mb-5 overflow-hidden rounded-2xl border border-border bg-card"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <Row
          icon={ShieldAlert}
          label="Your profile & emergency contact"
          hint="Your name, and the number drivers call in an emergency"
          onClick={() => setProfileOpen(true)}
        />

        <div className="border-t border-border" />

        <Row
          icon={KeyRound}
          label="Drivers & codes"
          hint="Share, revoke or replace connection codes"
          onClick={() => navigate('/app/admin/codes')}
        />

        <div className="border-t border-border" />

        <Row
          icon={GraduationCap}
          label="How to use FleetTrackMate"
          hint="A short tour of every tab"
          onClick={() => setTutorialOpen(true)}
        />

        <div className="border-t border-border" />

        <div className="px-4 py-4">
          <p className="mb-3 text-sm font-medium">Appearance</p>
          <ThemeSegmented />
        </div>

        <div className="border-t border-border" />

        <Row
          icon={Repeat}
          label="Switch mode"
          hint="Use this device as a driver instead"
          onClick={() => setSwitchOpen(true)}
        />
      </div>

      {/* Legal */}
      <div
        className="mb-5 overflow-hidden rounded-2xl border border-border bg-card"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        <Row icon={Shield} label="Privacy policy" onClick={() => navigate('/privacy')} />
        <div className="border-t border-border" />
        <Row icon={FileText} label="Terms of service" onClick={() => navigate('/terms')} />
        <div className="border-t border-border" />
        <Row
          icon={Trash2}
          label="Delete account"
          hint="Permanently remove your account and data"
          destructive
          onClick={() => navigate('/delete-account')}
        />
      </div>

      <Button variant="outline" className="h-12 w-full gap-2" onClick={() => setSignOutOpen(true)}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>

      <p className="py-8 text-center text-xs text-muted-foreground">FleetTrackMate · Manager</p>

      {tutorialOpen && <AdminTutorial onClose={() => setTutorialOpen(false)} />}
      {profileOpen && <ProfileSheet onClose={() => setProfileOpen(false)} />}

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title="Sign out?"
        description="You'll need to sign in again to see your fleet."
        confirmLabel="Sign out"
        onConfirm={handleSignOut}
      />

      <ConfirmDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        title="Switch to driver mode?"
        description="You'll go back to the mode picker. Your manager account stays signed in, so you can switch back at any time."
        confirmLabel="Switch mode"
        onConfirm={handleSwitchMode}
      />
    </div>
  );
}
