import React from "react";
import BackgroundAnimations from "@/components/BackgroundAnimations";

/**
 * Static background layer that should not re-render on form input changes.
 * Memoized to prevent animation restarts (SVG SMIL + CSS keyframes).
 */
const VaultBackground = React.memo(function VaultBackground() {
  return (
    <>
      {/* Premium animated background */}
      <div className="orb-container">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="orb orb-3"></div>
      </div>

      {/* Enhanced background animations - spirals, particles, morphing blobs */}
      <BackgroundAnimations />

      {/* Grid pattern overlay */}
      <div className="grid-pattern"></div>

      {/* Noise texture */}
      <div className="noise-overlay"></div>

      {/* Subtle scan line effect */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="scan-line w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>
      </div>
    </>
  );
});

export default VaultBackground;
