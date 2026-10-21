import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import Journal from './Journal';
import '@/index.css';

if (document.cookie.split('; ').includes('theme=dark')) document.documentElement.classList.add('dark');
hydrateRoot(document.getElementById('journal-root'), <Journal path={location.pathname} />);
