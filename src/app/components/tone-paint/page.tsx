// src/app/components/TonePaint.tsx
'use client';

import React, { useRef, useEffect, useState } from "react";
import * as Tone from "tone";

const TonePaint = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [brushSize, setBrushSize] = useState<number>(10);
  const [brushColor, setBrushColor] = useState<string>("#ff0000");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Initialize Tone.js synth and effects
  const synth = new Tone.Synth().toDestination();
  const panner = new Tone.Panner().toDestination();
  synth.connect(panner);

  // Handle drawing on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");

    const startDrawing = (e: MouseEvent) => {
      setIsDrawing(true);
      draw(e);
    };

    const stopDrawing = () => {
      setIsDrawing(false);
      context?.beginPath();
    };

    const draw = (e: MouseEvent) => {
      if (!isDrawing || !context) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Draw on the canvas
      context.lineWidth = brushSize;
      context.lineCap = "round";
      context.strokeStyle = brushColor;
      context.lineTo(x, y);
      context.stroke();
      context.beginPath();
      context.moveTo(x, y);

      // Map drawing to sound
      const pitch = (y / canvas.height) * 48 + 48; // Map y to MIDI note (48 = C3)
      const pan = (x / canvas.width) * 2 - 1; // Map x to stereo pan (-1 to 1)
      const volume = brushSize / 50; // Map brush size to volume

      synth.triggerAttackRelease(Tone.Midi(pitch).toFrequency(), "8n");
      panner.pan.value = pan;
      synth.volume.value = Tone.gainToDb(volume);
    };

    canvas.addEventListener("mousedown", startDrawing);
    canvas.addEventListener("mouseup", stopDrawing);
    canvas.addEventListener("mousemove", draw);

    return () => {
      canvas.removeEventListener("mousedown", startDrawing);
      canvas.removeEventListener("mouseup", stopDrawing);
      canvas.removeEventListener("mousemove", draw);
    };
  }, [isDrawing, brushSize, brushColor]);

  // Clear the canvas
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Tone Paint</h1>
      <p className="mb-8">
        Draw on the canvas below to create sounds. Moving up and down changes the frequency,
        while moving left to right changes the octave.
      </p>
      <div>
        <label>
          Brush Size:
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
          />
        </label>
        <label>
          Brush Color:
          <input
            type="color"
            value={brushColor}
            onChange={(e) => setBrushColor(e.target.value)}
          />
        </label>
        <button onClick={clearCanvas}>Clear Canvas</button>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={400}
        style={{ border: "1px solid #000", marginTop: "10px" }}
      />
    </div>
  );
};

export default TonePaint;