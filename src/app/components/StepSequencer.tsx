'use client'

import { useEffect, useState } from 'react'
import * as Tone from 'tone'
import React from 'react'

interface DrumSound {
  id: string
  name: string
  sequence: boolean[]
}

const STEPS = 16
const BPM = 120

const INITIAL_DRUMS: DrumSound[] = [
  {
    id: 'kick',
    name: 'Kick',
    sequence: Array(STEPS).fill(false)
  },
  {
    id: 'snare',
    name: 'Snare',
    sequence: Array(STEPS).fill(false)
  },
  {
    id: 'hihat',
    name: 'Hi-Hat',
    sequence: Array(STEPS).fill(false)
  },
  {
    id: 'clap',
    name: 'Clap',
    sequence: Array(STEPS).fill(false)
  }
]

export const StepSequencer = () => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [drums, setDrums] = useState<DrumSound[]>(INITIAL_DRUMS)
  const [players, setPlayers] = useState<Record<string, Tone.Player>>({})
  const [tempo, setTempo] = useState(BPM)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState<string>('Loading sounds...')

  useEffect(() => {
    let loadedCount = 0
    const totalSounds = INITIAL_DRUMS.length
    const newPlayers: Record<string, Tone.Player> = {}
    let mounted = true

    const initializePlayers = async () => {
      try {
        for (const drum of INITIAL_DRUMS) {
          const player = new Tone.Player({
            url: `/sounds/${drum.id}.wav`,
            onload: () => {
              if (mounted) {
                loadedCount++
                setLoadingStatus(`Loading sounds (${loadedCount}/${totalSounds})...`)
                if (loadedCount === totalSounds) {
                  setIsLoaded(true)
                  setLoadingStatus('')
                }
              }
            },
            onerror: (error) => {
              console.error(`Error loading ${drum.id}:`, error)
              setLoadingStatus(`Error loading ${drum.id} sound`)
            }
          }).toDestination()

          // Wait for the player to load before adding it to newPlayers
          await player.load(`/sounds/${drum.id}.wav`)
          newPlayers[drum.id] = player
        }

        if (mounted) {
          setPlayers(newPlayers)
          Tone.Transport.bpm.value = tempo
        }
      } catch (error) {
        console.error('Error initializing players:', error)
        setLoadingStatus('Error loading sounds')
      }
    }

    initializePlayers()

    return () => {
      mounted = false
      Object.values(newPlayers).forEach(player => player.dispose())
      Tone.Transport.stop()
      Tone.Transport.cancel()
    }
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      Tone.Transport.stop()
      Tone.Transport.cancel()
      setCurrentStep(0)
      return
    }

    // Reset transport before starting new sequence
    Tone.Transport.cancel()
    Tone.Transport.stop()
    Tone.Transport.position = 0
    setCurrentStep(0)

    const repeat = (time: number) => {
      drums.forEach(drum => {
        if (drum.sequence[step]) {
          const player = players[drum.id]
          if (player?.loaded) {
            player.start(time)
          }
        }
      })
      
      Tone.Draw.schedule(() => {
        setCurrentStep(step)
      }, time)

      step = (step + 1) % STEPS
    }

    let step = 0
    const intervalTime = '16n'
    
    // Schedule the repeat and store the ID
    const eventId = Tone.Transport.scheduleRepeat(repeat, intervalTime)

    // Start transport after scheduling
    Tone.Transport.start()

    return () => {
      Tone.Transport.clear(eventId)
      Tone.Transport.stop()
      Tone.Transport.cancel()
    }
  }, [isPlaying, drums, players])

  useEffect(() => {
    Tone.Transport.bpm.value = tempo
  }, [tempo])

  const toggleStep = (drumId: string, step: number) => {
    setDrums(prev => prev.map(drum => {
      if (drum.id === drumId) {
        const newSequence = [...drum.sequence]
        newSequence[step] = !newSequence[step]
        return { ...drum, sequence: newSequence }
      }
      return drum
    }))
  }

  const togglePlayback = async () => {
    if (!isLoaded) return

    try {
      // Start audio context
      await Tone.start()
      
      // If we're going to start playing, reset transport first
      if (!isPlaying) {
        Tone.Transport.cancel()
        Tone.Transport.stop()
        Tone.Transport.position = 0
        setCurrentStep(0)
      }
      
      setIsPlaying(!isPlaying)
    } catch (error) {
      console.error('Error starting playback:', error)
      setIsPlaying(false)
    }
  }

  return (
    <div className="flex flex-col h-full w-full gap-4 p-4">
      <div className="flex items-center gap-4">
        <button
          onClick={togglePlayback}
          disabled={!isLoaded}
          className={`px-4 py-2 rounded ${
            isLoaded 
              ? 'bg-blue-500 hover:bg-blue-600 text-white' 
              : 'bg-gray-400 cursor-not-allowed text-gray-200'
          }`}
        >
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        <input
          type="range"
          min="60"
          max="200"
          value={tempo}
          onChange={(e) => setTempo(Number(e.target.value))}
          className="w-32"
          disabled={!isLoaded}
        />
        <span>{tempo} BPM</span>
      </div>

      {loadingStatus && (
        <div className="text-white bg-gray-800 p-2 rounded">
          {loadingStatus}
        </div>
      )}
      
      <div className="flex flex-col gap-2">
        {drums.map((drum, rowIndex) => (
          <div key={drum.id} className="flex items-center gap-2">
            <div className="w-24">
              <span className="text-white">{drum.name}</span>
            </div>
            <div className="grid grid-cols-16 gap-1">
              {drum.sequence.map((isActive, colIndex) => (
                <button
                  key={`${rowIndex}-${colIndex}`}
                  disabled={!isLoaded}
                  className={`w-8 h-8 rounded ${
                    isActive ? 'bg-blue-500' : 'bg-gray-700'
                  } ${
                    currentStep === colIndex ? 'border-2 border-red-500' : ''
                  } ${
                    isLoaded ? 'hover:bg-blue-400' : 'cursor-not-allowed'
                  } transition-colors`}
                  onClick={() => toggleStep(drum.id, colIndex)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 