'use client'

import React from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  position: { x: number; y: number };
  isVisible: boolean;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ position, isVisible, children }) => {
  if (!isVisible) return null;

  return (
    <div 
      className={styles.tooltip}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {children}
    </div>
  );
};

export default Tooltip;
