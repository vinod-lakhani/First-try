/**
 * Timeline Controls Component
 * 
 * Allows users to adjust the visible time horizon (5/10/20/40 years).
 */

'use client';

import React from 'react';

export interface TimelineControlsProps {
  visibleYears: number;
  onChange: (years: number) => void;
}

export function TimelineControls({ visibleYears, onChange }: TimelineControlsProps) {
  const options = [5, 10, 20, 40];
  
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px',
      padding: '12px',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      marginBottom: '20px',
    }}>
      <label style={{ fontWeight: '600', fontSize: '14px' }}>
        Time Horizon:
      </label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {options.map((years) => (
          <button
            key={years}
            onClick={() => onChange(years)}
            style={{
              padding: '8px 16px',
              border: `2px solid ${visibleYears === years ? '#2563eb' : '#d1d5db'}`,
              borderRadius: '6px',
              backgroundColor: visibleYears === years ? '#2563eb' : 'white',
              color: visibleYears === years ? 'white' : '#374151',
              fontWeight: visibleYears === years ? '600' : '400',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (visibleYears !== years) {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
              }
            }}
            onMouseLeave={(e) => {
              if (visibleYears !== years) {
                e.currentTarget.style.backgroundColor = 'white';
              }
            }}
          >
            {years}Y
          </button>
        ))}
      </div>
    </div>
  );
}

