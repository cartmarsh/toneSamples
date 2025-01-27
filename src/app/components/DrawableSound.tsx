/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'

import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'

interface Point {
  x: number
  y: number
}

// Define available oscillator types
type OscillatorType = 'sine' | 'square' | 'triangle' | 'sawtooth'

const OSCILLATOR_TYPES: OscillatorType[] = ['sine', 'square', 'triangle', 'sawtooth']

interface Drawing {
  points: Point[]
  oscillatorType: OscillatorType
}

export const DrawableSound = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [synth, setSynth] = useState<Tone.Synth | null>(null)
  const [points, setPoints] = useState<Point[]>([])
  const [oscillatorType, setOscillatorType] = useState<OscillatorType>('sine')
  const contextRef = useRef<CanvasRenderingContext2D | null>(null)
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [isReplaying, setIsReplaying] = useState(false)

  useEffect(() => {
    // Initialize synth
    const newSynth = new Tone.Synth({
      oscillator: {
        type: oscillatorType
      },
      envelope: {
        attack: 0.3,
        decay: 0.2,
        sustain: 0.6,
        release: 0.4
      }
    }).toDestination()
    setSynth(synth => {
      synth?.dispose()
      return newSynth
    })

    // Initialize canvas
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    
    const context = canvas.getContext('2d')
    if (!context) return

    context.strokeStyle = '#3b82f6'
    context.lineWidth = 2
    context.lineCap = 'round'
    contextRef.current = context

    return () => {
      newSynth.dispose()
    }
  }, [oscillatorType]) // Re-initialize synth when oscillator type changes

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = e.nativeEvent
    setIsDrawing(true)
    setPoints([{ x: offsetX, y: offsetY }])
    
    if (contextRef.current) {
      contextRef.current.beginPath()
      contextRef.current.moveTo(offsetX, offsetY)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current || !synth) return

    const { offsetX, offsetY } = e.nativeEvent
    
    // Draw line
    contextRef.current.lineTo(offsetX, offsetY)
    contextRef.current.stroke()
    
    // Add point to array (used for potential future features like playback)
    setPoints(prev => [...prev, { x: offsetX, y: offsetY }])
    
    // Convert Y position to frequency (between 20Hz and 2000Hz)
    const canvas = canvasRef.current
    if (!canvas) return
    
    const normalizedY = 1 - (offsetY / canvas.height)
    const frequency = 25 * Math.pow(100, normalizedY)
    
    // Play sound
    synth.frequency.setValueAtTime(frequency, Tone.now())
    synth.triggerAttackRelease(frequency, '16n')
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    if (contextRef.current) {
      contextRef.current.closePath()
    }
    
    // Save the drawing if there are points
    if (points.length > 0) {
      setDrawings(prev => {
        const newDrawings = [...prev, { points, oscillatorType }]
        // Keep only the last 5 drawings
        return newDrawings.slice(-5)
      })
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const context = contextRef.current
    if (!canvas || !context) return
    
    context.clearRect(0, 0, canvas.width, canvas.height)
    setPoints([])
  }

  const replayDrawing = async (drawing: Drawing) => {
    if (!synth || isReplaying) return
    
    setIsReplaying(true)
    
    // Clear canvas before replay
    clearCanvas()
    
    // Start new path
    if (contextRef.current) {
      contextRef.current.beginPath()
      contextRef.current.moveTo(drawing.points[0].x, drawing.points[0].y)
    }
    
    // Replay each point with timing
    for (let i = 0; i < drawing.points.length; i++) {
      const point = drawing.points[i]
      
      // Draw line
      if (contextRef.current) {
        contextRef.current.lineTo(point.x, point.y)
        contextRef.current.stroke()
      }
      
      // Play sound
      const canvas = canvasRef.current
      if (canvas) {
        const normalizedY = 1 - (point.y / canvas.height)
        const frequency = 25 * Math.pow(100, normalizedY)
        synth.frequency.setValueAtTime(frequency, Tone.now())
        synth.triggerAttackRelease(frequency, '16n')
      }
      
      // Wait before next point
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    
    setIsReplaying(false)
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Instructions */}
        <div className="mb-6 space-y-2">
          <h2 className="text-2xl font-semibold text-gray-800">Draw Sound</h2>
          <p className="text-gray-600">
            Draw on the canvas below to create sounds. Moving up and down changes the frequency, 
            while moving left to right changes the octave.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label htmlFor="oscillator" className="text-gray-700 font-medium">
              Oscillator Type:
            </label>
            <select
              id="oscillator"
              value={oscillatorType}
              onChange={(e) => setOscillatorType(e.target.value as OscillatorType)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="sine">Sine</option>
              <option value="square">Square</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="triangle">Triangle</option>
            </select>
          </div>
          
          <button
            onClick={clearCanvas}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-md transition-colors"
          >
            Clear Canvas
          </button>
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-[400px] border border-gray-200 rounded-lg cursor-crosshair bg-gray-50 mb-6"
        />
        
        {/* Previous Drawings */}
        {drawings.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Previous Drawings</h3>
            <div className="flex flex-wrap gap-3">
              {drawings.map((drawing, index) => (
                <button
                  key={index}
                  onClick={() => replayDrawing(drawing)}
                  disabled={isReplaying}
                  className={`
                    px-4 py-2 bg-blue-500 text-white rounded-md
                    hover:bg-blue-600 active:bg-blue-700
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors duration-200
                    flex items-center gap-2
                  `}
                >
                  <span>Drawing {drawings.length - index}</span>
                  <span className="text-xs bg-blue-600 px-2 py-1 rounded">
                    {drawing.oscillatorType}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 