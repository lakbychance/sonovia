import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface SpiralPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

const SpiralPattern: React.FC<SpiralPatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const { frequencyData, bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
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
    const maxRadius = Math.min(centerX, centerY) * 0.9;
    
    // Enhanced sensitivity and motion
    const enhancedSensitivity = config.sensitivity * 2.5;
    const enhancedMotion = config.motionIntensity * 2.2;
    
    // Draw spiral based on frequency data
    const numSpirals = 3;
    const pointsPerSpiral = Math.floor(frequencyData.length / numSpirals);
    
    for (let s = 0; s < numSpirals; s++) {
      ctx.beginPath();
      
      for (let i = 0; i < pointsPerSpiral; i++) {
        const freqIndex = s * pointsPerSpiral + i;
        const amplitude = frequencyData[freqIndex] / 255;
        
        // Calculate spiral coordinates with enhanced motion
        const progress = i / pointsPerSpiral;
        const angle = progress * Math.PI * 2 * 8 + (Date.now() * 0.001 * enhancedMotion);
        const radiusOffset = amplitude * 90 * enhancedSensitivity;
        const radius = (progress * maxRadius + radiusOffset) / numSpirals + (s * maxRadius / numSpirals);
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      // Color based on spiral position with enhanced energy response
      const energy = s === 0 ? bassEnergy * 1.4 : s === 1 ? midEnergy * 1.4 : highEnergy * 1.4;
      const color = getColorFromEnergy(
        s === 0 ? energy : 0,
        s === 1 ? energy : 0,
        s === 2 ? energy : 0,
        config.colorMode,
        config.baseColor
      );
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * enhancedMotion;
      ctx.stroke();
      
      // Enhanced glow effect
      if (beat || energy > 0.5) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 30 * enhancedMotion;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
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

export default SpiralPattern;