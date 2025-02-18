
import React, { useRef, useEffect } from 'react'
import * as Tone from 'tone'

interface RetroVisualizerProps {
  analyzer: Tone.Analyser | null
  isPlaying: boolean
  activeColor?: string
}

const RetroVisualizer: React.FC<RetroVisualizerProps> = ({ 
  analyzer, 
  isPlaying,
  activeColor = '#00ff9d'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number>()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const drawVisualization = () => {
      if (!analyzer || !isPlaying) return

      const width = canvas.width
      const height = canvas.height
      const values = analyzer.getValue() as Float32Array
      
      // Clear canvas with semi-transparent black for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
      ctx.fillRect(0, 0, width, height)

      // Draw grid
      ctx.strokeStyle = 'rgba(50, 50, 100, 0.3)'
      ctx.lineWidth = 1

      // Vertical lines
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }

      // Horizontal lines with perspective
      for (let y = height; y > 0; y -= 40) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(width, y * 0.9)
        ctx.stroke()
      }

      // Draw frequency visualization
      ctx.beginPath()
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 3
      ctx.shadowBlur = 15
      ctx.shadowColor = activeColor

      const sliceWidth = width / values.length

      values.forEach((value, i) => {
        const x = i * sliceWidth
        const y = (value + 1) / 2 * height

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })

      ctx.stroke()
      ctx.shadowBlur = 0

      // Draw sun/circle
      const gradient = ctx.createRadialGradient(
        width/2, height/2, 0,
        width/2, height/2, 100
      )
      gradient.addColorStop(0, `${activeColor}33`)
      gradient.addColorStop(1, 'transparent')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(width/2, height/2, 100, 0, Math.PI * 2)
      ctx.fill()

      animationFrameRef.current = requestAnimationFrame(drawVisualization)
    }

    drawVisualization()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [analyzer, isPlaying, activeColor])

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={400}
      className="absolute top-0 left-0 w-full h-full pointer-events-none"
    />
  )
}

export default RetroVisualizer
