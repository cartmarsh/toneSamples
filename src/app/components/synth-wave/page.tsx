'use client'

import React, { useRef, useEffect, useState } from 'react'
import * as Tone from 'tone'

interface WaveformPoint {
  x: number
  y: number
  time: number
  isNewLine?: boolean
  gapDuration?: number  // Duration of gap before this point
}

interface SavedSound {
  id: number
  name: string
  points: WaveformPoint[]
  waveform: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom'
  effects: {
    reverb: number
    distortion: number
  }
}

interface TimelineEvent {
  id: string
  soundId: number
  startTime: number
  duration: number
  track: number
}

const SynthWavePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [synth, setSynth] = useState<Tone.Synth | null>(null)
  const [waveformPoints, setWaveformPoints] = useState<WaveformPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedWaveform, setSelectedWaveform] = useState<'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom'>('sine')
  const [effects, setEffects] = useState({
    reverb: 0,
    distortion: 0
  })
  const [savedSounds, setSavedSounds] = useState<SavedSound[]>([])
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSoundName, setCurrentSoundName] = useState('')
  const [draggingEvent, setDraggingEvent] = useState<TimelineEvent | null>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const PIXELS_PER_SECOND = 100
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [activeEvents, setActiveEvents] = useState<string[]>([])
  const playheadRef = useRef<number>(0)
  const animationFrameRef = useRef<number>()
  const [startTime, setStartTime] = useState<number | null>(null)
  const [lastDrawTime, setLastDrawTime] = useState<number | null>(null)
  const [lastLineEndTime, setLastLineEndTime] = useState<number | null>(null)
  const [selectedGap, setSelectedGap] = useState<number | null>(null)

  useEffect(() => {
    // Initialize Tone.js with effects chain
    const reverb = new Tone.Reverb({ decay: 1.5, wet: effects.reverb }).toDestination()
    const distortion = new Tone.Distortion(effects.distortion).connect(reverb)
    const newSynth = new Tone.Synth({
      oscillator: {
        type: selectedWaveform === 'custom' ? 'sine' : selectedWaveform
      }
    }).connect(distortion)

    setSynth(newSynth)

    return () => {
      newSynth.dispose()
      reverb.dispose()
      distortion.dispose()
    }
  }, [selectedWaveform, effects])

  const drawWaveform = (ctx: CanvasRenderingContext2D, points: WaveformPoint[]) => {
    const { width, height } = ctx.canvas
    ctx.clearRect(0, 0, width, height)
    
    let currentPath: WaveformPoint[] = []
    
    points.forEach((point) => {
      if (point.isNewLine && currentPath.length > 0) {
        // Draw the current path
        ctx.beginPath()
        ctx.strokeStyle = '#4CAF50'
        ctx.lineWidth = 2
        
        currentPath.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        })
        
        ctx.stroke()

        // Draw gap indicator if there's a gap
        if (point.gapDuration) {
          const lastPoint = currentPath[currentPath.length - 1]
          const gapWidth = point.gapDuration * 50 // Scale factor for visualization
          
          ctx.beginPath()
          ctx.strokeStyle = selectedGap === points.indexOf(point) ? '#FF4444' : '#888888'
          ctx.setLineDash([5, 5])
          ctx.moveTo(lastPoint.x, lastPoint.y)
          ctx.lineTo(lastPoint.x + gapWidth, lastPoint.y)
          ctx.stroke()
          ctx.setLineDash([])

          // Draw gap adjustment handle
          ctx.fillStyle = '#888888'
          ctx.beginPath()
          ctx.arc(lastPoint.x + gapWidth, lastPoint.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }

        currentPath = [point]
      } else {
        currentPath.push(point)
      }
    })
    
    // Draw the last path
    if (currentPath.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = '#4CAF50'
      ctx.lineWidth = 2
      currentPath.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.stroke()
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const currentTime = Tone.now()

    if (!startTime) {
      setStartTime(currentTime)
    }

    // Calculate gap duration if this is a new line after a previous one
    let gapDuration = 0
    if (lastLineEndTime) {
      gapDuration = currentTime - lastLineEndTime
    }

    const newPoint = {
      x,
      y,
      time: currentTime - (startTime || currentTime),
      isNewLine: true,
      gapDuration
    }

    setWaveformPoints(prev => [...prev, newPoint])
    setLastDrawTime(currentTime)
    
    if (synth) {
      const frequency = mapToFrequency(y, canvas.height)
      synth.triggerAttack(frequency)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !synth || !lastDrawTime) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const currentTime = Tone.now()
    const timeDiff = currentTime - lastDrawTime

    const newPoint = {
      x,
      y,
      time: currentTime - (startTime || currentTime),
      isNewLine: timeDiff > 0.1
    }

    if (newPoint.isNewLine) {
      synth.triggerRelease('+0')
      synth.triggerAttack(mapToFrequency(y, canvas.height))
    } else {
      synth.frequency.setValueAtTime(mapToFrequency(y, canvas.height), '+0')
    }

    setWaveformPoints(prev => [...prev, newPoint])
    drawWaveform(ctx, [...waveformPoints, newPoint])
    setLastDrawTime(currentTime)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    synth?.triggerRelease()
    setLastLineEndTime(Tone.now())
  }

  const mapToFrequency = (y: number, height: number) => {
    return 880 - (y / height) * (880 - 110)
  }

  const handleWaveformChange = (type: 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom') => {
    setSelectedWaveform(type)
    if (synth) {
      synth.oscillator.type = type === 'custom' ? 'sine' : type
    }
  }

  const handleEffectChange = (effect: 'reverb' | 'distortion', value: number) => {
    setEffects(prev => ({ ...prev, [effect]: value }))
  }

  const saveCurrentSound = () => {
    if (waveformPoints.length === 0 || !currentSoundName) return
    if (savedSounds.length >= 10) {
      alert('Maximum 10 sounds can be saved')
      return
    }

    const newSound: SavedSound = {
      id: Date.now(),
      name: currentSoundName,
      points: [...waveformPoints],
      waveform: selectedWaveform,
      effects: { ...effects }
    }

    setSavedSounds(prev => [...prev, newSound])
    setCurrentSoundName('')
  }

  const playSound = async (points: WaveformPoint[], duration = 1, delayStart = 0) => {
    if (!synth) return

    const now = Tone.now() + delayStart
    let lastPoint = points[0]

    points.forEach((point, index) => {
      const time = now + point.time
      const frequency = mapToFrequency(point.y, canvasRef.current?.height || 400)
      
      if (point.isNewLine) {
        // If there's a gap duration, schedule the release and new attack
        if (point.gapDuration && point.gapDuration > 0) {
          // Release at the start of the gap
          const gapStartTime = time - point.gapDuration
          synth.triggerRelease(gapStartTime)
          // Start new note after the gap
          synth.triggerAttack(frequency, time)
        } else {
          // No gap, just start new note
          synth.triggerAttack(frequency, time)
        }
      } else {
        // Continue the current note with new frequency
        synth.frequency.setValueAtTime(frequency, time)
      }
      
      lastPoint = point
    })

    // Final release
    const finalTime = now + lastPoint.time + 0.05
    synth.triggerRelease(finalTime)
  }

  const playSavedSound = (soundId: number) => {
    const sound = savedSounds.find(s => s.id === soundId)
    if (!sound) return
    playSound(sound.points)
  }

  const addToTimeline = (soundId: number, track: number) => {
    const newEvent: TimelineEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      soundId,
      startTime: 0,
      duration: 1,
      track
    }
    setTimelineEvents(prev => [...prev, newEvent])
  }

  // Update playhead animation
  const updatePlayhead = (startTime: number) => {
    const animate = () => {
      const currentTime = (Tone.now() - startTime)
      playheadRef.current = currentTime
      setPlayheadPosition(currentTime)

      // Update active events
      const currentActive = timelineEvents
        .filter(event => 
          currentTime >= event.startTime && 
          currentTime <= event.startTime + event.duration
        )
        .map(event => event.id)
      setActiveEvents(currentActive)

      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animate()
  }

  const stopPlayhead = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setPlayheadPosition(0)
    setActiveEvents([])
  }

  const playTimeline = async () => {
    setIsPlaying(true)
    const startTime = Tone.now()
    updatePlayhead(startTime)

    timelineEvents.forEach(event => {
      const sound = savedSounds.find(s => s.id === event.soundId)
      if (!sound) return

      // Pass the event's start time as a delay
      playSound(sound.points, event.duration, event.startTime)
    })

    const duration = Math.max(...timelineEvents.map(e => e.startTime + e.duration))
    setTimeout(() => {
      setIsPlaying(false)
      stopPlayhead()
    }, duration * 1000)
  }

  const handleDragStart = (event: TimelineEvent) => {
    setDraggingEvent(event)
  }

  const handleTimelineDragOver = (e: React.DragEvent, track: number) => {
    e.preventDefault()
    if (!draggingEvent || !timelineRef.current) return

    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newStartTime = Math.max(0, x / PIXELS_PER_SECOND)

    // Update event position
    setTimelineEvents(prev => prev.map(ev => 
      ev.id === draggingEvent.id
        ? { ...ev, startTime: newStartTime, track }
        : ev
    ))
  }

  const handleDragEnd = () => {
    setDraggingEvent(null)
  }

  const clearDrawing = () => {
    setWaveformPoints([])
    setStartTime(null)
    setLastDrawTime(null)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    }
  }

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // Add gap adjustment functionality
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if we clicked near a gap handle
    const gapPoint = waveformPoints.findIndex((point, index) => {
      if (!point.gapDuration) return false
      const prevPoint = waveformPoints[index - 1]
      if (!prevPoint) return false

      const handleX = prevPoint.x + (point.gapDuration * 50)
      const handleY = prevPoint.y
      
      return Math.abs(x - handleX) < 10 && Math.abs(y - handleY) < 10
    })

    setSelectedGap(gapPoint >= 0 ? gapPoint : null)
  }

  const handleGapAdjustment = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedGap === null || !isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    
    // Update gap duration based on drag distance
    setWaveformPoints(prev => {
      const newPoints = [...prev]
      const point = newPoints[selectedGap]
      if (point) {
        const prevPoint = newPoints[selectedGap - 1]
        if (prevPoint) {
          const newGapDuration = Math.max(0, (x - prevPoint.x) / 50)
          point.gapDuration = newGapDuration
        }
      }
      return newPoints
    })

    const ctx = canvas.getContext('2d')
    if (ctx) {
      drawWaveform(ctx, waveformPoints)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex space-x-4 mb-4">
        {['sine', 'square', 'sawtooth', 'triangle', 'custom'].map((type) => (
          <button
            key={type}
            onClick={() => handleWaveformChange(type as any)}
            className={`px-4 py-2 rounded ${
              selectedWaveform === type ? 'bg-green-500 text-white' : 'bg-gray-200'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Reverb</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={effects.reverb}
            onChange={(e) => handleEffectChange('reverb', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Distortion</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={effects.distortion}
            onChange={(e) => handleEffectChange('distortion', parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      <div className="w-full h-[400px] bg-gray-900 rounded-lg">
        <canvas
          ref={canvasRef}
          className="w-full h-full border border-gray-700 rounded cursor-crosshair"
          onMouseDown={(e) => {
            if (selectedGap !== null) {
              setIsDrawing(true)
            } else {
              startDrawing(e)
            }
          }}
          onClick={handleCanvasClick}
          onMouseMove={(e) => {
            if (selectedGap !== null) {
              handleGapAdjustment(e)
            } else {
              draw(e)
            }
          }}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          width={800}
          height={400}
        />
      </div>

      {/* Save Sound Controls */}
      <div className="flex space-x-4 items-center">
        <input
          type="text"
          value={currentSoundName}
          onChange={(e) => setCurrentSoundName(e.target.value)}
          placeholder="Sound name"
          className="px-4 py-2 border rounded"
        />
        <button
          onClick={saveCurrentSound}
          disabled={!currentSoundName || waveformPoints.length === 0}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Save Sound
        </button>
        <button
          onClick={clearDrawing}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Clear Drawing
        </button>
      </div>

      {/* Saved Sounds List */}
      <div className="grid grid-cols-2 gap-4">
        {savedSounds.map(sound => (
          <div key={sound.id} className="p-4 border rounded">
            <h3 className="font-bold">{sound.name}</h3>
            <div className="flex space-x-2 mt-2">
              <button
                onClick={() => playSavedSound(sound.id)}
                className="px-3 py-1 bg-green-500 text-white rounded"
              >
                Play
              </button>
              <button
                onClick={() => addToTimeline(sound.id, 0)}
                className="px-3 py-1 bg-purple-500 text-white rounded"
              >
                Add to Timeline
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Enhanced Timeline */}
      <div className="border rounded p-4">
        <div className="flex justify-between mb-4">
          <h2 className="text-lg font-bold">Timeline</h2>
          <button
            onClick={playTimeline}
            disabled={isPlaying || timelineEvents.length === 0}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            Play Timeline
          </button>
        </div>

        {/* Timeline ruler and playhead */}
        <div className="h-6 border-b mb-2 relative">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="absolute border-l h-full text-xs"
              style={{ left: `${i * PIXELS_PER_SECOND}px` }}
            >
              {i}s
            </div>
          ))}
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
            style={{ 
              left: `${playheadPosition * PIXELS_PER_SECOND}px`,
              transform: 'translateX(-50%)'
            }}
          />
        </div>

        {/* Timeline tracks */}
        <div 
          ref={timelineRef}
          className="relative w-full overflow-x-auto"
          style={{ minHeight: '200px' }}
        >
          {[0, 1, 2].map(track => (
            <div
              key={track}
              className="flex h-16 bg-gray-100 dark:bg-gray-800 rounded mb-2 relative"
              onDragOver={(e) => handleTimelineDragOver(e, track)}
            >
              {/* Playhead line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{ 
                  left: `${playheadPosition * PIXELS_PER_SECOND}px`,
                  transform: 'translateX(-50%)'
                }}
              />
              {timelineEvents
                .filter(event => event.track === track)
                .map(event => {
                  const sound = savedSounds.find(s => s.id === event.soundId)
                  return (
                    <div
                      key={event.id}
                      draggable
                      onDragStart={() => handleDragStart(event)}
                      onDragEnd={handleDragEnd}
                      className={`absolute px-2 py-1 rounded cursor-move transition-all
                        ${activeEvents.includes(event.id) 
                          ? 'bg-purple-400 dark:bg-purple-500' 
                          : 'bg-purple-200 dark:bg-purple-700'
                        } hover:bg-purple-300 dark:hover:bg-purple-600`}
                      style={{
                        left: `${event.startTime * PIXELS_PER_SECOND}px`,
                        width: `${event.duration * PIXELS_PER_SECOND}px`,
                        top: '4px',
                        bottom: '4px'
                      }}
                    >
                      <div className="text-sm truncate">
                        {sound?.name}
                      </div>
                      {/* Resize handles */}
                      <div
                        className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize"
                        onMouseDown={(e) => {
                          // Add resize logic here
                        }}
                      />
                    </div>
                  )
                })}
            </div>
          ))}
        </div>

        {/* Timeline controls */}
        <div className="mt-4 flex space-x-4">
          <button
            onClick={() => setTimelineEvents([])}
            className="px-3 py-1 bg-red-500 text-white rounded"
          >
            Clear Timeline
          </button>
        </div>
      </div>
    </div>
  )
}

export default SynthWavePage 