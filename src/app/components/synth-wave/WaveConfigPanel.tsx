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
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Waveform Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3">Waveform Type</h3>
          <div className="flex flex-wrap gap-2">
            {(['sine', 'square', 'sawtooth', 'triangle', 'custom'] as const).map((type) => (
              <button
                key={type}
                onClick={() => onWaveformChange(type)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedWaveform === type 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Effects */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold mb-3">Effects</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Reverb</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={effects.reverb}
                onChange={(e) => onEffectChange('reverb', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>{effects.reverb.toFixed(2)}</span>
                <span>1</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Distortion</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={effects.distortion}
                onChange={(e) => onEffectChange('distortion', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>{effects.distortion.toFixed(2)}</span>
                <span>1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawing Configuration */}
        <div className="space-y-4 md:col-span-2">
          <h3 className="text-lg font-semibold mb-3">Drawing Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tempo (BPM)</label>
              <input
                type="number"
                min="30"
                max="240"
                value={drawingConfig.tempo}
                onChange={(e) => onDrawingConfigChange({ tempo: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Grid Size</label>
              <select
                value={drawingConfig.gridSize}
                onChange={(e) => onDrawingConfigChange({ gridSize: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="4">1/4 Beat</option>
                <option value="8">1/8 Beat</option>
                <option value="16">1/16 Beat</option>
                <option value="32">1/32 Beat</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="snapToGrid"
                  checked={drawingConfig.snapToGrid}
                  onChange={(e) => onDrawingConfigChange({ snapToGrid: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="snapToGrid" className="text-sm font-medium">Snap to Grid</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="autoConnect"
                  checked={drawingConfig.autoConnect}
                  onChange={(e) => onDrawingConfigChange({ autoConnect: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="autoConnect" className="text-sm font-medium">Auto-Connect Points</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="loopMode"
                  checked={drawingConfig.loopMode}
                  onChange={(e) => onDrawingConfigChange({ loopMode: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="loopMode" className="text-sm font-medium">Loop Mode</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WaveConfigPanel
