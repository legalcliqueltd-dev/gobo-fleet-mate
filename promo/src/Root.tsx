import React from 'react';
import { Composition } from 'remotion';
import { Promo, PROMO_DURATION } from './Promo';

/**
 * 1920x1080 at 30fps — the shape YouTube wants, which is where a Play listing
 * promo has to live (Play takes a YouTube URL, not a file upload).
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Promo"
    component={Promo}
    durationInFrames={PROMO_DURATION}
    fps={30}
    width={1920}
    height={1080}
  />
);
