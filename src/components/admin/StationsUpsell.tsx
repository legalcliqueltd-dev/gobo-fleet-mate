import { Camera, CheckCircle2, Clock, MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectNativePlatform } from '@/utils/platformDetection';

const POINTS = [
  {
    icon: MapPin,
    title: 'Mark the places that matter',
    body: 'A dump site, a depot, a school gate — drop a pin and it appears on your drivers’ maps.',
  },
  {
    icon: Clock,
    title: 'Arrival records itself',
    body: 'Stay inside the zone for a minute and the visit is logged automatically. Driving past does not count.',
  },
  {
    icon: Camera,
    title: 'A photo proves it',
    body: 'The driver sends one live photo as a receipt. No gallery uploads, so old pictures cannot be reused.',
  },
  {
    icon: ShieldCheck,
    title: 'See who missed what',
    body: 'Every station keeps a day-by-day record: who came, when, how long, and which days were skipped.',
  },
];

/**
 * Explains what Stations is before asking anyone to pay for it.
 *
 * The purchase call-to-action is WEBSITE ONLY, and that is a store rule rather
 * than a preference: Apple guideline 3.1.3(f) and Google Play both forbid
 * selling digital goods inside the app without their billing. Restricting a
 * feature is fine; asking for money in-app is not.
 *
 * So the app teaches and stops; the website teaches and sells.
 */
export default function StationsUpsell({ onUpgrade }: { onUpgrade?: () => void }) {
  const isNative = detectNativePlatform();

  return (
    <div className="mx-auto flex h-full max-w-md flex-col overflow-y-auto px-6 py-8">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
        <MapPin className="h-7 w-7 text-primary" />
      </span>

      <p className="eyebrow mb-2">Not on your plan</p>
      <h2 className="font-heading text-2xl font-bold leading-tight text-foreground">
        Prove your drivers were there
      </h2>
      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
        Stations turn “he says he went” into a record you can show anyone — and one your drivers
        can use to defend themselves too.
      </p>

      <ul className="mt-7 space-y-5">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{title}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
          <p className="text-sm font-semibold">Included on the Pro plan</p>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Along with unlimited drivers. Your current plan covers up to two.
        </p>

        {isNative ? (
          // No purchase control in the app — store rules. Plain text only.
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Plans are managed on fleettrackmate.com. Once your plan changes, stations appear here
            automatically.
          </p>
        ) : (
          <Button className="mt-4 h-11 w-full font-semibold" onClick={onUpgrade}>
            See plans
          </Button>
        )}
      </div>

      <p className="py-6 text-center text-xs text-muted-foreground">
        Nothing is lost by waiting — stations you create later start recording immediately.
      </p>
    </div>
  );
}
