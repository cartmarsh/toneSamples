'use client'

import React from 'react'
import styles from './WaveConfigPanel.module.css'

interface WaveConfigPanelProps {
  selectedWaveform: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom'
  effects: {
    reverb: number
    distortion: number
  }
  drawingConfig: {
    tempo: number
    gridSize: number
    snapToGrid: boolean
    autoConnect: boolean
    loopMode: boolean
  }
  onWaveformChange: (type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom') => void
  onEffectChange: (effect: 'reverb' | 'distortion', value: number) => void
  onDrawingConfigChange: (config: Partial<WaveConfigPanelProps['drawingConfig']>) => void
}

const WaveConfigPanel: React.FC<WaveConfigPanelProps> = ({
  selectedWaveform,
  effects,
  drawingConfig,
  onWaveformChange,
  onEffectChange,
  onDrawingConfigChange,
}) => {
  return (
    <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Waveform Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3 text-white">Waveform Type</h3>
          <div className="flex flex-wrap gap-2">
            {(['sine', 'square', 'sawtooth', 'triangle', 'custom'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onWaveformChange(type)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedWaveform === type 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-100'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Effects Controls */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3 text-white">Effects</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reverb: {effects.reverb.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={effects.reverb}
                onChange={(e) => onEffectChange('reverb', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Distortion: {effects.distortion.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={effects.distortion}
                onChange={(e) => onEffectChange('distortion', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Drawing Configuration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3 text-white">Drawing Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tempo: {drawingConfig.tempo} BPM
              </label>
              <input
                type="range"
                min="60"
                max="200"
                value={drawingConfig.tempo}
                onChange={(e) => onDrawingConfigChange({ tempo: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Grid Size: {drawingConfig.gridSize}
              </label>
              <input
                type="range"
                min="4"
                max="32"
                value={drawingConfig.gridSize}
                onChange={(e) => onDrawingConfigChange({ gridSize: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={drawingConfig.snapToGrid}
                  onChange={(e) => onDrawingConfigChange({ snapToGrid: e.target.checked })}
                  className="rounded border-gray-700"
                />
                Snap to Grid
              </label>
              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={drawingConfig.autoConnect}
                  onChange={(e) => onDrawingConfigChange({ autoConnect: e.target.checked })}
                  className="rounded border-gray-700"
                />
                Auto Connect
              </label>
              <label className="flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={drawingConfig.loopMode}
                  onChange={(e) => onDrawingConfigChange({ loopMode: e.target.checked })}
                  className="rounded border-gray-700"
                />
                Loop Mode
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WaveConfigPanel
