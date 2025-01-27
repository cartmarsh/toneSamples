import { Piano } from './Piano'

export default function ComponentsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Piano Component</h1>
      <p className="mb-8">Click on the piano keys or use your keyboard to play notes.</p>
      <Piano />
    </div>
  )
} 