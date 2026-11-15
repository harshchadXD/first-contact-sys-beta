import type { FC } from 'react';
import styles from './FirstContactIdentity.module.css';

export interface FirstContactIdentityProps {
  state?: 'idle' | 'connected' | 'blocked';
  reducedMotion?: boolean;
  className?: string;
}

export const FirstContactIdentity: FC<FirstContactIdentityProps> = ({
  state = 'idle',
  reducedMotion = false,
  className,
}) => {
  const stateClass =
    state === 'connected'
      ? styles.stateConnected
      : state === 'blocked'
        ? styles.stateBlocked
        : styles.stateIdle;

  const motionClass = reducedMotion ? styles.reducedMotion : '';

  return (
    <div
      className={`${styles.identityContainer} ${stateClass} ${motionClass} ${className ?? ''}`}
      aria-hidden="true"
      role="presentation"
    >
      <svg
        viewBox="0 0 110 42"
        className={styles.svgBridge}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left Arm (Lunar Regolith / Altimetry facet geometry) */}
        <path
          className={styles.armLeft}
          d="M 2 32 L 18 10 L 28 16 L 36 6 L 44 12 L 50 10 L 48 24 L 44 32 L 34 30 L 26 36 L 16 32 Z"
        />

        {/* Right Arm (Cosmic / Earth Telemetry geometry) */}
        <path
          className={styles.armRight}
          d="M 108 32 L 92 10 L 82 16 L 74 6 L 66 12 L 60 10 L 62 24 L 66 32 L 76 30 L 84 36 L 94 32 Z"
        />

        {/* Topographic wireframe lattice lines */}
        <path
          className={styles.wireframe}
          d="M 8 30 L 20 12 L 30 18 L 36 8 L 44 14 L 48 10 L 46 22 M 102 30 L 90 12 L 80 18 L 74 8 L 66 14 L 62 10 L 64 22"
        />

        {/* Dynamic Telemetry Spark Gap / Coherent Beam */}
        <line
          className={styles.beam}
          x1="48"
          y1="22"
          x2="62"
          y2="22"
        />

        {/* Focal Point of Contact (Center Laser Spark) */}
        <circle
          className={styles.spark}
          cx="55"
          cy="22"
          r="2.8"
        />
      </svg>
    </div>
  );
};

export default FirstContactIdentity;
