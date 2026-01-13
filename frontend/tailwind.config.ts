import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Custom DeFi theme colors
        purple: {
          glow: "hsl(var(--purple-glow))",
        },
        emerald: {
          glow: "hsl(var(--emerald-glow))",
        },
        cyan: {
          glow: "hsl(var(--cyan-glow))",
        },
        orange: {
          glow: "hsl(var(--orange-glow))",
        },
        pink: {
          glow: "hsl(var(--pink-glow))",
        },
        indigo: {
          glow: "hsl(var(--indigo-glow))",
        },
        strand: {
          1: "hsl(var(--strand-1))",
          2: "hsl(var(--strand-2))",
          3: "hsl(var(--strand-3))",
          btc: "hsl(var(--strand-btc))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 16px)",
      },
      boxShadow: {
        'elegant': '0 4px 24px -4px hsl(0 0% 0% / 0.3)',
        'card': '0 8px 32px -8px hsl(0 0% 0% / 0.4)',
        'glow-purple': '0 0 40px hsl(265 50% 55% / 0.2)',
        'glow-emerald': '0 0 40px hsl(165 45% 42% / 0.2)',
        'glow-cyan': '0 0 40px hsl(185 65% 48% / 0.2)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-15px)" },
        },
        "pulse-glow": {
          "0%, 100%": { 
            boxShadow: "0 0 20px hsl(265 50% 55% / 0.3), 0 0 40px hsl(165 45% 42% / 0.15)",
            opacity: "0.9"
          },
          "50%": { 
            boxShadow: "0 0 30px hsl(265 50% 55% / 0.4), 0 0 50px hsl(165 45% 42% / 0.2)",
            opacity: "1"
          },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        float: "float 8s ease-in-out infinite",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
        "fade-up": "fade-up 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "fade-in": "fade-in 0.4s ease-out forwards",
        "scale-in": "scale-in 0.3s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;