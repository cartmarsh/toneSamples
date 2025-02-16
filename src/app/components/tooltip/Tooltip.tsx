'use client'

import React, { useEffect, useRef } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  position: { x: number; y: number };
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ position, isVisible, onClose, children }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div 
      ref={tooltipRef}
      className={styles.tooltip}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button 
        onClick={onClose}
        className={styles.closeButton}
        aria-label="Close"
      >
        ×
      </button>
      {children}
    </div>
  );
};

export default Tooltip;
