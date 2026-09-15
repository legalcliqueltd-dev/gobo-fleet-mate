import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { geoMercator, geoPath } from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import land from './data/westafrica.json';
import { COLORS, FONT_STACK, LAGOS, ROUTE, STATIONS, type Station } from './theme';

const W = 1920;
const H = 1080;

/**
 * FleetTrackMate promo.
 *
 * Structure follows the product's own claim, in order: here is your city, here
 * are the places a driver must attend, here is the route they actually drove,
 * here is the proof they were there. Nothing is asserted that the app does not
 * do — a promo that oversells is a support burden later.
 *
 * The signature look is the 12fps stutter on the graphic layer while the base
 * camera glides smoothly. STEP is derived from fps rather than hardcoded, so
 * the piece survives being re-rendered at another frame rate.
 */

const BEATS = {
  establish: 0,
  zoom: 45,
  pins: 115,
  route: 205,
  proof: 330,
  endCard: 420,
  total: 510,
} as const;

const GLYPH: Record<Station['kind'], string> = {
  depot: 'M3 21V9l9-5 9 5v12h-6v-7H9v7H3z',
  dump: 'M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9z',
  drop: 'M6 2v20h2v-8h9l-2-4 2-4H8V2H6z',
};

const STATION_COLOR: Record<Station['kind'], string> = {
  depot: COLORS.primary,
  dump: COLORS.warning,
  drop: COLORS.success,
};

export const Promo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Quantise the graphic layer. At 30fps this holds each value for 3 frames
  // (10fps); at 24fps it is exactly 12. The base camera below uses the raw
  // frame so it keeps gliding — stuttering everything reads as dropped frames.
  const STEP = Math.max(1, Math.round(fps / 12));
  const f = Math.floor(frame / STEP) * STEP;

  // ── Camera: West Africa, then down into Lagos ──────────────────────────
  const zoomT = interpolate(frame, [BEATS.zoom, BEATS.pins], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });

  const wideScale = 2450;
  const closeScale = 260000;
  const scale = interpolate(zoomT, [0, 1], [wideScale, closeScale]);

  const centre: [number, number] = [
    interpolate(zoomT, [0, 1], [8.5, LAGOS.lng]),
    interpolate(zoomT, [0, 1], [9.5, LAGOS.lat]),
  ];

  const projection = geoMercator().center(centre).scale(scale).translate([W / 2, H / 2]);
  const toPath = geoPath(projection);
  const project = (lng: number, lat: number) => projection([lng, lat]) ?? [0, 0];

  // ── Route geometry ─────────────────────────────────────────────────────
  const routePoints = ROUTE.map(([lng, lat]) => project(lng, lat));
  const routeD = routePoints.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');

  const drawProgress = interpolate(f, [BEATS.route, BEATS.proof - 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Vehicle rides the drawn end of the line.
  const vehicleIdx = Math.min(
    routePoints.length - 1,
    Math.floor(drawProgress * (routePoints.length - 1))
  );
  const vehicle = routePoints[vehicleIdx];

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, fontFamily: FONT_STACK }}>
      {/* Subtle vignette so the centre of frame carries the eye */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 55% at 50% 45%, ${COLORS.inkSoft} 0%, ${COLORS.ink} 70%)`,
        }}
      />

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
        {/* Landmass */}
        {(land as FeatureCollection).features.map((feature, i) => {
          const isNigeria = (feature.properties as { name?: string })?.name === 'Nigeria';
          return (
            <path
              key={i}
              d={toPath(feature) ?? undefined}
              fill={isNigeria ? COLORS.land : '#1a2436'}
              stroke={COLORS.landEdge}
              strokeWidth={isNigeria ? 2 : 1}
              opacity={isNigeria ? 1 : 0.8}
            />
          );
        })}

        {/* Route: casing then core, the same grammar the app's history map uses */}
        {drawProgress > 0 && (
          <>
            <path
              d={routeD}
              fill="none"
              stroke={COLORS.ink}
              strokeWidth={22}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - drawProgress}
              opacity={0.9}
            />
            <path
              d={routeD}
              fill="none"
              stroke={COLORS.primary}
              strokeWidth={11}
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - drawProgress}
            />
          </>
        )}

        {/* Vehicle at the head of the line */}
        {drawProgress > 0 && drawProgress < 1 && (
          <g transform={`translate(${vehicle[0]} ${vehicle[1]})`}>
            <circle r={22} fill={COLORS.primary} opacity={0.22} />
            <circle r={12} fill={COLORS.primary} stroke="#fff" strokeWidth={3.5} />
          </g>
        )}

        {/* Stations */}
        {STATIONS.map((station, i) => {
          const [x, y] = project(station.lng, station.lat);
          const local = f - (BEATS.pins + i * STEP * 5);
          if (local < 0) return null;

          const drop = spring({ frame: local, fps, config: { damping: 13, mass: 0.6 } });
          const lift = 90 * (1 - drop);
          const colour = STATION_COLOR[station.kind];

          // Proof lands once the route has passed this station.
          const proven = f > BEATS.proof + i * STEP * 4;
          const proofPop = proven
            ? spring({ frame: f - (BEATS.proof + i * STEP * 4), fps, config: { damping: 12 } })
            : 0;

          return (
            <g key={station.name} transform={`translate(${x} ${y - lift})`} opacity={drop}>
              <ellipse cx={0} cy={6} rx={16 * drop} ry={5 * drop} fill="#000" opacity={0.35} />

              {/* Pin: head plus tail, tip on the coordinate */}
              <path
                d="M0 0 C-16 -22 -28 -34 -28 -50 A28 28 0 1 1 28 -50 C28 -34 16 -22 0 0 Z"
                fill={colour}
                stroke="#fff"
                strokeWidth={3}
              />
              <g transform="translate(-13 -63) scale(1.1)">
                <path d={GLYPH[station.kind]} fill="#fff" />
              </g>

              {/* Receipt tick */}
              {proofPop > 0 && (
                <g transform={`translate(26 -74) scale(${proofPop})`}>
                  <circle r={17} fill={COLORS.success} stroke="#fff" strokeWidth={3} />
                  <path
                    d="M-7 0 L-2 6 L8 -6"
                    fill="none"
                    stroke="#fff"
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )}

              {/* Label, always horizontal */}
              <g transform="translate(40 -52)">
                <rect
                  x={0}
                  y={-20}
                  width={station.name.length * 15 + 34}
                  height={40}
                  rx={10}
                  fill={COLORS.inkSoft}
                  stroke={colour}
                  strokeWidth={2}
                  opacity={0.97}
                />
                <text x={17} y={7} fill={COLORS.text} fontSize={24} fontWeight={600}>
                  {station.name}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      <Captions f={f} fps={fps} />
      <EndCard f={f} fps={fps} />
    </AbsoluteFill>
  );
};

/** One line at a time, low in frame, out of the map's way. */
const Captions: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  const lines: { at: number; until: number; text: string }[] = [
    { at: BEATS.establish + 12, until: BEATS.zoom + 30, text: 'Your fleet, wherever it is' },
    { at: BEATS.pins + 10, until: BEATS.route + 10, text: 'Mark the places drivers must visit' },
    { at: BEATS.route + 25, until: BEATS.proof + 10, text: 'See the route they actually drove' },
    { at: BEATS.proof + 20, until: BEATS.endCard - 5, text: 'With a photo receipt as proof' },
  ];

  return (
    <>
      {lines.map((line) => {
        if (f < line.at || f > line.until) return null;
        const appear = spring({ frame: f - line.at, fps, config: { damping: 16 } });
        const fade = interpolate(f, [line.until - 12, line.until], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div
            key={line.text}
            style={{
              position: 'absolute',
              left: 96,
              bottom: 96,
              opacity: appear * fade,
              transform: `translateY(${(1 - appear) * 26}px)`,
            }}
          >
            <div
              style={{
                width: 64,
                height: 5,
                borderRadius: 3,
                background: COLORS.primary,
                marginBottom: 18,
              }}
            />
            <div style={{ color: COLORS.text, fontSize: 60, fontWeight: 700, letterSpacing: -0.5 }}>
              {line.text}
            </div>
          </div>
        );
      })}
    </>
  );
};

const EndCard: React.FC<{ f: number; fps: number }> = ({ f, fps }) => {
  if (f < BEATS.endCard) return null;
  const enter = spring({ frame: f - BEATS.endCard, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.ink,
        opacity: enter,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ textAlign: 'center', transform: `translateY(${(1 - enter) * 30}px)` }}>
        <div style={{ color: COLORS.text, fontSize: 104, fontWeight: 700, letterSpacing: -2 }}>
          FleetTrackMate
        </div>
        <div style={{ color: COLORS.textDim, fontSize: 40, marginTop: 14 }}>
          Live tracking, jobs and proof of visit
        </div>
        <div
          style={{
            marginTop: 40,
            display: 'inline-block',
            padding: '18px 44px',
            borderRadius: 999,
            background: COLORS.primary,
            color: '#fff',
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          fleettrackmate.com
        </div>
      </div>
    </AbsoluteFill>
  );
};

export const PROMO_DURATION = BEATS.total;
