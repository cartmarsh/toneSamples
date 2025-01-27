'use client'

import { useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import { Camera } from '@mediapipe/camera_utils'
import { Hands, Results } from '@mediapipe/hands'

interface HandLandmark {
  x: number
  y: number
  z: number
}

export const HandSoundController = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [synth, setSynth] = useState<Tone.PolySynth | null>(null)
  const [delay, setDelay] = useState<Tone.FeedbackDelay | null>(null)
  const [reverb, setReverb] = useState<Tone.Reverb | null>(null)
  const [filter, setFilter] = useState<Tone.Filter | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [soundFeedback, setSoundFeedback] = useState<string>('')
  

  useEffect(() => {
    // Initialize Tone.js effects and instruments
    const initAudio = async () => {
      await Tone.start()
      
      const newFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: 1000,
        rolloff: -12
      })

      const newDelay = new Tone.FeedbackDelay({
        delayTime: 0.3,
        feedback: 0.3,
        wet: 0.2
      })

      const newReverb = new Tone.Reverb({
        decay: 2,
        wet: 0.2
      })

      const newSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: 'sine'
        },
        envelope: {
          attack: 0.1,
          decay: 0.2,
          sustain: 0.8,
          release: 1
        }
      })

      // Connect audio nodes
      newSynth.chain(newFilter, newDelay, newReverb, Tone.Destination)

      setSynth(newSynth)
      setDelay(newDelay)
      setReverb(newReverb)
      setFilter(newFilter)
    }

    initAudio()

    return () => {
      synth?.dispose()
      delay?.dispose()
      reverb?.dispose()
      filter?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!videoRef.current || isInitialized) return

    const initCamera = async () => {
      try {
        // Check if mediaDevices is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Media devices API not supported. Please ensure you are using a secure context (HTTPS).')
        }

        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false 
        })
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        const hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
          }
        })

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        })

        hands.onResults(onResults)

        if (videoRef.current) {
          const camera = new Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current) {
                await hands.send({ image: videoRef.current })
              }
            },
            width: 640,
            height: 480
          })
          camera.start()
          setIsInitialized(true)
        }
      } catch (error: any) {
        console.error('Error accessing camera:', error)
        // You might want to show an error message to the user here
        alert('Error accessing camera: ' + error.message)
      }
    }

    initCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized])

  const onResults = (results: Results) => {
    if (!canvasRef.current || !synth || !delay || !reverb || !filter) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw video frame
    if (videoRef.current) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const landmarks = results.multiHandLandmarks[0]
      
      // Draw hand landmarks
      drawLandmarks(ctx, landmarks)

      // Calculate hand parameters
      const palmHeight = calculatePalmHeight(landmarks)
      const palmWidth = calculatePalmWidth(landmarks)
      const handRotation = calculateHandRotation(landmarks)

      // Map hand movements to sound parameters
      updateSoundParameters(palmHeight, palmWidth, handRotation)
    }
  }

  const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: HandLandmark[]) => {
    // Draw connections
    ctx.strokeStyle = '#00FF00'
    ctx.lineWidth = 2

    // Draw points
    landmarks.forEach((landmark) => {
      ctx.beginPath()
      ctx.arc(
        landmark.x * canvasRef.current!.width,
        landmark.y * canvasRef.current!.height,
        4,
        0,
        2 * Math.PI
      )
      ctx.fillStyle = '#FF0000'
      ctx.fill()
    })
  }

  const calculatePalmHeight = (landmarks: HandLandmark[]) => {
    const wrist = landmarks[0]
    const middleFinger = landmarks[9]
    return Math.abs(middleFinger.y - wrist.y)
  }

  const calculatePalmWidth = (landmarks: HandLandmark[]) => {
    const thumb = landmarks[4]
    const pinky = landmarks[20]
    return Math.abs(thumb.x - pinky.x)
  }

  const calculateHandRotation = (landmarks: HandLandmark[]) => {
    const wrist = landmarks[0]
    const middleFinger = landmarks[9]
    return Math.atan2(middleFinger.y - wrist.y, middleFinger.x - wrist.x)
  }

  const updateSoundParameters = (palmHeight: number, palmWidth: number, rotation: number) => {
    if (!synth || !delay || !reverb || !filter) return

    // Map palm height to filter frequency (0-1 to 100-5000 Hz)
    const frequency = 100 + palmHeight * 4900
    filter.frequency.rampTo(frequency, 0.1)

    // Map palm width to delay feedback (0-1)
    const feedback = Math.min(Math.max(palmWidth, 0), 0.9)
    delay.feedback.rampTo(feedback, 0.1)

    // Map rotation to reverb mix (-π to π maps to 0-1)
    const reverbMix = (rotation + Math.PI) / (2 * Math.PI)
    reverb.wet.rampTo(reverbMix, 0.1)

    // Trigger notes based on hand position
    if (isPlaying) {
      const note = Math.floor(palmHeight * 24) + 48 // Map to MIDI notes
      synth.triggerAttackRelease(Tone.Frequency(note, 'midi').toNote(), '16n')
      setSoundFeedback(`Playing note: ${note}`) // Update feedback
    } else {
      setSoundFeedback('Sound is off') // Update feedback when sound is off
    }
  }

  const toggleSound = async () => {
    await Tone.start()
    setIsPlaying(!isPlaying)
    setSoundFeedback(isPlaying ? 'Sound is off' : 'Sound is on') // Update feedback
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6 space-y-2">
          <h2 className="text-2xl font-semibold text-gray-800">Hand Sound Controller</h2>
          <p className="text-gray-600">
            Move your hand in front of the camera to control the sound. 
            Palm height controls filter frequency, width controls delay, 
            and rotation controls reverb.
          </p>
          <p className="text-gray-600 font-bold">{soundFeedback}</p>
        </div>

        <div className="flex justify-center mb-4">
          <button
            onClick={toggleSound}
            className={`px-6 py-2 rounded-lg ${
              isPlaying 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-green-500 hover:bg-green-600'
            } text-white transition-colors`}
          >
            {isPlaying ? 'Stop Sound' : 'Start Sound'}
          </button>
        </div>

        <div className="relative aspect-video">
          <video
            ref={videoRef}
            className="absolute w-full h-full object-cover"
            playsInline
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            width={640}
            height={480}
          />
        </div>
      </div>
    </div>
  )
} 