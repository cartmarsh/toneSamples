'use client'

import React, { useRef, useEffect, useState } from 'react'
import * as Tone from 'tone'
import Tooltip from '../tooltip/Tooltip'
import SoundShapingTooltip from '../tooltip/SoundShapingTooltip'
import WaveConfigPanel from './WaveConfigPanel'

interface WaveformPoint {
  x: number
  y: number
  time: number
  isNewLine?: boolean
  gapDuration?: number  // Duration of gap before this point
}

type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom'
type EffectType = 'reverb' | 'distortion'

interface SavedSound {
  id: number
  name: string
  points: WaveformPoint[]
  waveform: WaveformType
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

interface EditingState {
  isEditMode: boolean
  hoveredSegment: LineSegment | null
  selectedSegment: LineSegment | null
  tooltipPosition: { x: number; y: number } | null
  selectedLineSettings: {
    waveform: Exclude<WaveformType, 'custom'>
    volume: number
    frequencyRange: { min: number; max: number }
    adsr: { attack: number; decay: number; sustain: number; release: number }
    vibrato: { rate: number; depth: number }
  } | null
}

interface LineSegment {
  startIndex: number
  endIndex: number
  points: WaveformPoint[]
}

const SynthWavePage = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [synth, setSynth] = useState<Tone.Synth | null>(null)
  const [waveformPoints, setWaveformPoints] = useState<WaveformPoint[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [selectedWaveform, setSelectedWaveform] = useState<WaveformType>('sine')
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
  const [editingState, setEditingState] = useState<EditingState>({
    isEditMode: false,
    hoveredSegment: null,
    selectedSegment: null,
    tooltipPosition: null,
    selectedLineSettings: null
  })
  const [drawingConfig, setDrawingConfig] = useState({
    tempo: 120,
    gridSize: 16,
    snapToGrid: true,
    autoConnect: true,
    loopMode: false
  })
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);

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

  const drawWaveform = (ctx: CanvasRenderingContext2D, points: WaveformPoint[], hoveredSegment: LineSegment | null = null) => {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    let currentLine: WaveformPoint[] = []
    let gapHandles: { x: number; y: number; isSelected: boolean; pointIndex: number }[] = []
    
    points.forEach((point, index) => {
      if (point.isNewLine || index === 0) {
        if (currentLine.length > 0) {
          const isHovered = hoveredSegment && 
            index > hoveredSegment.startIndex && 
            index <= hoveredSegment.endIndex + 1
          
          drawLine(ctx, currentLine, isHovered ?? false)
          
          // Store gap handle info for later drawing
          const lastPoint = currentLine[currentLine.length - 1]
          if (lastPoint.gapDuration) {
            gapHandles.push({
              x: lastPoint.x + (lastPoint.gapDuration * 50),
              y: lastPoint.y,
              isSelected: selectedGap === index - 1,
              pointIndex: index - 1
            })
          }
        }
        currentLine = [point]
      } else {
        currentLine.push(point)
      }
    })
    
    if (currentLine.length > 0) {
      const isHovered = hoveredSegment && 
        hoveredSegment.endIndex === points.length - 1
      drawLine(ctx, currentLine, isHovered ?? false)
      
      // Store last gap handle if needed
      const lastPoint = currentLine[currentLine.length - 1]
      if (lastPoint.gapDuration) {
        gapHandles.push({
          x: lastPoint.x + (lastPoint.gapDuration * 50),
          y: lastPoint.y,
          isSelected: selectedGap === points.length - 1,
          pointIndex: points.length - 1
        })
      }
    }

    // Draw all gap handles last, so they're always on top
    gapHandles.forEach(handle => {
      ctx.beginPath()
      ctx.arc(handle.x, handle.y, 6, 0, Math.PI * 2)
      ctx.fillStyle = handle.isSelected ? '#4CAF50' : '#888888'
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.stroke()
    })
  }

  const drawLine = (ctx: CanvasRenderingContext2D, points: WaveformPoint[], isHovered: boolean) => {
    // Draw the main line
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    
    ctx.lineWidth = isHovered ? 3 : 2
    ctx.strokeStyle = isHovered ? '#4CAF50' : '#2196F3'
    ctx.stroke()

    // Draw gap indicator if this is the end of a line
    const lastPoint = points[points.length - 1]
    if (lastPoint.gapDuration) {
      const gapWidth = lastPoint.gapDuration * 50
      
      // Draw gap indicator (dotted line)
      ctx.beginPath()
      ctx.setLineDash([5, 5])
      ctx.moveTo(lastPoint.x, lastPoint.y)
      ctx.lineTo(lastPoint.x + gapWidth, lastPoint.y)
      ctx.strokeStyle = '#888888'
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])

      // Draw gap duration text
      ctx.font = '12px Arial'
      ctx.fillStyle = '#888888'
      ctx.fillText(`${lastPoint.gapDuration.toFixed(2)}s`, lastPoint.x + 5, lastPoint.y - 10)
    }
  }

  const findLineSegment = (x: number, y: number): LineSegment | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    // Get the display and actual canvas dimensions
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    // Scale the input coordinates
    const scaledX = x * scaleX
    const scaledY = y * scaleY

    let currentSegment: WaveformPoint[] = []
    let startIndex = 0

    for (let i = 0; i < waveformPoints.length; i++) {
      const point = waveformPoints[i]
      
      if (point.isNewLine && currentSegment.length > 0) {
        if (isClickNearLine(scaledX, scaledY, currentSegment)) {
          return {
            startIndex,
            endIndex: i - 1,
            points: currentSegment
          }
        }
        currentSegment = [point]
        startIndex = i
      } else {
        currentSegment.push(point)
      }
    }

    // Check last segment
    if (currentSegment.length > 0 && isClickNearLine(scaledX, scaledY, currentSegment)) {
      return {
        startIndex,
        endIndex: waveformPoints.length - 1,
        points: currentSegment
      }
    }

    return null
  }

  const isClickNearLine = (x: number, y: number, points: WaveformPoint[]): boolean => {
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1]
      const p2 = points[i]
      const distance = distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y)
      if (distance < 15) return true
    }
    return false
  }

  const distanceToLineSegment = (x: number, y: number, x1: number, y1: number, x2: number, y2: number): number => {
    const A = x - x1
    const B = y - y1
    const C = x2 - x1
    const D = y2 - y1

    const dot = A * C + B * D
    const lenSq = C * C + D * D
    let param = -1

    if (lenSq !== 0) param = dot / lenSq

    let xx, yy

    if (param < 0) {
      xx = x1
      yy = y1
    } else if (param > 1) {
      xx = x2
      yy = y2
    } else {
      xx = x1 + param * C
      yy = y1 + param * D
    }

    const dx = x - xx
    const dy = y - yy
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editingState.isEditMode || isDrawing) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const segment = findLineSegment(x, y)
    
    if (segment) {
      setEditingState(prev => ({
        ...prev,
        hoveredSegment: segment
      }))
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawWaveform(ctx, waveformPoints, segment)
      }
    } else if (editingState.hoveredSegment) {
      setEditingState(prev => ({
        ...prev,
        hoveredSegment: null
      }))
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        drawWaveform(ctx, waveformPoints)
      }
    }
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editingState.isEditMode) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setEditingState(prev => ({
      ...prev,
      tooltipPosition: { x, y }
    }));

    const segment = findLineSegment(x, y)
    if (segment) {
      setEditingState(prev => ({
        ...prev,
        selectedSegment: segment,
        selectedLineSettings: {
          waveform: selectedWaveform === 'custom' ? 'sine' : selectedWaveform,
          volume: 0.5,
          frequencyRange: { min: 20, max: 2000 },
          adsr: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.5 },
          vibrato: { rate: 5, depth: 0.1 }
        }
      }))
    }
  }

  const handleTooltipClose = () => {
    setEditingState(prev => ({
      ...prev,
      selectedSegment: null,
      tooltipPosition: null,
      selectedLineSettings: null
    }))
  }

  const updateLineSettings = (newSettings: any) => {
    setEditingState(prev => ({
      ...prev,
      selectedLineSettings: {
        ...prev.selectedLineSettings,
        ...newSettings
      }
    }))
    // Here you would also update the actual line properties in your data structure
  }

  const smoothLine = (points: WaveformPoint[]): WaveformPoint[] => {
    return points.map((point, i) => {
      if (i === 0 || i === points.length - 1) return point
      
      const prev = points[i - 1]
      const next = points[i + 1]
      
      return {
        ...point,
        x: point.x,  // Keep x the same to maintain timing
        y: (prev.y + point.y + next.y) / 3
      }
    })
  }

  const stretchLine = (points: WaveformPoint[], factor: number): WaveformPoint[] => {
    const centerY = points.reduce((sum, p) => sum + p.y, 0) / points.length
    
    return points.map(point => ({
      ...point,
      y: centerY + (point.y - centerY) * factor
    }))
  }

  const applyArpeggio = (points: WaveformPoint[]): WaveformPoint[] => {
    const baseY = points[0].y
    return points.map((point, i) => ({
      ...point,
      y: baseY + (i % 2 === 0 ? 30 : -30)
    }))
  }

  const applyEffect = (effect: 'smooth' | 'stretch' | 'arpeggio') => {
    if (!editingState.selectedSegment) return

    const { startIndex, endIndex } = editingState.selectedSegment
    const newPoints = [...waveformPoints]
    const segmentPoints = newPoints.slice(startIndex, endIndex + 1)
    
    let modifiedPoints: WaveformPoint[]
    switch (effect) {
      case 'smooth':
        modifiedPoints = smoothLine(segmentPoints)
        break
      case 'stretch':
        modifiedPoints = stretchLine(segmentPoints, 1.5)
        break
      case 'arpeggio':
        modifiedPoints = applyArpeggio(segmentPoints)
        break
    }
    
    newPoints.splice(startIndex, endIndex - startIndex + 1, ...modifiedPoints)
    setWaveformPoints(newPoints)
    
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      drawWaveform(ctx, newPoints, editingState.hoveredSegment)
    }
  }

  const getScaledCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return

    const coords = getScaledCoordinates(e)
    if (!coords) return

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
      x: coords.x,
      y: coords.y,
      time: currentTime - (startTime || currentTime),
      isNewLine: true,
      gapDuration
    }

    setWaveformPoints(prev => [...prev, newPoint])
    setLastDrawTime(currentTime)
    
    if (synth) {
      const frequency = mapToFrequency(coords.y, canvas.height)
      synth.triggerAttack(frequency)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !synth || !lastDrawTime) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getScaledCoordinates(e)
    if (!coords) return

    const currentTime = Tone.now()
    const timeDiff = currentTime - lastDrawTime

    const newPoint = {
      x: coords.x,
      y: coords.y,
      time: currentTime - (startTime || currentTime),
      isNewLine: timeDiff > 0.1
    }

    if (newPoint.isNewLine) {
      synth.triggerRelease('+0')
      synth.triggerAttack(mapToFrequency(coords.y, canvas.height))
    } else {
      synth.frequency.setValueAtTime(mapToFrequency(coords.y, canvas.height), '+0')
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

  const handleWaveformChange = (type: WaveformType) => {
    setSelectedWaveform(type)
    if (synth) {
      synth.oscillator.type = type === 'custom' ? 'sine' : type
    }
  }

  const handleEffectChange = (effect: 'reverb' | 'distortion', value: number) => {
    setEffects(prev => ({
      ...prev,
      [effect]: value
    }));
  };

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
    let currentLineStartIndex = 0

    points.forEach((point, index) => {
      const time = now + point.time
      const frequency = mapToFrequency(point.y, canvasRef.current?.height || 400)
      
      if (point.isNewLine) {
        // Release the previous line's sound
        if (index > 0) {
          const prevPoint = points[index - 1]
          if (prevPoint.gapDuration && prevPoint.gapDuration > 0) {
            // Release at the exact end of the line
            synth.triggerRelease(time - prevPoint.gapDuration)
          }
        }
        
        // Start new note after any gap
        synth.triggerAttack(frequency, time)
        currentLineStartIndex = index
      } else {
        // Continue the current note with new frequency
        synth.frequency.setValueAtTime(frequency, time)
      }

      // If this is the last point or the next point starts a new line,
      // schedule the release for this line
      if (index === points.length - 1 || 
          (index + 1 < points.length && points[index + 1].isNewLine)) {
        const nextPoint = points[index + 1]
        if (nextPoint && nextPoint.gapDuration) {
          // Release at the start of the gap
          synth.triggerRelease(time)
        }
      }
    })

    // Ensure final release
    const lastPoint = points[points.length - 1]
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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (editingState.isEditMode) {
      const coords = getScaledCoordinates(e)
      if (!coords) return

      // In edit mode, check if clicking a gap handle first
      const gapPoint = waveformPoints.findIndex((point) => {
        if (!point.gapDuration) return false
        
        const handleX = point.x + (point.gapDuration * 50)
        const handleY = point.y
        
        const distance = Math.sqrt(
          Math.pow(coords.x - handleX, 2) + 
          Math.pow(coords.y - handleY, 2)
        )
        return distance < 10
      })

      if (gapPoint >= 0) {
        setSelectedGap(gapPoint)
        setIsDrawing(true)
        e.stopPropagation()
        e.preventDefault()
        return
      }

      // If not clicking a gap handle, handle normal line segment selection
      const segment = findLineSegment(coords.x, coords.y)
      if (segment) {
        setEditingState(prev => ({
          ...prev,
          selectedSegment: segment
        }))
      }
    } else {
      // Not in edit mode, just start drawing
      startDrawing(e)
    }
  }

  const handleGapAdjustment = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editingState.isEditMode || selectedGap === null || !isDrawing) return

    const coords = getScaledCoordinates(e)
    if (!coords) return
    
    // Update gap duration based on drag distance
    setWaveformPoints(prev => {
      const newPoints = [...prev]
      const point = newPoints[selectedGap]
      if (point) {
        const startX = point.x
        const dragDistance = Math.max(0, coords.x - startX)
        const newGapDuration = dragDistance / 50
        point.gapDuration = newGapDuration
      }
      return newPoints
    })

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      drawWaveform(ctx, waveformPoints, editingState.hoveredSegment)
    }
  }

  const playCurrentDrawing = () => {
    if (waveformPoints.length === 0) return
    
    // Calculate total duration from the last point's time
    const duration = waveformPoints[waveformPoints.length - 1].time
    playSound(waveformPoints)
  }

  const handleGapDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editingState.selectedSegment) return
    
    const newGapDuration = parseFloat(e.target.value)
    const newPoints = [...waveformPoints]
    const lastPointIndex = editingState.selectedSegment.endIndex
    
    newPoints[lastPointIndex] = {
      ...newPoints[lastPointIndex],
      gapDuration: newGapDuration
    }
    
    setWaveformPoints(newPoints)
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      drawWaveform(ctx, newPoints, editingState.hoveredSegment)
    }
  }

  const handleDrawingConfigChange = (config: Partial<typeof drawingConfig>) => {
    setDrawingConfig(prev => ({
      ...prev,
      ...config
    }));
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <div className="sticky top-0 bg-gray-900 z-10 border-b border-gray-700">
        {/* Always visible controls */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setEditingState(prev => ({ ...prev, isEditMode: !prev.isEditMode }))}
                className={`px-4 py-2 rounded ${
                  editingState.isEditMode ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-200'
                }`}
              >
                {editingState.isEditMode ? 'Exit Edit Mode' : 'Edit Drawing'}
              </button>
              
              <button
                onClick={playCurrentDrawing}
                disabled={waveformPoints.length === 0 || isPlaying}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-500"
              >
                Play Drawing
              </button>
              
              <button
                onClick={clearDrawing}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-500"
              >
                Clear Drawing
              </button>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="text"
                value={currentSoundName}
                onChange={(e) => setCurrentSoundName(e.target.value)}
                placeholder="Sound name"
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Collapsible config section */}
        <div className="p-4">
          <button 
            onClick={() => setIsConfigExpanded(!isConfigExpanded)} 
            className="flex items-center gap-2 text-white mb-4 hover:text-blue-400 transition-colors"
          >
            <span className={`transform transition-transform ${isConfigExpanded ? 'rotate-90' : ''}`}>
              ▶
            </span>
            Configuration
          </button>
          
          {isConfigExpanded && (
            <div className="space-y-4">
              <WaveConfigPanel
                selectedWaveform={selectedWaveform}
                onWaveformChange={setSelectedWaveform}
                effects={effects}
                onEffectChange={handleEffectChange}
                drawingConfig={drawingConfig}
                onDrawingConfigChange={handleDrawingConfigChange}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => {
            if (editingState.isEditMode) {
              if (selectedGap !== null && isDrawing) {
                handleGapAdjustment(e)
              } else {
                handleCanvasMouseMove(e)
              }
            } else if (isDrawing) {
              draw(e)
            }
          }}
          onMouseUp={() => {
            setIsDrawing(false)
            setSelectedGap(null)
            stopDrawing()
          }}
          onMouseLeave={() => {
            setIsDrawing(false)
            setSelectedGap(null)
            stopDrawing()
          }}
          width={800}
          height={400}
          className={`w-full h-full border border-gray-700 rounded ${
            editingState.isEditMode ? 'cursor-pointer' : 'cursor-crosshair'
          }`}
        />
        
        {editingState.tooltipPosition && editingState.selectedLineSettings && (
          <Tooltip
            position={editingState.tooltipPosition}
            isVisible={true}
            onClose={() => setEditingState(prev => ({
              ...prev,
              tooltipPosition: null,
              selectedLineSettings: null,
              selectedSegment: null
            }))}
          >
            <SoundShapingTooltip
              currentSettings={editingState.selectedLineSettings}
              onWaveformChange={(waveform) => updateLineSettings({ waveform })}
              onVolumeChange={(volume) => updateLineSettings({ volume })}
              onFrequencyRangeChange={(min, max) => 
                updateLineSettings({ frequencyRange: { min, max } })}
              onADSRChange={(attack, decay, sustain, release) => 
                updateLineSettings({ adsr: { attack, decay, sustain, release } })}
              onVibratoChange={(rate, depth) => 
                updateLineSettings({ vibrato: { rate, depth } })}
            />
          </Tooltip>
        )}
        
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
            onClick={playCurrentDrawing}
            disabled={waveformPoints.length === 0 || isPlaying}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            Play Drawing
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
    </div>
  )
}

export default SynthWavePage