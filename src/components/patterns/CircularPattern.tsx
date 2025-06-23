import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface CircularPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const CircularPattern: React.FC<CircularPatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const { frequencyData, bassEnergy, midEnergy, highEnergy, isPlaying } = audioData;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = Math.min(canvas.width, canvas.height) * 0.4;

    // Optimized sensitivity and motion
    const scaledSensitivity = config.sensitivity * 1.2;
    const scaledMotion = config.motionIntensity * 1.1;

    // Draw background ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius * 0.95, 0, Math.PI * 2);
    const ringColor = getColorFromEnergy(
      (bassEnergy + midEnergy + highEnergy) / 3,
      0,
      0,
      config.colorMode,
      config.baseColor
    );
    ctx.strokeStyle = `${ringColor}`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bass circle (inner)
    const bassRadius = maxRadius * 0.35 * (1 + bassEnergy * scaledSensitivity);
    ctx.beginPath();
    ctx.arc(centerX, centerY, bassRadius, 0, Math.PI * 2);
    const bassColor = getColorFromEnergy(bassEnergy, 0, 0, config.colorMode, config.baseColor);
    ctx.fillStyle = `${bassColor}66`;
    ctx.fill();

    // Mid circle (middle)
    const midRadius = maxRadius * 0.6 * (1 + midEnergy * scaledSensitivity * 0.8);
    ctx.beginPath();
    ctx.arc(centerX, centerY, midRadius, 0, Math.PI * 2);
    const midColor = getColorFromEnergy(0, midEnergy, 0, config.colorMode, config.baseColor);
    ctx.strokeStyle = `${midColor}aa`;
    ctx.lineWidth = 3 + midEnergy * 4 * scaledMotion;
    ctx.stroke();

    // High-frequency spikes (outer)
    for (let i = 0; i < frequencyData.length; i += 4) {
      const amplitude = frequencyData[i] / 255;
      const adjustedAmplitude = amplitude * scaledSensitivity * highEnergy * 1.2;

      const angle = (i / frequencyData.length) * Math.PI * 2;

      // Base coordinates
      const baseX = centerX + Math.cos(angle) * maxRadius;
      const baseY = centerY + Math.sin(angle) * maxRadius;

      // Simple motion effect
      const motionOffset = Math.sin(angle * 2 + Date.now() * 0.001) * 3 * scaledMotion;

      // Target coordinates
      const targetX = centerX + Math.cos(angle) * (maxRadius + adjustedAmplitude * maxRadius * 0.4 * scaledMotion + motionOffset);
      const targetY = centerY + Math.sin(angle) * (maxRadius + adjustedAmplitude * maxRadius * 0.4 * scaledMotion + motionOffset);

      // Draw line
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(targetX, targetY);

      const highColor = getColorFromEnergy(0, 0, highEnergy, config.colorMode, config.baseColor);
      ctx.strokeStyle = `${highColor}${Math.floor(amplitude * 255).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = (1 + amplitude * 2) * scaledMotion;
      ctx.stroke();
    }
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

export default CircularPattern;