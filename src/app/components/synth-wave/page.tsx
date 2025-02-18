'use client'

import React, { useRef, useEffect, useState } from 'react'
import * as Tone from 'tone'
import Tooltip from '../tooltip/Tooltip'
import SoundShapingTooltip from '../tooltip/SoundShapingTooltip'
import WaveConfigPanel from './WaveConfigPanel'
import RetroVisualizer from './RetroVisualizer'

// ============= Type Definitions =============
/**
 * Represents a point in the waveform with its coordinates and timing information
 */
interface WaveformPoint {
  x: number
  y: number
  time: number
  isNewLine?: boolean
  gapDuration?: number  // Duration of gap before this point
}

/**
 * Available waveform types for synthesis
 */
type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom'
type EffectType = 'reverb' | 'distortion'

/**
 * Structure for storing saved sound configurations
 */
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

/**
 * Represents an event in the timeline for playback
 */
interface TimelineEvent {
  id: string
  soundId: number
  startTime: number
  duration: number
  track: number
}

/**
 * State for managing waveform editing and interactions
 */
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

/**
 * Represents a segment of the waveform line for editing
 */
interface LineSegment {
  startIndex: number
  endIndex: number
  points: WaveformPoint[]
}

const SynthWavePage = () => {
  // ============= Refs =============
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<number>(0)
  const animationFrameRef = useRef<number>()
  const analyzerRef = useRef<Tone.Analyser>()
  const [zoomLevel, setZoomLevel] = useState(1)
  const [showSpectrum, setShowSpectrum] = useState(false)
  const [selectedVisualization, setSelectedVisualization] = useState<'waveform' | 'spectrum'>('waveform')

  // ============= Core State =============
  const [synth, setSynth] = useState<Tone.Synth | null>(null)
  const [layeredSynths, setLayeredSynths] = useState({
    main: null,
    sub: null,
    pad: null
  })
  const [waveformPoints, setWaveformPoints] = useState<WaveformPoint[]>([])
  const [selectedWaveform, setSelectedWaveform] = useState<WaveformType>('sine')
  const [effects, setEffects] = useState({
    reverb: 0,
    distortion: 0
  })
  const [analyzer, setAnalyzer] = useState<Tone.Analyser | null>(null)
  const [activeColor, setActiveColor] = useState('#00ff9d')

  // ============= Drawing and Interaction State =============
  const [isDrawing, setIsDrawing] = useState(false)
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

  // ============= Playback and Timeline State =============
  const [savedSounds, setSavedSounds] = useState<SavedSound[]>([])
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSoundName, setCurrentSoundName] = useState('')
  const [draggingEvent, setDraggingEvent] = useState<TimelineEvent | null>(null)
  const [playheadPosition, setPlayheadPosition] = useState(0)
  const [activeEvents, setActiveEvents] = useState<string[]>([])

  // ============= Configuration State =============
  const [drawingConfig, setDrawingConfig] = useState({
    tempo: 120,
    gridSize: 16,
    snapToGrid: true,
    autoConnect: true,
    loopMode: false
  })
  const [isConfigExpanded, setIsConfigExpanded] = useState(true)

  // Constants
  const PIXELS_PER_SECOND = 100

  useEffect(() => {
    // Initialize Tone.js with effects chain and analyzer
    const reverb = new Tone.Reverb({ decay: 1.5, wet: effects.reverb }).toDestination()
    const distortion = new Tone.Distortion(effects.distortion).connect(reverb)
    const mainSynth = new Tone.Synth({
      oscillator: {
        type: selectedWaveform === 'custom' ? 'sine' : selectedWaveform
      }
    }).connect(distortion)
    const subSynth = new Tone.Synth({
      oscillator: {
        type: selectedWaveform === 'custom' ? 'sine' : selectedWaveform
      }
    }).connect(distortion)
    const padSynth = new Tone.Synth({
      oscillator: {
        type: selectedWaveform === 'custom' ? 'sine' : selectedWaveform
      }
    }).connect(distortion)
    const analyser = new Tone.Analyser('waveform', 256).connect(distortion)
    analyzerRef.current = analyser;
    setAnalyzer(analyser);

    setLayeredSynths({ main: mainSynth, sub: subSynth, pad: padSynth })

    return () => {
      mainSynth.dispose()
      subSynth.dispose()
      padSynth.dispose()
      reverb.dispose()
      distortion.dispose()
      analyzerRef.current?.dispose()
    }
  }, [selectedWaveform, effects])

  /**
   * Draws the waveform on the canvas with support for hovering and gap indicators
   * @param ctx - The canvas rendering context
   * @param points - Array of waveform points to draw
   * @param hoveredSegment - Currently hovered line segment (optional)
   */
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

  /**
   * Draws a single line segment of the waveform with optional hover effects
   * @param ctx - The canvas rendering context
   * @param points - Array of points forming the line
   * @param isHovered - Whether the line is currently being hovered
   */
  const drawLine = (ctx: CanvasRenderingContext2D, points: WaveformPoint[], isHovered: boolean) => {
    const MAX_GAP_WIDTH = 150 // Maximum visual width for gaps in pixels
    const PIXELS_PER_SECOND = 50 // Base scale for gap visualization

    // Draw the main line
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }

    ctx.lineWidth = isHovered ? 3 : 2
    ctx.strokeStyle = isHovered ? '#4CAF50' : '#2196F3'
    ctx.stroke()

    // Draw gaps for all points
    points.forEach((point, index) => {
      if (point.gapDuration) {
        const baseGapWidth = point.gapDuration * PIXELS_PER_SECOND
        let displayWidth = baseGapWidth

        // Scale down if gap is too long
        if (baseGapWidth > MAX_GAP_WIDTH) {
          displayWidth = MAX_GAP_WIDTH
        }

        // Draw gap indicator (dotted line)
        ctx.beginPath()
        ctx.setLineDash([5, 5])
        ctx.moveTo(point.x, point.y)
        ctx.lineTo(point.x + displayWidth, point.y)
        ctx.strokeStyle = '#888888'
        ctx.lineWidth = 1
        ctx.stroke()
        ctx.setLineDash([])

        // Draw gap duration text
        ctx.font = '12px Arial'
        ctx.fillStyle = '#888888'
        ctx.fillText(`${point.gapDuration.toFixed(2)}s`, point.x + 5, point.y - 10)
      }
    })
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
    if (!editingState.isEditMode || selectedGap !== null || isDrawing) return // Prevent tooltip during gap adjustment or drawing

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const segment = findLineSegment(x, y)
    if (segment) {
      setEditingState(prev => ({
        ...prev,
        tooltipPosition: { x, y },
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

    if (layeredSynths.main) {
      const frequency = mapToFrequency(coords.y, canvas.height)
      layeredSynths.main.triggerAttack(frequency)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !layeredSynths.main || !lastDrawTime) return

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
      layeredSynths.main.triggerRelease('+0')
      layeredSynths.main.triggerAttack(mapToFrequency(coords.y, canvas.height))
    } else {
      layeredSynths.main.frequency.setValueAtTime(mapToFrequency(coords.y, canvas.height), '+0')
    }

    setWaveformPoints(prev => [...prev, newPoint])
    drawWaveform(ctx, [...waveformPoints, newPoint])
    setLastDrawTime(currentTime)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
    layeredSynths.main?.triggerRelease()
    setLastLineEndTime(Tone.now())
  }

  const mapToFrequency = (y: number, height: number) => {
    return 880 - (y / height) * (880 - 110)
  }

  const handleWaveformChange = (type: WaveformType) => {
    setSelectedWaveform(type)
    if (layeredSynths.main) {
      layeredSynths.main.oscillator.type = type === 'custom' ? 'sine' : type
      layeredSynths.sub.oscillator.type = type === 'custom' ? 'sine' : type
      layeredSynths.pad.oscillator.type = type === 'custom' ? 'sine' : type
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

  const playSound = async (points: WaveformPoint[], duration?: number, delayStart = 0) => {
    if (!layeredSynths.main || !layeredSynths.sub || !layeredSynths.pad) return

    // Calculate actual duration from points
    const soundDuration = duration || (points.length > 0 
      ? points[points.length - 1].time - points[0].time + 0.5 
      : 1)

    const baseTime = Tone.now() + delayStart
    let lastTime = -Infinity

    // Sort points by time to ensure proper ordering
    const sortedPoints = [...points].sort((a, b) => a.time - b.time)
    const startTime = sortedPoints[0].time

    // Schedule all events relative to the start time
    sortedPoints.forEach((point, index) => {
      const mainFreq = mapToFrequency(point.y, canvasRef.current?.height || 400)
      const subFreq = mainFreq * 0.5
      const padFreq = mainFreq * 1.5
      const time = baseTime + (point.time - startTime) // Normalize time relative to first point

      if (time < lastTime) return // Skip if time goes backwards
      lastTime = time

      if (point.isNewLine || index === 0) {
        layeredSynths.main.triggerAttack(mainFreq, time)
        layeredSynths.sub.triggerAttack(subFreq, time + 0.02)
        layeredSynths.pad.triggerAttack(padFreq, time + 0.04)
      } else {
        layeredSynths.main.frequency.linearRampToValueAtTime(mainFreq, time)
        layeredSynths.sub.frequency.linearRampToValueAtTime(subFreq, time)
        layeredSynths.pad.frequency.linearRampToValueAtTime(padFreq, time)
      }
    })

    // Schedule release at the end of duration
    const releaseTime = baseTime + soundDuration - 0.3
    layeredSynths.main.triggerRelease(releaseTime)
    layeredSynths.sub.triggerRelease(releaseTime + 0.1)
    layeredSynths.pad.triggerRelease(releaseTime + 0.2)

    return soundDuration
  }

  const playSavedSound = (soundId: number) => {
    const sound = savedSounds.find(s => s.id === soundId)
    if (!sound) return
    playSound(sound.points)
  }

  const addToTimeline = async (soundId: number, track: number) => {
    const sound = savedSounds.find(s => s.id === soundId)
    if (!sound) return

    // Calculate actual duration from the sound's points
    const duration = sound.points.length > 0 
      ? sound.points[sound.points.length - 1].time - sound.points[0].time + 0.5
      : 1

    // Find a suitable start time (after the last event)
    const lastEventEnd = Math.max(0, ...timelineEvents.map(e => e.startTime + e.duration))

    const newEvent: TimelineEvent = {
      id: `event-${Date.now()}-${Math.random()}`,
      soundId,
      startTime: lastEventEnd,
      duration,
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
    await Tone.start()
    setIsPlaying(true)
    const startTime = Tone.now()
    updatePlayhead(startTime)

    // Sort timeline events by start time
    const sortedEvents = [...timelineEvents].sort((a, b) => a.startTime - b.startTime)

    // Schedule each event
    sortedEvents.forEach(event => {
      const sound = savedSounds.find(s => s.id === event.soundId)
      if (!sound) return

      const eventStartTime = startTime + event.startTime
      sound.points.forEach((point, index) => {
        const pointTime = eventStartTime + point.time
        const mainFreq = mapToFrequency(point.y, canvasRef.current?.height || 400)
        const subFreq = mainFreq * 0.5
        const padFreq = mainFreq * 1.5

        if (point.isNewLine || index === 0) {
          layeredSynths.main?.triggerAttack(mainFreq, pointTime)
          layeredSynths.sub?.triggerAttack(subFreq, pointTime + 0.02)
          layeredSynths.pad?.triggerAttack(padFreq, pointTime + 0.04)
        } else {
          layeredSynths.main?.frequency.setValueAtTime(mainFreq, pointTime)
          layeredSynths.sub?.frequency.setValueAtTime(subFreq, pointTime)
          layeredSynths.pad?.frequency.setValueAtTime(padFreq, pointTime)
        }
      })

      // Schedule release
      const releaseTime = eventStartTime + event.duration - 0.1
      layeredSynths.main?.triggerRelease(releaseTime)
      layeredSynths.sub?.triggerRelease(releaseTime + 0.02)
      layeredSynths.pad?.triggerRelease(releaseTime + 0.04)
    })

    const duration = Math.max(...timelineEvents.map(e => e.startTime + e.duration))
    setTimeout(() => {
      setIsPlaying(false)
      stopPlayhead()
      Tone.Transport.stop()
      Tone.Transport.cancel()
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
    if (selectedGap === null || !isDrawing) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const MAX_GAP_WIDTH = 150
    const PIXELS_PER_SECOND = 50

    // Clear any existing tooltip when adjusting gaps
    setEditingState(prev => ({
      ...prev,
      tooltipPosition: null,
      selectedSegment: null,
      selectedLineSettings: null
    }))

    // Calculate new gap duration based on mouse position
    const point = waveformPoints[selectedGap]
    const dragDistance = Math.max(0, x - point.x)
    let newGapDuration

    if (dragDistance > MAX_GAP_WIDTH) {
      // Scale the duration proportionally when beyond max width
      const scaleFactor = dragDistance / MAX_GAP_WIDTH
      newGapDuration = (MAX_GAP_WIDTH / PIXELS_PER_SECOND) * scaleFactor
    } else {
      newGapDuration = dragDistance / PIXELS_PER_SECOND
    }

    const newPoints = [...waveformPoints]
    newPoints[selectedGap] = {
      ...newPoints[selectedGap],
      gapDuration: newGapDuration
    }

    setWaveformPoints(newPoints)

    const ctx = canvasRef.current?.getContext('2d')
    if (ctx) {
      drawWaveform(ctx, newPoints, editingState.hoveredSegment)
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

  const exportToMIDI = (points: WaveformPoint[]) => {
    //Implementation for MIDI export (simplified example)
    const midiData = points.map(point => ({
      note: Math.round(mapToFrequency(point.y, 400)),
      time: point.time
    }))
    const blob = new Blob([JSON.stringify(midiData)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'synthwave.json' // Placeholder for actual MIDI export
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      <div className="sticky top-0 bg-gray-900 z-10 border-b border-gray-700">
        {/* Controls section */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setEditingState(prev => ({ ...prev, isEditMode: !prev.isEditMode }))}
                className={`px-4 py-2 rounded-lg transition-all duration-200 border ${
                  editingState.isEditMode
                    ? 'bg-blue-600 text-white border-blue-400 hover:bg-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-gray-700 text-gray-200 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                } hover:scale-105 transform`}
              >
                {editingState.isEditMode ? 'Exit Edit Mode' : 'Edit Drawing'}
              </button>

              <button
                onClick={playCurrentDrawing}
                disabled={waveformPoints.length === 0 || isPlaying}
                className="px-4 py-2 bg-green-600 text-white rounded-lg transition-all duration-200 border border-green-400 hover:bg-green-500 hover:scale-105 transform shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none"
              >
                Play Drawing
              </button>

              <button
                onClick={clearDrawing}
                className="px-4 py-2 bg-red-600 text-white rounded-lg transition-all duration-200 border border-red-400 hover:bg-red-500 hover:scale-105 transform shadow-lg shadow-red-500/20"
              >
                Clear Drawing
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 4))}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Zoom In
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 0.5))}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Zoom Out
              </button>
              <select
                value={selectedVisualization}
                onChange={(e) => setSelectedVisualization(e.target.value as 'waveform' | 'spectrum')}
                className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                <option value="waveform">Waveform</option>
                <option value="spectrum">Spectrum</option>
              </select>
              <button
                onClick={() => exportToMIDI(waveformPoints)}
                className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-500"
              >
                Export MIDI
              </button>
            </div>
          </div>
        </div>

        {/* Config section */}
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
                onWaveformChange={handleWaveformChange}
                effects={effects}
                onEffectChange={handleEffectChange}
                drawingConfig={drawingConfig}
                onDrawingConfigChange={handleDrawingConfigChange}
              />
              <div className="flex items-center gap-4">
                <label className="text-white">Visualization Color:</label>
                <input
                  type="color"
                  value={activeColor}
                  onChange={(e) => setActiveColor(e.target.value)}
                  className="w-12 h-8 rounded cursor-pointer"
                />
              </div>
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
          className={`w-full h-full border-2 border-gray-700 rounded-xl transition-colors duration-200 shadow-lg ${
            editingState.isEditMode
              ? 'cursor-pointer bg-slate-900'
              : 'cursor-crosshair bg-slate-800'
          }`}
        />

        <RetroVisualizer
          analyzer={analyzer}
          isPlaying={isPlaying}
          activeColor={activeColor}
        />

        {editingState.tooltipPosition && editingState.selectedLineSettings && (
          <Tooltip
            position={editingState.tooltipPosition}
            isVisible={true}
            onClose={handleTooltipClose}
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
      </div>

      {/* Save Sound Panel */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={currentSoundName}
            onChange={(e) => setCurrentSoundName(e.target.value)}
            placeholder="Enter sound name"
            className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={saveCurrentSound}
            disabled={!currentSoundName || waveformPoints.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            Save Sound
          </button>
        </div>
      </div>

      {/* Saved Sounds Grid */}
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {savedSounds.map((sound) => (
          <div
            key={sound.id}
            className="p-4 bg-gray-800 rounded-lg border border-gray-700"
          >
            <h3 className="text-white font-medium mb-2">{sound.name}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => playSavedSound(sound.id)}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-500"
              >
                Play
              </button>
              <button
                onClick={() => addToTimeline(sound.id, 0)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Add to Timeline
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={playTimeline}
            disabled={timelineEvents.length === 0 || isPlaying}
            className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            Play Timeline
          </button>
          <button
            onClick={() => setTimelineEvents([])}
            className="px-4 py-2 bg-red-600 text-white rounded-lg"
          >
            Clear Timeline
          </button>
        </div>

        <div
          ref={timelineRef}
          className="relative h-48 bg-gray-900 rounded-lg overflow-hidden"
          onDragOver={(e) => handleTimelineDragOver(e, 0)}
          onDrop={() => handleDragEnd()}
        >
          {timelineEvents.map((event) => (
            <div
              key={event.id}
              draggable
              onDragStart={() => handleDragStart(event)}
              className={`absolute top-0 h-12 bg-blue-500 rounded cursor-move transition-opacity ${
                activeEvents.includes(event.id) ? 'opacity-100' : 'opacity-50'
              }`}
              style={{
                left: `${event.startTime * PIXELS_PER_SECOND}px`,
                width: `${event.duration * PIXELS_PER_SECOND}px`,
                top: `${event.track * 48}px`,
              }}
            >
              {savedSounds.find((s) => s.id === event.soundId)?.name}
            </div>
          ))}
          <div
            className="absolute top-0 h-full w-1 bg-white"
            style={{ left: `${playheadPosition * PIXELS_PER_SECOND}px` }}
          />
        </div>
      </div>
    </div>
  )
}

export default SynthWavePage