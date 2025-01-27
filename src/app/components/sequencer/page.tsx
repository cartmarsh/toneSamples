import { StepSequencer } from '../StepSequencer'

export default function SequencerPage() {
  return (
    <div className="h-full w-full">
      <h1 className="text-2xl font-bold mb-4">Step Sequencer</h1>
      <p className="mb-8">
        Create drum patterns using the step sequencer. Each drum sound can be customized
        using the dropdown menus.
      </p>
      <StepSequencer />
    </div>
  )
} 