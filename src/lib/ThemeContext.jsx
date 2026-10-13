import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

function savedDarkTheme() {
  if (typeof document === 'undefined') return false;
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('theme='))
    ?.split('=')[1] === 'dark';
}

export const ThemeProvider = ({ children }) => {
  // Read the persisted choice before rendering children. This avoids a light
  // flash and prevents the map from loading one style only to replace it on
  // the first effect pass.
  const [isDark, setIsDark] = useState(savedDarkTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.cookie = `theme=${isDark ? 'dark' : 'light'}; path=/; max-age=31536000`;
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(current => !current);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
