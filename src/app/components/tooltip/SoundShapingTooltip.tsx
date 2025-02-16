'use client'

import React from 'react';
import styles from './SoundShapingTooltip.module.css';

interface SoundShapingTooltipProps {
  onWaveformChange: (waveform: 'sine' | 'square' | 'sawtooth' | 'triangle') => void;
  onVolumeChange: (volume: number) => void;
  onFrequencyRangeChange: (min: number, max: number) => void;
  onADSRChange: (attack: number, decay: number, sustain: number, release: number) => void;
  onVibratoChange: (rate: number, depth: number) => void;
  currentSettings: {
    waveform: string;
    volume: number;
    frequencyRange: { min: number; max: number };
    adsr: { attack: number; decay: number; sustain: number; release: number };
    vibrato: { rate: number; depth: number };
  };
}

const SoundShapingTooltip: React.FC<SoundShapingTooltipProps> = ({
  onWaveformChange,
  onVolumeChange,
  onFrequencyRangeChange,
  onADSRChange,
  onVibratoChange,
  currentSettings,
}) => {
  return (
    <div className={styles.soundShapingTooltip}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Current State</h3>
        <div className={styles.stateGrid}>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>Waveform:</span>
            <span className={styles.stateValue}>{currentSettings.waveform}</span>
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>Volume:</span>
            <span className={styles.stateValue}>{(currentSettings.volume * 100).toFixed(0)}%</span>
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>Frequency:</span>
            <span className={styles.stateValue}>
              {currentSettings.frequencyRange.min}Hz - {currentSettings.frequencyRange.max}Hz
            </span>
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>ADSR:</span>
            <span className={styles.stateValue}>
              {currentSettings.adsr.attack}s, {currentSettings.adsr.decay}s, {(currentSettings.adsr.sustain * 100).toFixed(0)}%, {currentSettings.adsr.release}s
            </span>
          </div>
          <div className={styles.stateItem}>
            <span className={styles.stateLabel}>Vibrato:</span>
            <span className={styles.stateValue}>
              {currentSettings.vibrato.rate}Hz @ {(currentSettings.vibrato.depth * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Waveform</h3>
        <select
          value={currentSettings.waveform}
          onChange={(e) => onWaveformChange(e.target.value as any)}
          className={styles.selectInput}
        >
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="sawtooth">Sawtooth</option>
          <option value="triangle">Triangle</option>
        </select>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Volume</h3>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={currentSettings.volume}
          onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          className={styles.rangeInput}
        />
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Frequency Range</h3>
        <div className={styles.rangeInputs}>
          <input
            type="range"
            min="20"
            max="2000"
            value={currentSettings.frequencyRange.min}
            onChange={(e) => onFrequencyRangeChange(parseInt(e.target.value), currentSettings.frequencyRange.max)}
            className={styles.rangeInput}
          />
          <span>to</span>
          <input
            type="range"
            min="20"
            max="2000"
            value={currentSettings.frequencyRange.max}
            onChange={(e) => onFrequencyRangeChange(currentSettings.frequencyRange.min, parseInt(e.target.value))}
            className={styles.rangeInput}
          />
          <span>Hz</span>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>ADSR Envelope</h3>
        <div className={styles.adsrControls}>
          <div>
            <label>A</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={currentSettings.adsr.attack}
              onChange={(e) => onADSRChange(parseFloat(e.target.value), currentSettings.adsr.decay, currentSettings.adsr.sustain, currentSettings.adsr.release)}
              className={styles.rangeInput}
            />
          </div>
          <div>
            <label>D</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={currentSettings.adsr.decay}
              onChange={(e) => onADSRChange(currentSettings.adsr.attack, parseFloat(e.target.value), currentSettings.adsr.sustain, currentSettings.adsr.release)}
              className={styles.rangeInput}
            />
          </div>
          <div>
            <label>S</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={currentSettings.adsr.sustain}
              onChange={(e) => onADSRChange(currentSettings.adsr.attack, currentSettings.adsr.decay, parseFloat(e.target.value), currentSettings.adsr.release)}
              className={styles.rangeInput}
            />
          </div>
          <div>
            <label>R</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={currentSettings.adsr.release}
              onChange={(e) => onADSRChange(currentSettings.adsr.attack, currentSettings.adsr.decay, currentSettings.adsr.sustain, parseFloat(e.target.value))}
              className={styles.rangeInput}
            />
          </div>
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Vibrato</h3>
        <div className={styles.vibratoControls}>
          <div>
            <label>Rate</label>
            <input
              type="range"
              min="0"
              max="20"
              step="0.1"
              value={currentSettings.vibrato.rate}
              onChange={(e) => onVibratoChange(parseFloat(e.target.value), currentSettings.vibrato.depth)}
              className={styles.rangeInput}
            />
          </div>
          <div>
            <label>Depth</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={currentSettings.vibrato.depth}
              onChange={(e) => onVibratoChange(currentSettings.vibrato.rate, parseFloat(e.target.value))}
              className={styles.rangeInput}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoundShapingTooltip;
