import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface WaveformPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const WaveformPattern: React.FC<WaveformPatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const { timeData, bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Fill background with solid color to prevent flickering
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scale factor based on sensitivity and motion intensity
    const scaleFactor = config.sensitivity * config.motionIntensity;

    // Calculate horizontal step
    const step = canvas.width / timeData.length;

    // Generate gradient based on energy levels
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, getColorFromEnergy(bassEnergy, 0, 0, config.colorMode, config.baseColor));
    gradient.addColorStop(0.5, getColorFromEnergy(0, midEnergy, 0, config.colorMode, config.baseColor));
    gradient.addColorStop(1, getColorFromEnergy(0, 0, highEnergy, config.colorMode, config.baseColor));

    // Draw top wave
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);

    let prevY;
    for (let i = 0; i < timeData.length; i++) {
      // Convert byte data (0-255) to amplitude (-1 to 1)
      const amplitude = ((timeData[i] / 128.0) - 1.0) * scaleFactor;

      // Add some movement based on bass and mid energy
      const movement = (
        Math.sin(i * 0.01 + Date.now() * 0.001) * bassEnergy * 20 +
        Math.cos(i * 0.02 + Date.now() * 0.0015) * midEnergy * 15
      ) * config.motionIntensity;

      const y = (canvas.height / 2) + (amplitude * canvas.height / 4) + movement;

      // Use quadratic curves for smoother lines
      if (i === 0) {
        ctx.moveTo(0, y);
      } else {
        const xc = (i * step + (i - 1) * step) / 2;
        const yc = (y + prevY) / 2;
        ctx.quadraticCurveTo((i - 1) * step, prevY, xc, yc);
      }

      prevY = y;
    }

    // Complete the path
    ctx.lineTo(canvas.width, canvas.height / 2);

    // Fill with gradient
    ctx.fillStyle = `${gradient}33`;
    ctx.fill();

    // Draw stroke with glow
    if (beat) {
      ctx.shadowColor = gradient;
      ctx.shadowBlur = 15 * config.motionIntensity;
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2 * config.motionIntensity;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Mirror wave for bottom
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);

    for (let i = 0; i < timeData.length; i++) {
      const amplitude = ((timeData[i] / 128.0) - 1.0) * scaleFactor;

      const movement = (
        Math.sin(i * 0.01 + Date.now() * 0.001) * bassEnergy * 20 +
        Math.cos(i * 0.02 + Date.now() * 0.0015) * midEnergy * 15
      ) * config.motionIntensity;

      const y = (canvas.height / 2) - (amplitude * canvas.height / 4) - movement;

      if (i === 0) {
        ctx.moveTo(0, y);
      } else {
        const xc = (i * step + (i - 1) * step) / 2;
        const yc = (y + prevY) / 2;
        ctx.quadraticCurveTo((i - 1) * step, prevY, xc, yc);
      }

      prevY = y;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);

    // Fill mirrored wave
    ctx.fillStyle = `${gradient}22`;
    ctx.fill();

    // Draw mirrored stroke with glow
    if (beat) {
      ctx.shadowColor = gradient;
      ctx.shadowBlur = 15 * config.motionIntensity;
    }
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2 * config.motionIntensity;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Add metallic reflection effect
    const reflection = ctx.createLinearGradient(0, 0, 0, canvas.height);
    reflection.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    reflection.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    reflection.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

    ctx.fillStyle = reflection;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

  }, [audioData, dimensions, config, isPlaying]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </motion.div>
  );
};

export default WaveformPattern;