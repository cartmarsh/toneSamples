# Tone Samples

A [Next.js](https://nextjs.org) project that features an interactive synthesizer wave editor built with Tone.js.

## Features

### Synth Wave Editor

The synth-wave component (`/app/components/synth-wave`) is an interactive audio synthesizer that allows you to:

- Draw custom waveforms by clicking and dragging on the canvas
- Edit existing waveforms by clicking on segments
- Apply effects like reverb and distortion
- Configure drawing settings:
  - Tempo and grid size
  - Snap-to-grid functionality
  - Auto-connect points
  - Loop mode
- Save and replay your sound creations
- Organize sounds in a timeline for complex compositions

The editor provides real-time audio feedback and visualization of your waveforms, making it an intuitive tool for sound design and experimentation.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. Navigate to the synth-wave editor at `/components/synth-wave`
2. Use the drawing tools to create your waveform:
   - Click and drag to draw
   - Use the configuration panel to adjust settings
   - Toggle edit mode to modify existing segments
3. Play your creation using the "Play Drawing" button
4. Save your sounds and arrange them in the timeline

## Learn More

To learn more about the technologies used in this project:

- [Next.js Documentation](https://nextjs.org/docs)
- [Tone.js Documentation](https://tonejs.github.io/)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
