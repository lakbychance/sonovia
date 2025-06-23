import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface HyperspacePatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  color: string;
  trail: { x: number; y: number }[];
  trailLength: number;
}

const HyperspacePattern: React.FC<HyperspacePatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const { bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const timeRef = useRef(0);
  const focalLengthRef = useRef(300);
  const lastFrameTimeRef = useRef(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIdRef = useRef<number>(0);
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Rotation state
  const rotationRef = useRef({ x: 0, y: 0, z: 0 });
  const targetRotationRef = useRef({ x: 0, y: 0, z: 0 });
  const lastRotationUpdateRef = useRef(0);
  const rotationUpdateIntervalRef = useRef(3000); // Update rotation target every 3 seconds

  // Initialize stars
  useEffect(() => {
    // Create offscreen canvas
    offscreenCanvasRef.current = document.createElement('canvas');
    offscreenCanvasRef.current.width = dimensions.width;
    offscreenCanvasRef.current.height = dimensions.height;
    
    // Create blur canvas for close stars
    blurCanvasRef.current = document.createElement('canvas');
    blurCanvasRef.current.width = dimensions.width;
    blurCanvasRef.current.height = dimensions.height;

    const numStars = 300;
    const stars: Star[] = [];

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 2000,
        size: 1 + Math.random() * 2,
        speed: 1 + Math.random() * 1,
        color: `hsl(${220 + Math.random() * 40}, 80%, 80%)`,
        trail: [],
        trailLength: Math.floor(3 + Math.random() * 5)
      });
    }

    starsRef.current = stars;
  }, [dimensions]);

  // Helper function to rotate a point in 3D space
  const rotatePoint = (point: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }) => {
    let { x, y, z } = point;
    
    // Rotate around X axis
    const cosX = Math.cos(rotation.x);
    const sinX = Math.sin(rotation.x);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    y = y1;
    z = z1;
    
    // Rotate around Y axis
    const cosY = Math.cos(rotation.y);
    const sinY = Math.sin(rotation.y);
    const x2 = x * cosY + z * sinY;
    const z2 = -x * sinY + z * cosY;
    x = x2;
    z = z2;
    
    // Rotate around Z axis
    const cosZ = Math.cos(rotation.z);
    const sinZ = Math.sin(rotation.z);
    const x3 = x * cosZ - y * sinZ;
    const y3 = x * sinZ + y * cosZ;
    x = x3;
    y = y3;
    
    return { x, y, z };
  };

  useEffect(() => {
    if (!canvasRef.current || !offscreenCanvasRef.current || !blurCanvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    const offscreenCtx = offscreenCanvasRef.current.getContext('2d', { alpha: false });
    const blurCtx = blurCanvasRef.current.getContext('2d', { alpha: false });
    
    if (!ctx || !offscreenCtx || !blurCtx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    offscreenCanvasRef.current.width = dimensions.width;
    offscreenCanvasRef.current.height = dimensions.height;
    blurCanvasRef.current.width = dimensions.width;
    blurCanvasRef.current.height = dimensions.height;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    let lastUpdate = 0;
    const updateInterval = 16;

    const animate = (currentTime: number) => {
      if (currentTime - lastUpdate < updateInterval) {
        frameIdRef.current = requestAnimationFrame(animate);
        return;
      }
      
      lastUpdate = currentTime;
      const deltaTime = (currentTime - lastFrameTimeRef.current) / 16.67;
      lastFrameTimeRef.current = currentTime;
      timeRef.current += deltaTime * 0.016;

      // Update rotation targets periodically with motion intensity influence
      if (currentTime - lastRotationUpdateRef.current > rotationUpdateIntervalRef.current) {
        const rotationScale = config.motionIntensity;
        targetRotationRef.current = {
          x: (Math.random() - 0.5) * 0.5 * rotationScale,
          y: (Math.random() - 0.5) * 0.4 * rotationScale,
          z: (Math.random() - 0.5) * 0.3 * rotationScale
        };
        lastRotationUpdateRef.current = currentTime;
      }

      // Smoothly interpolate current rotation to target
      const rotationSpeed = 0.02 * deltaTime * config.motionIntensity;
      rotationRef.current = {
        x: rotationRef.current.x + (targetRotationRef.current.x - rotationRef.current.x) * rotationSpeed,
        y: rotationRef.current.y + (targetRotationRef.current.y - rotationRef.current.y) * rotationSpeed,
        z: rotationRef.current.z + (targetRotationRef.current.z - rotationRef.current.z) * rotationSpeed
      };

      // Clear canvases
      offscreenCtx.fillStyle = 'rgb(0, 0, 0)';
      offscreenCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      blurCtx.fillStyle = 'rgb(0, 0, 0)';
      blurCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      offscreenCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      offscreenCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      blurCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      blurCtx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate speeds and effects
      const baseSpeed = 2 * config.motionIntensity;
      const audioSpeed = (
        bassEnergy * 3 +
        midEnergy * 2 +
        highEnergy
      ) * config.sensitivity;
      
      const speedMultiplier = 1 + baseSpeed + audioSpeed * 4;

      const targetFocalLength = 200 + (beat ? 100 : 0) + bassEnergy * 200;
      focalLengthRef.current += (targetFocalLength - focalLengthRef.current) * 0.1;

      // Update and draw stars
      const stars = starsRef.current;
      
      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        
        // Update star position with motion intensity influence
        star.z -= star.speed * speedMultiplier * deltaTime * config.motionIntensity;

        // Reset star when it goes behind camera
        if (star.z < 1) {
          star.z = 2000;
          star.x = (Math.random() - 0.5) * 2000;
          star.y = (Math.random() - 0.5) * 2000;
          star.trail = [];
          continue;
        }

        // Apply rotation to star position
        const rotatedPosition = rotatePoint(
          { x: star.x, y: star.y, z: star.z },
          rotationRef.current
        );

        // Project 3D coordinates to 2D
        const scale = focalLengthRef.current / rotatedPosition.z;
        const x = centerX + rotatedPosition.x * scale;
        const y = centerY + rotatedPosition.y * scale;
        
        if (x < 0 || x > dimensions.width || y < 0 || y > dimensions.height) {
          continue;
        }

        star.trail.unshift({ x, y });
        if (star.trail.length > star.trailLength) {
          star.trail.pop();
        }
        
        const perspective = 1 - rotatedPosition.z / 2000;
        const size = Math.max(0.1, star.size * scale * (1 + audioSpeed * 0.2)); // Ensure minimum size of 0.1

        const starColor = getColorFromEnergy(
          bassEnergy * perspective,
          midEnergy * perspective,
          highEnergy * perspective,
          config.colorMode,
          config.baseColor
        );

        const isClose = rotatedPosition.z < 300;
        const targetCtx = isClose ? blurCtx : offscreenCtx;
        
        if (star.trail.length > 1) {
          targetCtx.beginPath();
          targetCtx.moveTo(star.trail[0].x, star.trail[0].y);

          for (let j = 1; j < star.trail.length; j++) {
            targetCtx.lineTo(star.trail[j].x, star.trail[j].y);
          }

          targetCtx.strokeStyle = starColor;
          targetCtx.lineWidth = Math.max(0.1, isClose ? size * 1.5 : size); // Ensure minimum line width of 0.1
          targetCtx.lineCap = isClose ? 'round' : 'butt';
          targetCtx.stroke();
        }

        if (!isClose) {
          targetCtx.beginPath();
          targetCtx.arc(x, y, size, 0, Math.PI * 2);
          targetCtx.fillStyle = starColor;

          if ((beat && bassEnergy > 0.8) || i % 5 === 0) {
            targetCtx.shadowColor = starColor;
            targetCtx.shadowBlur = 5 * size * config.motionIntensity;
          }

          targetCtx.fill();
          targetCtx.shadowBlur = 0;
        } else {
          targetCtx.beginPath();
          targetCtx.arc(x, y, Math.max(0.1, size * 2), 0, Math.PI * 2); // Ensure minimum radius of 0.1
          targetCtx.fillStyle = starColor;
          targetCtx.shadowColor = starColor;
          targetCtx.shadowBlur = 10 * size * config.motionIntensity;
          targetCtx.fill();
          targetCtx.shadowBlur = 0;
        }
      }

      // Apply blur effects with motion intensity influence
      if (beat || bassEnergy > 0.5) {
        const blurRadius = (beat ? 25 : 12.5) * config.motionIntensity;
        blurCtx.filter = `blur(${blurRadius}px)`;
        blurCtx.drawImage(blurCanvasRef.current!, 0, 0);
        blurCtx.filter = 'none';
      } else {
        blurCtx.filter = `blur(${5 * config.motionIntensity}px)`;
        blurCtx.drawImage(blurCanvasRef.current!, 0, 0);
        blurCtx.filter = 'none';
      }

      // Composite final image
      ctx.drawImage(offscreenCanvasRef.current!, 0, 0);
      
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(blurCanvasRef.current!, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      // Add chromatic aberration on beats, scaled by motion intensity
      const aberrationStrength = beat ? Math.min(5, bassEnergy * 5 * config.sensitivity * config.motionIntensity) : 0;
      
      if (aberrationStrength > 0) {
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(
          offscreenCanvasRef.current!,
          -aberrationStrength, 0,
          canvas.width + aberrationStrength * 2, canvas.height
        );
        
        ctx.drawImage(
          offscreenCanvasRef.current!,
          aberrationStrength, 0,
          canvas.width + aberrationStrength * 2, canvas.height
        );
        
        ctx.globalCompositeOperation = 'source-over';
      }

      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
    };
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

export default HyperspacePattern;