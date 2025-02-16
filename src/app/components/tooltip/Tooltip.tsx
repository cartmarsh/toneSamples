'use client'

import React, { useEffect, useRef, useState } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
  position: { x: number; y: number };
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ position, isVisible, onClose, children }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    const adjustPosition = () => {
      if (!tooltipRef.current) return;

      const tooltip = tooltipRef.current;
      const rect = tooltip.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      };

      let x = position.x;
      let y = position.y;

      // Adjust horizontal position if needed
      if (x + rect.width > viewport.width - 20) {
        x = viewport.width - rect.width - 20;
      }
      if (x < 20) {
        x = 20;
      }

      // Adjust vertical position if needed
      if (y + rect.height > viewport.height - 20) {
        y = viewport.height - rect.height - 20;
      }
      if (y < 20) {
        y = 20;
      }

      setAdjustedPosition({ x, y });
    };

    if (isVisible) {
      adjustPosition();
      window.addEventListener('resize', adjustPosition);
    }

    return () => {
      window.removeEventListener('resize', adjustPosition);
    };
  }, [isVisible, position]);

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
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
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
