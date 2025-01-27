import { DrawableSound } from '../DrawableSound'

export default function DrawSoundPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Draw Sound Component</h1>
      <p className="mb-8">
        Draw on the canvas below to create sounds. Moving up and down changes the frequency,
        while moving left to right changes the octave.
      </p>
      <DrawableSound />
    </div>
  )
} 