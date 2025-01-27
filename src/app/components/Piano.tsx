'use client'

import { useEffect, useState } from 'react'
import * as Tone from 'tone'

interface PianoKey {
  note: string
  isBlack: boolean
  key?: string // Keyboard key mapping
}

const PIANO_KEYS: PianoKey[] = [
  { note: 'C4', isBlack: false, key: 'a' },
  { note: 'C#4', isBlack: true, key: 'w' },
  { note: 'D4', isBlack: false, key: 's' },
  { note: 'D#4', isBlack: true, key: 'e' },
  { note: 'E4', isBlack: false, key: 'd' },
  { note: 'F4', isBlack: false, key: 'f' },
  { note: 'F#4', isBlack: true, key: 't' },
  { note: 'G4', isBlack: false, key: 'g' },
  { note: 'G#4', isBlack: true, key: 'y' },
  { note: 'A4', isBlack: false, key: 'h' },
  { note: 'A#4', isBlack: true, key: 'u' },
  { note: 'B4', isBlack: false, key: 'j' },
]

export const Piano = () => {
  const [synth, setSynth] = useState<Tone.Synth | null>(null)
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    // Initialize synth
    const newSynth = new Tone.Synth().toDestination()
    setSynth(newSynth)

    // Cleanup
    return () => {
      newSynth.dispose()
    }
  }, [])

  const playNote = (note: string) => {
    if (!synth) return
    
    Tone.start()
    synth.triggerAttackRelease(note, '8n')
    setActiveKeys(prev => new Set(prev).add(note))
    setTimeout(() => {
      setActiveKeys(prev => {
        const next = new Set(prev)
        next.delete(note)
        return next
      })
    }, 150)
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <div className="relative flex">
        {PIANO_KEYS.map((key) => (
          <button
            key={key.note}
            onClick={() => playNote(key.note)}
            className={`
              ${key.isBlack
                ? 'bg-black text-white h-32 w-10 -mx-5 z-10 relative'
                : 'bg-white text-black h-48 w-14 border-x border-gray-300'
              } 
              ${activeKeys.has(key.note) ? 'opacity-70' : ''}
              transition-opacity
              hover:opacity-90
              flex flex-col-reverse
              pb-4
              items-center
              rounded-b-md
              outline-none
              focus:ring-2
              focus:ring-blue-500
            `}
            aria-label={`Play ${key.note}`}
          >
            <span className="text-xs">{key.key}</span>
          </button>
        ))}
      </div>
    </div>
  )
} 