import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface WobblePatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const WobblePattern: React.FC<WobblePatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const { timeData, bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
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
    const baseRadius = Math.min(centerX, centerY) * 0.4;
    
    // Calculate overall energy for global effects
    const totalEnergy = (bassEnergy + midEnergy + highEnergy) / 3;
    const time = Date.now() * 0.001;
    
    // Create points array for the wobble circle
    const points: [number, number][] = [];
    const numPoints = 180;
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const timeDataIndex = Math.floor((i / numPoints) * timeData.length);
      
      // Convert time data to amplitude (-1 to 1)
      const amplitude = ((timeData[timeDataIndex] / 128.0) - 1.0);
      
      // Calculate radius with multiple layers of distortion
      let radius = baseRadius;
      
      // Base wobble from audio waveform
      radius += amplitude * 50 * config.sensitivity;
      
      // Frequency-based distortion
      radius += Math.sin(angle * 6 + time * 2) * bassEnergy * 30 * config.motionIntensity;
      radius += Math.sin(angle * 12 + time * 3) * midEnergy * 20 * config.motionIntensity;
      radius += Math.sin(angle * 18 + time * 4) * highEnergy * 15 * config.motionIntensity;
      
      // Calculate point position
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      points.push([x, y]);
    }
    
    // Draw wobble circle
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        // Use quadratic curves for smoother shape
        const [prevX, prevY] = points[i - 1];
        const cpX = (x + prevX) / 2;
        const cpY = (y + prevY) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
      }
    });
    
    // Close the path smoothly
    const [firstX, firstY] = points[0];
    const [lastX, lastY] = points[points.length - 1];
    const cpX = (firstX + lastX) / 2;
    const cpY = (firstY + lastY) / 2;
    ctx.quadraticCurveTo(lastX, lastY, cpX, cpY);
    ctx.quadraticCurveTo(lastX, lastY, firstX, firstY);
    
    // Create gradient fill
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, baseRadius * 1.5
    );
    
    // Get base colors without alpha
    const innerColor = getColorFromEnergy(
      bassEnergy,
      midEnergy,
      highEnergy,
      config.colorMode,
      config.baseColor
    );
    
    const outerColor = getColorFromEnergy(
      bassEnergy * 0.5,
      midEnergy * 0.5,
      highEnergy * 0.5,
      config.colorMode,
      config.baseColor
    );
    
    // Convert HSL colors to HSLA by adding alpha values
    const innerColorWithAlpha = innerColor.replace('hsl', 'hsla').replace(')', ', 1)');
    const innerColorSemiTransparent = innerColor.replace('hsl', 'hsla').replace(')', ', 0.67)');
    const outerColorTransparent = outerColor.replace('hsl', 'hsla').replace(')', ', 0.2)');
    
    gradient.addColorStop(0, innerColorWithAlpha);
    gradient.addColorStop(0.6, innerColorSemiTransparent);
    gradient.addColorStop(1, outerColorTransparent);
    
    // Apply fill with enhanced effects
    ctx.fillStyle = gradient;
    
    if (beat || totalEnergy > 0.7) {
      ctx.shadowColor = innerColorWithAlpha;
      ctx.shadowBlur = 20 * config.motionIntensity;
    }
    
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Add highlight rim
    ctx.beginPath();
    points.forEach(([x, y], i) => {
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        const [prevX, prevY] = points[i - 1];
        const cpX = (x + prevX) / 2;
        const cpY = (y + prevY) / 2;
        ctx.quadraticCurveTo(prevX, prevY, cpX, cpY);
      }
    });
    
    // Close the rim
    ctx.quadraticCurveTo(lastX, lastY, cpX, cpY);
    ctx.quadraticCurveTo(lastX, lastY, firstX, firstY);
    
    ctx.strokeStyle = innerColorWithAlpha;
    ctx.lineWidth = 2 * config.motionIntensity;
    
    if (beat || totalEnergy > 0.6) {
      ctx.shadowColor = innerColorWithAlpha;
      ctx.shadowBlur = 10 * config.motionIntensity;
    }
    
    ctx.stroke();
    
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

export default WobblePattern;