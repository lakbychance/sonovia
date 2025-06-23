import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AudioAnalysisData, VisualizationConfig } from '../../types/audio';
import { getColorFromEnergy } from '../../utils/colorUtils';

interface TerminalPatternProps {
  audioData: AudioAnalysisData;
  dimensions: { width: number; height: number };
  config: VisualizationConfig;
}

interface BinaryDrop {
  x: number;
  y: number;
  speed: number;
  value: string;
  opacity: number;
  size: number;
}

const TerminalPattern: React.FC<TerminalPatternProps> = ({ audioData, dimensions, config }) => {
  const { bassEnergy, midEnergy, highEnergy, beat, isPlaying } = audioData;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [charIndex, setCharIndex] = useState(0);
  const [cursor, setCursor] = useState(true);
  const [glitch, setGlitch] = useState(false);

  const frame = useRef(0);
  const indent = useRef(0);
  const lastBlink = useRef(0);
  const lastType = useRef(0);
  const glitchTimer = useRef<number>();
  const binaryDrops = useRef<BinaryDrop[]>([]);
  const lastDropTime = useRef(0);
  const codeContext = useRef({
    className: '',
    varNames: new Set<string>(),
    inFunction: false,
    inLoop: false
  });

  // Fixed values
  const cmds = ['g++ -std=c++17 -O3 visualizer.cpp', './visualizer'];
  const kw = ['void', 'int', 'float', 'double', 'class', 'struct', 'template', 'typename', 'const', 'static', 'return', 'if', 'else', 'for', 'while', 'private', 'public', 'protected'];
  const ops = ['+', '-', '*', '/', '=', '==', '!=', '>', '<', '>=', '<=', '++', '--', '->', '::', '&&', '||'];
  const types = ['std::vector', 'std::array', 'std::string', 'AudioData', 'Visualizer', 'FFTAnalyzer', 'AudioBuffer', 'FrequencySpectrum'];
  const functions = ['processAudio', 'analyzeFrequency', 'calculateEnergy', 'applyFFT', 'updateVisuals'];

  // Terminal dimensions - made slightly smaller for more minimal look
  const tw = Math.min(700, dimensions.width * 0.7);
  const th = Math.min(400, dimensions.height * 0.6);
  const tx = (dimensions.width - tw) / 2;
  const ty = (dimensions.height - th) / 2;

  // Initialize binary drops
  useEffect(() => {
    const numDrops = Math.floor(dimensions.width / 25); // Reduced density
    binaryDrops.current = Array.from({ length: numDrops }, () => ({
      x: Math.random() * dimensions.width,
      y: Math.random() * dimensions.height,
      speed: 1 + Math.random() * 2, // Slower base speed
      value: Math.random() < 0.5 ? '0' : '1',
      opacity: 0.05 + Math.random() * 0.15, // More subtle opacity
      size: 10 + Math.random() * 4 // Slightly smaller size
    }));
  }, [dimensions]);

  // Generate C++ code
  const generateCode = () => {
    const spaces = ' '.repeat(Math.min(indent.current * 2, 8));

    if (!codeContext.current.className && Math.random() < 0.2) {
      codeContext.current.className = ['AudioProcessor', 'SpectrumAnalyzer', 'VisualizerEngine'][~~(Math.random() * 3)];
      return `class ${codeContext.current.className} {`;
    }

    if (codeContext.current.className && indent.current === 0 && Math.random() < 0.3) {
      indent.current = 1;
      return `${spaces}${['private', 'public', 'protected'][~~(Math.random() * 3)]}:`;
    }

    if (!codeContext.current.inFunction && Math.random() < 0.3) {
      codeContext.current.inFunction = true;
      const func = functions[~~(Math.random() * functions.length)];
      const type = types[~~(Math.random() * types.length)];
      indent.current++;
      return `${spaces}${type} ${func}(const AudioData& data) {`;
    }

    if (codeContext.current.inFunction) {
      const type = types[~~(Math.random() * types.length)];
      const varName = `${['m', 'p', 'tmp'][~~(Math.random() * 3)]}${['Data', 'Buffer', 'Spectrum'][~~(Math.random() * 3)]}`;

      if (!codeContext.current.inLoop && Math.random() < 0.3) {
        codeContext.current.inLoop = true;
        indent.current++;
        return `${spaces}for (size_t i = 0; i < data.size(); ++i) {`;
      }

      if (codeContext.current.inLoop && Math.random() < 0.2) {
        codeContext.current.inLoop = false;
        indent.current--;
        return `${spaces}}`;
      }

      if (Math.random() < 0.7) {
        const value = Math.random() < 0.5 ?
          `new ${type}[${~~(Math.random() * 100)}]` :
          `${type}(${~~(Math.random() * 100)})`;
        return `${spaces}${type}* ${varName} = ${value};`;
      }

      return `${spaces}${functions[~~(Math.random() * functions.length)]}(${varName});`;
    }

    if ((codeContext.current.inFunction || codeContext.current.className) && indent.current > 0 && Math.random() < 0.2) {
      if (codeContext.current.inFunction) {
        codeContext.current.inFunction = false;
      } else {
        codeContext.current.className = '';
      }
      indent.current = Math.max(0, indent.current - 1);
      return `${spaces}}`;
    }

    const type = types[~~(Math.random() * types.length)];
    const varName = `${['m', 'p', 'tmp'][~~(Math.random() * 3)]}${['Data', 'Buffer', 'Array'][~~(Math.random() * 3)]}`;
    const value = Math.random() < 0.5 ?
      `new ${type}[${~~(Math.random() * 100)}]` :
      `${type}(${~~(Math.random() * 100)})`;
    return `${spaces}${type}* ${varName} = ${value};`;
  };

  // Generate line
  useEffect(() => {
    if (charIndex === 0) {
      const statement = generateCode();
      setLines(prev => [...prev.slice(-12), statement]); // Show fewer lines
    }
  }, [charIndex]);

  // Glitch effect on beat
  useEffect(() => {
    const energy = (bassEnergy + midEnergy + highEnergy) / 3;
    if ((beat || energy > 0.7) && !glitch && Math.random() < 0.3) { // Reduced glitch frequency
      setGlitch(true);
      glitchTimer.current = window.setTimeout(() => setGlitch(false), 30 + Math.random() * 100); // Shorter glitch duration
    }
    return () => { if (glitchTimer.current) clearTimeout(glitchTimer.current); };
  }, [beat, glitch, bassEnergy, midEnergy, highEnergy]);

  // Main render loop
  useEffect(() => {
    if (!canvasRef.current || !isPlaying) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false })!;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const energy = (bassEnergy + midEnergy + highEnergy) / 3;
    const sense = config.sensitivity;

    const animate = (time: number) => {
      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw binary rain
      const totalEnergy = (bassEnergy + midEnergy + highEnergy) / 3;
      const baseSpeed = 1 + totalEnergy * 4 * config.sensitivity; // Slower base speed
      const dropRate = 20 - totalEnergy * 8; // Slower drop rate

      if (time - lastDropTime.current > dropRate) {
        const numNewDrops = Math.floor(1 + totalEnergy * 2); // Fewer new drops
        for (let i = 0; i < numNewDrops; i++) {
          if (binaryDrops.current.length < 800) { // Lower drop limit
            binaryDrops.current.push({
              x: Math.random() * dimensions.width,
              y: -20,
              speed: baseSpeed + Math.random() * 2,
              value: Math.random() < 0.5 ? '0' : '1',
              opacity: 0.05 + Math.random() * 0.15, // More subtle opacity
              size: 10 + Math.random() * 4 // Smaller size
            });
          }
        }
        lastDropTime.current = time;
      }

      ctx.font = 'bold 12px "SF Mono", monospace'; // Smaller font
      binaryDrops.current = binaryDrops.current.filter(drop => {
        drop.y += drop.speed * (1 + totalEnergy * config.motionIntensity * 0.8); // Slower motion

        if (drop.y > dimensions.height) {
          return false;
        }

        const color = getColorFromEnergy(
          bassEnergy * drop.opacity,
          midEnergy * drop.opacity,
          highEnergy * drop.opacity,
          config.colorMode,
          config.baseColor
        );

        ctx.fillStyle = color;
        if (beat) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 3; // Reduced glow
        }

        ctx.font = `${drop.size}px "SF Mono", monospace`;
        ctx.fillText(drop.value, drop.x, drop.y);
        ctx.shadowBlur = 0;

        return true;
      });

      // Terminal background with subtle rounded corners
      ctx.save();
      ctx.beginPath();
      const r = 8; // Smaller radius
      ctx.moveTo(tx + r, ty);
      ctx.lineTo(tx + tw - r, ty);
      ctx.quadraticCurveTo(tx + tw, ty, tx + tw, ty + r);
      ctx.lineTo(tx + tw, ty + th - r);
      ctx.quadraticCurveTo(tx + tw, ty + th, tx + tw - r, ty + th);
      ctx.lineTo(tx + r, ty + th);
      ctx.quadraticCurveTo(tx, ty + th, tx, ty + th - r);
      ctx.lineTo(tx, ty + r);
      ctx.quadraticCurveTo(tx, ty, tx + r, ty);
      ctx.closePath();

      // Subtle glitch
      if (glitch) {
        const glitchAmount = 1 + energy * 2; // Reduced glitch intensity
        ctx.translate(
          (Math.random() - 0.5) * glitchAmount,
          (Math.random() - 0.5) * glitchAmount
        );

        // Subtle RGB split
        const split = 1 + energy * 1.5;
        ctx.fillStyle = 'rgba(255, 0, 0, 0.05)';
        ctx.fillRect(tx - split, ty, tw, th);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
        ctx.fillRect(tx, ty, tw, th);
        ctx.fillStyle = 'rgba(0, 0, 255, 0.05)';
        ctx.fillRect(tx + split, ty, tw, th);
      }

      // Subtle terminal glow
      const color = getColorFromEnergy(bassEnergy, midEnergy, highEnergy, config.colorMode, config.baseColor);
      ctx.shadowColor = color;
      ctx.shadowBlur = energy * 15 * sense;
      ctx.fillStyle = 'rgba(10, 10, 10, 0.97)'; // Slightly darker, more solid background
      ctx.fill();
      ctx.clip();

      // Update cursor and typing
      if (time - lastBlink.current > (500 - energy * sense * 200)) {
        setCursor(p => !p);
        lastBlink.current = time;
      }

      if (time - lastType.current > Math.max(20, 120 - (energy * sense) ** 2 * 60)) {
        setCharIndex(p => {
          if (!lines.length) return 0;
          return p >= lines[lines.length - 1].length ? 0 : p + 1;
        });
        lastType.current = time;
      }

      // Content
      ctx.font = '13px "SF Mono", monospace'; // Slightly smaller font
      ctx.textBaseline = 'top';

      const lh = 22; // Increased line height
      const visible = ~~((th - 60) / lh);
      const sy = ty + 35;

      // Command history
      cmds.forEach((cmd, i) => {
        ctx.fillStyle = '#55FF55';
        ctx.fillText('$ ', tx + 16, sy + (i * lh));
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(cmd, tx + 32, sy + (i * lh));
      });

      // Minimal separator
      ctx.strokeStyle = `rgba(60, 60, 60, ${0.4 + energy * 0.2})`; // More subtle separator
      ctx.beginPath();
      ctx.moveTo(tx + 16, sy + 2.5 * lh + 5);
      ctx.lineTo(tx + tw - 16, sy + 2.5 * lh + 5);
      ctx.stroke();

      // Very subtle shake
      const shake = Math.min(energy * config.motionIntensity * 0.05, 0.05);
      const ox = (Math.random() - 0.5) * shake;
      const oy = (Math.random() - 0.5) * shake;

      // Code
      const codeY = sy + 3 * lh;
      const start = Math.max(0, lines.length - visible + 3);

      // Helper for syntax highlighting
      const highlight = (text: string, x: number, y: number, alpha = 1) => {
        let pos = x;
        let inStr = false;
        let word = '';

        const renderWord = () => {
          if (!word) return;

          let color;
          if (inStr) color = '#CE9178';
          else if (kw.includes(word)) color = '#569CD6';
          else if (types.includes(word)) color = '#4EC9B0';
          else if (ops.includes(word)) color = '#D4D4D4';
          else if (/^[0-9]+$/.test(word)) color = '#B5CEA8';
          else if (functions.includes(word)) color = '#DCDCAA';
          else color = '#9CDCFE';

          if (glitch && Math.random() < 0.08) {
            const chars = word.split('');
            const glitchIndex = ~~(Math.random() * chars.length);
            chars[glitchIndex] = String.fromCharCode(
              chars[glitchIndex].charCodeAt(0) + ~~(Math.random() * 6) - 3
            );
            word = chars.join('');
          }

          color = color.replace(')', `, ${alpha})`);
          ctx.fillStyle = color;
          ctx.fillText(word, pos, y);
          pos += ctx.measureText(word).width;
          word = '';
        };

        for (let i = 0; i < text.length; i++) {
          const c = text[i];

          if ((c === '"' || c === "'") && !inStr) {
            renderWord();
            word = c;
            inStr = true;
          } else if ((c === '"' || c === "'") && inStr) {
            word += c;
            renderWord();
            inStr = false;
          } else if (c === ' ' && !inStr) {
            renderWord();
            ctx.fillStyle = `rgba(212, 212, 212, ${alpha})`;
            ctx.fillText(' ', pos, y);
            pos += ctx.measureText(' ').width;
          } else if ('{}();,<>'.includes(c) && !inStr) {
            renderWord();
            ctx.fillStyle = `rgba(212, 212, 212, ${alpha})`;
            ctx.fillText(c, pos, y);
            pos += ctx.measureText(c).width;
          } else {
            word += c;
          }
        }

        renderWord();
        return pos;
      };

      // Previous lines with fade
      lines.slice(start, -1).forEach((line, i) => {
        const age = (lines.length - start - i) / (visible - 4);
        const y = codeY + (i * lh) + oy;

        if (y < ty + 30 || y > ty + th - 20) return;
        highlight(line, tx + 16 + ox, y, 1 - age * 0.6);
      });

      // Current line
      if (lines.length) {
        const curr = lines[lines.length - 1].substring(0, charIndex);
        const y = codeY + ((lines.length - start - 1) * lh) + oy;

        if (y >= ty + 30 && y <= ty + th - 20) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 3 + energy * 8; // Reduced glow
          const cursorPos = highlight(curr, tx + 16 + ox, y);

          // Minimal cursor
          if (cursor) {
            ctx.fillStyle = color;
            const cursorH = 13 + energy;
            ctx.fillRect(cursorPos, y + 1, 2, cursorH); // Thinner cursor
            ctx.shadowBlur = 8 + energy * 12;
            ctx.fillRect(cursorPos, y + 1, 2, cursorH);
          }
        }
      }

      // Minimal terminal header
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a1a1a'; // Darker header
      ctx.fillRect(tx, ty, tw, 28); // Shorter header

      // Subtle window buttons
      [`hsl(${1 + bassEnergy * 20}, 70%, 45%)`,
      `hsl(${45 + midEnergy * 20}, 70%, 45%)`,
      `hsl(${120 + highEnergy * 20}, 70%, 45%)`].forEach((c, i) => {
        ctx.beginPath();
        ctx.arc(tx + 16 + (i * 20), ty + 14, 4 + energy * 0.5, 0, Math.PI * 2); // Smaller buttons
        ctx.fillStyle = c;
        ctx.fill();

        if (beat) {
          ctx.shadowColor = c;
          ctx.shadowBlur = 6;
          ctx.fill();
        }
      });

      // Minimal title
      ctx.fillStyle = `rgba(102, 102, 102, ${0.6 + energy * 0.2})`; // More subtle title
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('visualizer.cpp', tx + tw / 2, ty + 8);

      ctx.restore();

      frame.current = requestAnimationFrame(animate);
    };

    frame.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame.current);
      if (glitchTimer.current) clearTimeout(glitchTimer.current);
    };
  }, [audioData, dimensions, config, isPlaying, lines, charIndex, cursor, glitch, tw, th, tx, ty]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </motion.div>
  );
};

export default TerminalPattern;