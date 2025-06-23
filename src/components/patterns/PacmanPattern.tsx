import React, { useRef, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface PacmanPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

interface Ghost {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  speed: number;
  direction: number;
  targetDirection: number;
  scared: boolean;
  waveOffset: number;
  waveSpeed: number;
}

interface Dot {
  x: number;
  y: number;
  eaten: boolean;
  wobblePhase: number;
  wobbleSpeed: number;
  baseX: number;
  baseY: number;
}

const PacmanPattern: React.FC<PacmanPatternProps> = ({
  audioData,
  dimensions,
  config,
}) => {
  const { bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const pacmanRef = useRef({ 
    x: 100, 
    y: dimensions.height / 2, 
    direction: 0,
    mouthAngle: 0,
    targetMouthAngle: 0,
    mouthSpeed: 0,
    targetDirection: 0,
    lastPosition: { x: 100, y: dimensions.height / 2 },
    velocity: 0,
    mouthPhase: 0,
    energyAccumulator: 0
  });
  const ghostsRef = useRef<Ghost[]>([]);
  const dotsRef = useRef<Dot[]>([]);
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Initialize ghosts and dots
  useEffect(() => {
    // Create offscreen canvas
    offscreenCanvasRef.current = document.createElement('canvas');
    offscreenCanvasRef.current.width = dimensions.width;
    offscreenCanvasRef.current.height = dimensions.height;
    
    ghostsRef.current = [
      { x: dimensions.width - 100, y: dimensions.height / 2 - 80, targetX: dimensions.width - 100, targetY: dimensions.height / 2 - 80, color: '#ff0000', speed: 2, direction: Math.PI, targetDirection: Math.PI, scared: false, waveOffset: 0, waveSpeed: 0.007 },
      { x: dimensions.width - 100, y: dimensions.height / 2 - 40, targetX: dimensions.width - 100, targetY: dimensions.height / 2 - 40, color: '#00ffff', speed: 2, direction: Math.PI, targetDirection: Math.PI, scared: false, waveOffset: Math.PI / 2, waveSpeed: 0.008 },
      { x: dimensions.width - 100, y: dimensions.height / 2 + 40, targetX: dimensions.width - 100, targetY: dimensions.height / 2 + 40, color: '#ff69b4', speed: 2, direction: Math.PI, targetDirection: Math.PI, scared: false, waveOffset: Math.PI, waveSpeed: 0.006 },
      { x: dimensions.width - 100, y: dimensions.height / 2 + 80, targetX: dimensions.width - 100, targetY: dimensions.height / 2 + 80, color: '#ffa500', speed: 2, direction: Math.PI, targetDirection: Math.PI, scared: false, waveOffset: Math.PI * 1.5, waveSpeed: 0.009 },
    ];
    
    // Optimize dot placement with fewer dots and better spacing
    const spacing = Math.max(40, Math.min(60, dimensions.width / 20));
    const dots: Dot[] = [];
    for (let x = spacing; x < dimensions.width - spacing; x += spacing) {
      for (let y = spacing; y < dimensions.height - spacing; y += spacing) {
        dots.push({
          x,
          y,
          baseX: x,
          baseY: y,
          eaten: false,
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.002 + Math.random() * 0.003
        });
      }
    }
    dotsRef.current = dots;
    setScore(0); // Reset score when dots are initialized
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dimensions]);
  
  // Pre-calculate common values
  const totalEnergy = useMemo(() => {
    return (bassEnergy + midEnergy + highEnergy) / 3;
  }, [bassEnergy, midEnergy, highEnergy]);
  
  useEffect(() => {
    if (!canvasRef.current || !offscreenCanvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    const offscreenCtx = offscreenCanvasRef.current.getContext('2d', { alpha: false });
    if (!ctx || !offscreenCtx) return;
    
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    const animate = (timestamp: number) => {
      const deltaTime = timestamp - (lastTimeRef.current || timestamp);
      lastTimeRef.current = timestamp;
      
      // Clear offscreen canvas
      offscreenCtx.fillStyle = '#000000';
      offscreenCtx.fillRect(0, 0, canvas.width, canvas.height);
      
      if (isPlaying) {
        // Update Pacman
        const baseMouthSpeed = 0.008;
        const energyBoost = totalEnergy * 0.004;
        pacmanRef.current.mouthPhase += (baseMouthSpeed + energyBoost) * deltaTime;
        
        const minMouthAngle = Math.PI / 12;
        const maxMouthAngle = Math.PI / 3;
        const mouthAngle = minMouthAngle + (Math.sin(pacmanRef.current.mouthPhase) + 1) / 2 * (maxMouthAngle - minMouthAngle);
        pacmanRef.current.mouthAngle += (mouthAngle - pacmanRef.current.mouthAngle) * 0.15;
        
        if (totalEnergy > 0.1) {
          // Update Pacman position and direction
          pacmanRef.current.energyAccumulator += totalEnergy * deltaTime * 0.001;
          
          const baseAngle = Math.atan2(
            (midEnergy - 0.5) * 2,
            (bassEnergy - highEnergy) * 2
          );
          
          const circularMotion = Math.sin(pacmanRef.current.energyAccumulator * 2) * Math.PI * 0.5;
          const beatImpulse = beat ? (Math.random() - 0.5) * Math.PI : 0;
          const targetAngle = baseAngle + circularMotion + beatImpulse;
          
          const directionSmoothing = 0.1 + (1 - totalEnergy) * 0.2;
          pacmanRef.current.targetDirection = targetAngle;
          pacmanRef.current.direction += (pacmanRef.current.targetDirection - pacmanRef.current.direction) * directionSmoothing;
          
          const baseSpeed = 1;
          const energyBoost = totalEnergy * 4;
          const finalSpeed = (baseSpeed + energyBoost) * config.sensitivity;
          
          pacmanRef.current.lastPosition = { x: pacmanRef.current.x, y: pacmanRef.current.y };
          
          const randomOffset = highEnergy > 0.7 ? (Math.random() - 0.5) * 10 : 0;
          
          pacmanRef.current.x = (pacmanRef.current.x + Math.cos(pacmanRef.current.direction) * finalSpeed + randomOffset + dimensions.width) % dimensions.width;
          pacmanRef.current.y = (pacmanRef.current.y + Math.sin(pacmanRef.current.direction) * finalSpeed + randomOffset + dimensions.height) % dimensions.height;
          
          const dx = pacmanRef.current.x - pacmanRef.current.lastPosition.x;
          const dy = pacmanRef.current.y - pacmanRef.current.lastPosition.y;
          pacmanRef.current.velocity = Math.hypot(dx, dy);
        }
        
        // Update ghosts with optimized calculations
        if (bassEnergy > 0.1) {
          const pacmanX = pacmanRef.current.x;
          const pacmanY = pacmanRef.current.y;
          
          ghostsRef.current.forEach(ghost => {
            ghost.scared = highEnergy > 0.8;
            ghost.speed = bassEnergy * 4 * config.sensitivity;
            
            const dx = pacmanX - ghost.x;
            const dy = pacmanY - ghost.y;
            const distanceToPacman = Math.hypot(dx, dy);
            
            if (distanceToPacman < 250) {
              const angle = Math.atan2(dy, dx);
              ghost.targetDirection = angle + Math.PI + (Math.random() - 0.5) * Math.PI * 0.5;
            } else {
              const targetAngle = Math.atan2(dy, dx);
              const randomAngle = Math.random() * Math.PI * 2;
              ghost.targetDirection += ((targetAngle * 0.2 + randomAngle * 0.8) - ghost.targetDirection) * 0.05;
            }
            
            ghost.direction += (ghost.targetDirection - ghost.direction) * 0.1;
            
            const moveX = Math.cos(ghost.direction) * ghost.speed;
            const moveY = Math.sin(ghost.direction) * ghost.speed;
            
            ghost.targetX = ghost.x + moveX;
            ghost.targetY = ghost.y + moveY;
            
            ghost.x = (ghost.x + (ghost.targetX - ghost.x) * 0.2 + dimensions.width) % dimensions.width;
            ghost.y = (ghost.y + (ghost.targetY - ghost.y) * 0.2 + dimensions.height) % dimensions.height;
            
            ghost.waveOffset += ghost.waveSpeed * (1 + totalEnergy);
          });
        }
        
        // Update dot positions with wobble
        dotsRef.current.forEach(dot => {
          if (!dot.eaten) {
            // Update wobble phase
            dot.wobblePhase += dot.wobbleSpeed * deltaTime * (1 + totalEnergy * 2);
            
            // Calculate wobble offset based on audio features
            const bassWobble = Math.sin(dot.wobblePhase) * bassEnergy * 40;
            const midWobble = Math.cos(dot.wobblePhase * 1.5) * midEnergy * 15;
            const highWobble = Math.sin(dot.wobblePhase * 2) * highEnergy * 25;
            
            // Apply wobble to dot position
            dot.x = dot.baseX + bassWobble + midWobble;
            dot.y = dot.baseY + midWobble + highWobble;
            
            // Add beat effect
            if (beat) {
              const beatOffset = (Math.random() - 0.5) * 10;
              dot.x += beatOffset;
              dot.y += beatOffset;
            }
          }
        });
      }
      
      // Draw dots with optimized rendering
      const dotColor = getColorFromEnergy(
        bassEnergy,
        midEnergy,
        highEnergy,
        config.colorMode,
        config.baseColor
      );
      
      const pacmanX = pacmanRef.current.x;
      const pacmanY = pacmanRef.current.y;
      
      let dotsEatenThisFrame = 0;
      
      dotsRef.current.forEach(dot => {
        if (!dot.eaten) {
          const dx = pacmanX - dot.x;
          const dy = pacmanY - dot.y;
          const distToPacman = Math.hypot(dx, dy);
          
          if (distToPacman < 20) {
            dot.eaten = true;
            dotsEatenThisFrame++;
            return;
          }
          
          const sizeRatio = Math.max(0, 1 - (distToPacman / 150));
          const dotSize = 3 + 5 * sizeRatio;
          const pulseAmount = (bassEnergy * 2 + midEnergy + highEnergy) / 2;
          const finalSize = dotSize * (1 + pulseAmount * 0.3);
          
          offscreenCtx.beginPath();
          offscreenCtx.arc(dot.x, dot.y, finalSize, 0, Math.PI * 2);
          
          const gradient = offscreenCtx.createRadialGradient(
            dot.x, dot.y, 0,
            dot.x, dot.y, finalSize
          );
          gradient.addColorStop(0, dotColor);
          gradient.addColorStop(1, dotColor.replace('hsl', 'hsla').replace(')', ', 0.53)'));
          
          offscreenCtx.fillStyle = gradient;
          
          if (sizeRatio > 0.5 || beat) {
            offscreenCtx.shadowColor = dotColor;
            offscreenCtx.shadowBlur = Math.max(sizeRatio * 15, beat ? 20 : 0);
          }
          
          offscreenCtx.fill();
          offscreenCtx.shadowBlur = 0;
        }
      });
      
      if (dotsEatenThisFrame > 0) {
        setScore(prevScore => prevScore + dotsEatenThisFrame);
      }
      
      // Draw Pacman
      offscreenCtx.save();
      offscreenCtx.translate(pacmanRef.current.x, pacmanRef.current.y);
      offscreenCtx.rotate(pacmanRef.current.direction);
      
      offscreenCtx.beginPath();
      offscreenCtx.arc(0, 0, 20, pacmanRef.current.mouthAngle, Math.PI * 2 - pacmanRef.current.mouthAngle);
      offscreenCtx.lineTo(0, 0);
      offscreenCtx.closePath();
      offscreenCtx.fillStyle = '#ffff00';
      
      if (beat) {
        offscreenCtx.shadowColor = '#ffff00';
        offscreenCtx.shadowBlur = 20;
      }
      
      offscreenCtx.fill();
      offscreenCtx.shadowBlur = 0;
      offscreenCtx.restore();
      
      // Draw ghosts with optimized rendering
      ghostsRef.current.forEach(ghost => {
        offscreenCtx.beginPath();
        offscreenCtx.arc(ghost.x, ghost.y, 15, Math.PI, 0, false);
        
        const time = Date.now() * 0.01;
        const baseWave = Math.sin(time + ghost.waveOffset) * 2;
        
        offscreenCtx.lineTo(ghost.x + 15, ghost.y + 15 + baseWave);
        
        for (let i = 0; i < 3; i++) {
          const wavePhase = ghost.waveOffset + i * Math.PI / 2;
          const wave = Math.sin(time + wavePhase) * 4 + Math.sin(time * 1.5 + wavePhase) * 2;
          
          offscreenCtx.quadraticCurveTo(
            ghost.x + 10 - i * 10,
            ghost.y + 20 + wave * 0.7,
            ghost.x + 5 - i * 10,
            ghost.y + 15 + baseWave
          );
        }
        
        offscreenCtx.lineTo(ghost.x - 15, ghost.y);
        
        offscreenCtx.fillStyle = ghost.scared ? '#0000ff' : ghost.color;
        
        if (beat || ghost.scared) {
          offscreenCtx.shadowColor = offscreenCtx.fillStyle;
          offscreenCtx.shadowBlur = 15;
        }
        
        offscreenCtx.fill();
        offscreenCtx.shadowBlur = 0;
        
        const eyeOffset = Math.cos(ghost.direction) * 3;
        const eyeY = Math.sin(ghost.direction) * 3;
        
        // Eyes
        offscreenCtx.fillStyle = 'white';
        offscreenCtx.beginPath();
        offscreenCtx.arc(ghost.x - 7 + eyeOffset, ghost.y - 4 + eyeY, 4, 0, Math.PI * 2);
        offscreenCtx.arc(ghost.x + 7 + eyeOffset, ghost.y - 4 + eyeY, 4, 0, Math.PI * 2);
        offscreenCtx.fill();
        
        if (ghost.scared) {
          offscreenCtx.beginPath();
          offscreenCtx.moveTo(ghost.x - 7, ghost.y + 2);
          offscreenCtx.lineTo(ghost.x - 3, ghost.y + 5);
          offscreenCtx.lineTo(ghost.x + 1, ghost.y + 2);
          offscreenCtx.lineTo(ghost.x + 5, ghost.y + 5);
          offscreenCtx.lineTo(ghost.x + 9, ghost.y + 2);
          offscreenCtx.strokeStyle = 'white';
          offscreenCtx.lineWidth = 2;
          offscreenCtx.stroke();
        }
      });
      
      // Draw score
      offscreenCtx.font = 'bold 24px Arial';
      offscreenCtx.fillStyle = '#ffff00';
      offscreenCtx.textAlign = 'right';
      offscreenCtx.textBaseline = 'top';
      
      // Add glow effect to score
      if (beat) {
        offscreenCtx.shadowColor = '#ffff00';
        offscreenCtx.shadowBlur = 10;
      }
      
      offscreenCtx.fillText(`Score: ${score}`, canvas.width - 20, 20);
      offscreenCtx.shadowBlur = 0;
      
      // Copy from offscreen canvas to main canvas
      ctx.drawImage(offscreenCanvasRef.current!, 0, 0);
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate(performance.now());
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [audioData, dimensions, config, isPlaying, totalEnergy, score]);
  
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

export default PacmanPattern;