import React from 'react';
import MobileV2 from '@/mobile-v2/MobileV2.jsx';
import './new.css';

// Keep preview presentation in one route module. Existing providers and data
// services stay shared with the main application.
export default function NewApp() {
  return <div className="sf-new"><MobileV2 redesigned /></div>;
}
