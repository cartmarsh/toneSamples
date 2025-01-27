import { HandSoundController } from '../HandSoundController'

export default function HandSoundPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Hand Sound Controller</h1>
      <p className="mb-8">
        Control synthesizer parameters using hand gestures captured by your webcam.
        Move your hand in different ways to modify the sound.
      </p>
      <HandSoundController />
    </div>
  )
} 