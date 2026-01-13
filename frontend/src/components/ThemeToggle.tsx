import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="p-2.5 glass rounded-xl transition-all duration-300">
        <div className="w-5 h-5" />
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2.5 glass rounded-xl hover:border-primary/40 hover:shadow-glow-purple transition-all duration-300 group"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-secondary group-hover:text-secondary/80 transition-colors" />
      ) : (
        <Moon className="w-5 h-5 text-primary group-hover:text-primary/80 transition-colors" />
      )}
    </button>
  );
};
