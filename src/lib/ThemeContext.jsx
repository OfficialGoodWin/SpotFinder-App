import React, { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Load theme from cookie on mount
    const saved = document.cookie
      .split('; ')
      .find(row => row.startsWith('theme='))
      ?.split('=')[1];
    
    if (saved === 'dark') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDark(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newValue = !isDark;
    setIsDark(newValue);
    
    if (newValue) {
      document.documentElement.classList.add('dark');
      document.cookie = 'theme=dark; path=/; max-age=31536000'; // 1 year
    } else {
      document.documentElement.classList.remove('dark');
      document.cookie = 'theme=light; path=/; max-age=31536000'; // 1 year
    }
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
