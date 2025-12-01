/**
 * Map interpolation utilities for smooth marker movement
 */

export interface Position {
  lat: number;
  lng: number;
}

/**
 * Linear interpolation between two numbers
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Ease-out cubic function for smoother deceleration
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Ease-in-out cubic for smooth transitions
 */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Interpolate between two positions with easing
 */
export function interpolatePosition(
  from: Position,
  to: Position,
  progress: number,
  easingFn: (t: number) => number = easeOutCubic
): Position {
  const t = easingFn(Math.min(1, Math.max(0, progress)));
  return {
    lat: lerp(from.lat, to.lat, t),
    lng: lerp(from.lng, to.lng, t),
  };
}

/**
 * Calculate distance between two positions in meters (Haversine formula)
 */
export function calculateDistance(from: Position, to: Position): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Check if a position jump is too large (likely GPS glitch)
 * Returns true if the distance is suspiciously large for the time elapsed
 */
export function isGlitchyJump(
  from: Position,
  to: Position,
  timeElapsedMs: number,
  maxSpeedMps: number = 50 // Max reasonable speed: 180 km/h ≈ 50 m/s
): boolean {
  const distance = calculateDistance(from, to);
  const maxDistance = maxSpeedMps * (timeElapsedMs / 1000);
  return distance > maxDistance * 2; // Allow 2x buffer for GPS variance
}

/**
 * Smooth position updates to prevent jerky movement
 * Uses a simple moving average or exponential smoothing
 */
export class PositionSmoother {
  private history: { position: Position; timestamp: number }[] = [];
  private maxHistory = 5;

  addPosition(position: Position, timestamp: number = Date.now()): Position {
    // Add to history
    this.history.push({ position, timestamp });
    
    // Keep only recent history
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // If we have enough history, return weighted average
    if (this.history.length >= 2) {
      return this.getSmoothedPosition();
    }

    return position;
  }

  private getSmoothedPosition(): Position {
    // Exponential weighted moving average
    // Recent positions have more weight
    let totalWeight = 0;
    let weightedLat = 0;
    let weightedLng = 0;

    this.history.forEach((entry, index) => {
      const weight = Math.pow(2, index); // Exponentially increasing weights
      totalWeight += weight;
      weightedLat += entry.position.lat * weight;
      weightedLng += entry.position.lng * weight;
    });

    return {
      lat: weightedLat / totalWeight,
      lng: weightedLng / totalWeight,
    };
  }

  reset(): void {
    this.history = [];
  }
}

/**
 * Animation manager for smooth marker transitions
 */
export class MarkerAnimator {
  private animationFrameId: number | null = null;
  private startPosition: Position | null = null;
  private endPosition: Position | null = null;
  private startTime: number = 0;
  private duration: number = 1000; // Default 1 second animation
  private onUpdate: (position: Position) => void;

  constructor(onUpdate: (position: Position) => void) {
    this.onUpdate = onUpdate;
  }

  animateTo(
    from: Position,
    to: Position,
    duration: number = 1000
  ): void {
    // Cancel any existing animation
    this.cancel();

    this.startPosition = from;
    this.endPosition = to;
    this.startTime = performance.now();
    this.duration = duration;

    this.animate();
  }

  private animate = (): void => {
    if (!this.startPosition || !this.endPosition) return;

    const elapsed = performance.now() - this.startTime;
    const progress = Math.min(1, elapsed / this.duration);

    const currentPosition = interpolatePosition(
      this.startPosition,
      this.endPosition,
      progress,
      easeOutCubic
    );

    this.onUpdate(currentPosition);

    if (progress < 1) {
      this.animationFrameId = requestAnimationFrame(this.animate);
    } else {
      this.animationFrameId = null;
    }
  };

  cancel(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

/**
 * Format time elapsed since last update
 */
export function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return 'Never';
  
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
