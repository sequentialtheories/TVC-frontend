import React from 'react';

const BackgroundAnimations: React.FC = () => {
  return (
    <div className="background-animations fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Layer 1: Far (slowest) - Morphing Gradient Blobs */}
      <div className="layer-far absolute inset-0">
        {/* Large morphing blob - purple */}
        <div className="morphing-blob blob-1 absolute w-[500px] h-[500px] -top-32 -left-32 opacity-[0.08] dark:opacity-[0.12] blur-[100px] bg-gradient-to-br from-purple-glow to-pink-glow animate-blob-morph" />
        
        {/* Large morphing blob - cyan */}
        <div className="morphing-blob blob-2 absolute w-[400px] h-[400px] top-1/3 -right-20 opacity-[0.06] dark:opacity-[0.10] blur-[80px] bg-gradient-to-br from-cyan-glow to-emerald-glow animate-blob-morph-reverse" style={{ animationDelay: '-15s' }} />
        
        {/* Large morphing blob - pink */}
        <div className="morphing-blob blob-3 absolute w-[450px] h-[450px] -bottom-40 left-1/4 opacity-[0.07] dark:opacity-[0.11] blur-[90px] bg-gradient-to-br from-strand-1 to-purple-glow animate-blob-morph" style={{ animationDelay: '-30s' }} />
      </div>

      {/* Layer 2: Mid - Animated Spirals & Geometric Elements */}
      <div className="layer-mid absolute inset-0">
        {/* Spiral SVG 1 */}
        <svg className="absolute top-10 left-10 w-64 h-64 opacity-[0.04] dark:opacity-[0.06] animate-spiral-rotate" viewBox="0 0 200 200">
          <path
            d="M100,100 m0,-80 a80,80 0 1,1 0,160 a70,70 0 1,0 0,-140 a60,60 0 1,1 0,120 a50,50 0 1,0 0,-100 a40,40 0 1,1 0,80 a30,30 0 1,0 0,-60 a20,20 0 1,1 0,40"
            fill="none"
            stroke="url(#spiralGradient1)"
            strokeWidth="1.5"
          />
          <defs>
            <linearGradient id="spiralGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--purple-glow))" />
              <stop offset="100%" stopColor="hsl(var(--cyan-glow))" />
            </linearGradient>
          </defs>
        </svg>

        {/* Spiral SVG 2 */}
        <svg className="absolute bottom-20 right-20 w-48 h-48 opacity-[0.03] dark:opacity-[0.05] animate-spiral-rotate-reverse" viewBox="0 0 200 200">
          <path
            d="M100,100 m0,-70 a70,70 0 1,1 0,140 a60,60 0 1,0 0,-120 a50,50 0 1,1 0,100 a40,40 0 1,0 0,-80 a30,30 0 1,1 0,60"
            fill="none"
            stroke="url(#spiralGradient2)"
            strokeWidth="1"
          />
          <defs>
            <linearGradient id="spiralGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--strand-1))" />
              <stop offset="100%" stopColor="hsl(var(--strand-3))" />
            </linearGradient>
          </defs>
        </svg>

        {/* Geometric rounded squares */}
        <div className="geometric-square absolute top-1/4 right-1/3 w-16 h-16 rounded-2xl border border-purple-glow/10 dark:border-purple-glow/20 animate-geometric-drift" />
        <div className="geometric-square absolute bottom-1/3 left-1/4 w-12 h-12 rounded-xl border border-cyan-glow/10 dark:border-cyan-glow/20 animate-geometric-drift-alt" style={{ animationDelay: '-10s' }} />
        <div className="geometric-square absolute top-2/3 right-1/4 w-20 h-20 rounded-3xl border border-strand-1/10 dark:border-strand-1/15 animate-geometric-drift" style={{ animationDelay: '-20s' }} />

        {/* Thin rotating lines */}
        <div className="absolute top-1/2 left-1/3 w-40 h-px bg-gradient-to-r from-transparent via-purple-glow/10 dark:via-purple-glow/20 to-transparent animate-line-rotate origin-center" />
        <div className="absolute top-1/3 right-1/3 w-32 h-px bg-gradient-to-r from-transparent via-cyan-glow/10 dark:via-cyan-glow/20 to-transparent animate-line-rotate-reverse origin-center" style={{ animationDelay: '-30s' }} />
      </div>

      {/* Layer 3: Near - Floating Particles on Curved Paths */}
      <div className="layer-near absolute inset-0">
        {/* Particle path container with SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          <defs>
            {/* Curved paths for particles */}
            <path id="curvePath1" d="M0,200 Q250,100 500,300 T1000,200" fill="none" />
            <path id="curvePath2" d="M0,500 Q200,400 400,600 Q600,800 800,500 T1000,600" fill="none" />
            <path id="curvePath3" d="M0,800 Q300,700 500,900 Q700,1100 1000,700" fill="none" />
            <path id="curvePath4" d="M1000,300 Q800,200 600,400 Q400,600 200,300 T0,400" fill="none" />
          </defs>
          
          {/* Particles following paths */}
          <circle r="3" fill="hsl(var(--purple-glow))" opacity="0.3" className="dark:opacity-50">
            <animateMotion dur="70s" repeatCount="indefinite">
              <mpath href="#curvePath1" />
            </animateMotion>
          </circle>
          <circle r="2" fill="hsl(var(--cyan-glow))" opacity="0.25" className="dark:opacity-40">
            <animateMotion dur="80s" repeatCount="indefinite" begin="-20s">
              <mpath href="#curvePath2" />
            </animateMotion>
          </circle>
          <circle r="4" fill="hsl(var(--strand-1))" opacity="0.2" className="dark:opacity-35">
            <animateMotion dur="90s" repeatCount="indefinite" begin="-40s">
              <mpath href="#curvePath3" />
            </animateMotion>
          </circle>
          <circle r="2.5" fill="hsl(var(--emerald-glow))" opacity="0.25" className="dark:opacity-40">
            <animateMotion dur="75s" repeatCount="indefinite" begin="-10s">
              <mpath href="#curvePath4" />
            </animateMotion>
          </circle>
          <circle r="3" fill="hsl(var(--strand-3))" opacity="0.2" className="dark:opacity-35">
            <animateMotion dur="85s" repeatCount="indefinite" begin="-50s">
              <mpath href="#curvePath1" />
            </animateMotion>
          </circle>
          <circle r="2" fill="hsl(var(--pink-glow))" opacity="0.25" className="dark:opacity-40">
            <animateMotion dur="65s" repeatCount="indefinite" begin="-30s">
              <mpath href="#curvePath2" />
            </animateMotion>
          </circle>
        </svg>

        {/* Soft floating circles */}
        <div className="absolute top-1/5 left-1/5 w-2 h-2 rounded-full bg-purple-glow/20 dark:bg-purple-glow/40 blur-sm animate-float-gentle" />
        <div className="absolute top-2/3 right-1/5 w-3 h-3 rounded-full bg-cyan-glow/15 dark:bg-cyan-glow/30 blur-sm animate-float-gentle-alt" style={{ animationDelay: '-5s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 rounded-full bg-strand-1/20 dark:bg-strand-1/35 blur-sm animate-float-gentle" style={{ animationDelay: '-12s' }} />
        <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 rounded-full bg-emerald-glow/15 dark:bg-emerald-glow/30 blur-sm animate-float-gentle-alt" style={{ animationDelay: '-8s' }} />
      </div>
    </div>
  );
};

export default BackgroundAnimations;
