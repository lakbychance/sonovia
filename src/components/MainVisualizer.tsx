import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioAnalysisData, VisualizationMode, VisualizationConfig } from '../types/audio';
import CircularPattern from './patterns/CircularPattern';
import WaveformPattern from './patterns/WaveformPattern';
import RingsPattern from './patterns/RingsPattern';
import TunnelPattern from './patterns/TunnelPattern';
import SpiralPattern from './patterns/SpiralPattern';
import WobblePattern from './patterns/WobblePattern';
import LightRayPattern from './patterns/LightRayPattern';
import HalosPattern from './patterns/HalosPattern';
import PlanetaryPattern from './patterns/PlanetaryPattern';
import SolarFlarePattern from './patterns/SolarFlarePattern';
import StockGraphPattern from './patterns/StockGraphPattern';
import PacmanPattern from './patterns/PacmanPattern';
import HyperspacePattern from './patterns/HyperspacePattern';
import FluxPattern from './patterns/FluxPattern';
import TerminalPattern from './patterns/TerminalPattern';
import BeatJumperPattern from './patterns/BeatJumperPattern';
import GitHubPattern from './patterns/GitHubPattern';
import BlackholePattern from './patterns/BlackholePattern';
import WormholePattern from './patterns/WormholePattern.tsx';
import PongPattern from './patterns/PongPattern';
import ClockPattern from './patterns/ClockPattern';
import { getColorFromEnergy } from '../utils/colorUtils';
import { Expand, Minimize, Play, Pause } from 'lucide-react';
import clsx from 'clsx';

interface MainVisualizerProps {
  audioData: AudioAnalysisData;
  visualizationMode: VisualizationMode;
  config: VisualizationConfig;
  hasSelectedFile: boolean;
  showSettings: boolean;
  children?: React.ReactNode;
  onTogglePlayer: () => void;
}

const MainVisualizer: React.FC<MainVisualizerProps> = ({
  audioData,
  visualizationMode,
  config,
  hasSelectedFile,
  showSettings,
  children,
  onTogglePlayer
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);
  const timeoutRef = useRef<number>();
  const lastPlayingStateRef = useRef(audioData.isPlaying);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMicMode = audioData.isMicMode;

  const resetTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setShowControls(true);

    if (!showSettings && hasSelectedFile) {
      timeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (showSettings || !hasSelectedFile) {
      setShowControls(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    } else {
      resetTimer();
    }
  }, [showSettings, hasSelectedFile]);

  useEffect(() => {
    if (audioData.isPlaying !== lastPlayingStateRef.current) {
      lastPlayingStateRef.current = audioData.isPlaying;
      if (audioData.isPlaying) {
        resetTimer();
      }
    }
  }, [audioData.isPlaying]);

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      try {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Error attempting to enable fullscreen:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Error attempting to exit fullscreen:', err);
      }
    }
  };

  const onPatternAreaClick = () => {
    if (showControls && !isMicMode) {
      if (clickTimeoutRef.current) return;
      setShowPlayOverlay(true);
      clickTimeoutRef.current = setTimeout(() => {
        onTogglePlayer();
        setShowPlayOverlay(false);
        clickTimeoutRef.current = null;
      }, 250);
    }
  };

  const onPatternAreaDoubleClick = () => {
    if (document.documentElement.clientWidth < 1024) return;
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      setShowPlayOverlay(false);
      clickTimeoutRef.current = null;
    }
    toggleFullscreen();
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const bgColor = getColorFromEnergy(
    audioData.bassEnergy,
    audioData.midEnergy,
    audioData.highEnergy,
    config.colorMode,
    config.baseColor
  );

  const text1 = "Silence is sweet, but visuals need a beat.";
  const text2 = "Select your song!";
  const characters1 = text1.split("");
  const characters2 = text2.split("");

  return (
    <div
      ref={containerRef}
      className={clsx(
        "relative w-full h-full mx-auto bg-gradient-to-b from-zinc-900 to-zinc-800 overflow-hidden",
        !isFullscreen && "rounded-2xl border border-zinc-700"
      )}
      style={{
        boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), 0 4px 16px rgba(0, 0, 0, 0.4)',
        cursor: showControls ? 'default' : 'none'
      }}
      onMouseMove={resetTimer}
      onClick={resetTimer}
    >
      {!hasSelectedFile ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-zinc-400 text-base md:text-xl text-center px-4 flex flex-col items-center gap-2"
          >
            <div className="flex justify-center">
              {characters1.map((char, index) => (
                <motion.span
                  key={`text1-${index}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 0.7, y: 0 }}
                  transition={{
                    delay: 0.5 + index * 0.03,
                    ease: [0.2, 0.65, 0.3, 0.9]
                  }}
                  className="relative"
                  style={{
                    width: char === " " ? "0.25em" : "auto",
                    display: "inline-block"
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </div>
            <div className="flex justify-center">
              {characters2.map((char, index) => (
                <motion.span
                  key={`text2-${index}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 0.7, y: 0 }}
                  transition={{
                    delay: 0.5 + characters1.length * 0.03 + 0.5 + index * 0.03,
                    ease: [0.2, 0.65, 0.3, 0.9]
                  }}
                  className="relative"
                  style={{
                    width: char === " " ? "0.25em" : "auto",
                    display: "inline-block"
                  }}
                >
                  {char}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <div onClick={onPatternAreaClick} onDoubleClick={onPatternAreaDoubleClick}>
          {visualizationMode === 'circular' && (
            <CircularPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'waveform' && (
            <WaveformPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'rings' && (
            <RingsPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'tunnel' && (
            <TunnelPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'spiral' && (
            <SpiralPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'wobble' && (
            <WobblePattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'bars' && (
            <LightRayPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'halos' && (
            <HalosPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'planetary' && (
            <PlanetaryPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'solarflare' && (
            <SolarFlarePattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'stockgraph' && (
            <StockGraphPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'pacman' && (
            <PacmanPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'hyperspace' && (
            <HyperspacePattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'flux' && (
            <FluxPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'terminal' && (
            <TerminalPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'beatjumper' && (
            <BeatJumperPattern audioData={audioData} dimensions={dimensions} config={config} showControls={showControls} />
          )}
          {visualizationMode === 'github' && (
            <GitHubPattern audioData={audioData} config={config} dimensions={dimensions} />
          )}
          {visualizationMode === 'pong' && (
            <PongPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'clock' && (
            <ClockPattern audioData={audioData} dimensions={dimensions} config={config} />
          )}
          {visualizationMode === 'blackhole' && (
            <BlackholePattern audioData={audioData} dimensions={dimensions} config={config} showControls={showControls} />
          )}
          {visualizationMode === 'wormhole' && (
            <WormholePattern audioData={audioData} dimensions={dimensions} config={config} showControls={showControls} />
          )}
        </div>
      )}

      {audioData.beat && (
        <motion.div
          initial={{ opacity: 0.7, scale: 1 }}
          animate={{ opacity: 0, scale: 1.5 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute inset-0 rounded-2xl"
          style={{
            border: `2px solid ${bgColor}77`,
            zIndex: 10,
            pointerEvents: 'none'
          }}
        />
      )}

      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 pointer-events-none"
          >
            <div className="pointer-events-auto">
              {children}
              <button
                onClick={toggleFullscreen}
                className="absolute top-4 right-4 w-8 h-8 md:w-10 md:h-10 hidden lg:flex items-center justify-center rounded-full bg-zinc-800/80 text-zinc-400 hover:text-orange-500 hover:bg-orange-500/10 transition-colors shadow-inner"
                style={{
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(255, 255, 255, 0.05)'
                }}
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4 md:w-5 md:h-5" />
                ) : (
                  <Expand className="w-4 h-4 md:w-5 md:h-5" />
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isMicMode &&
        <AnimatePresence>
          {showPlayOverlay && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                {audioData.isPlaying ? (
                  <Pause className="w-8 h-8 md:w-10 md:h-10 text-white" />
                ) : (
                  <Play className="w-8 h-8 md:w-10 md:h-10 text-white ml-1" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      }
    </div>
  );
};

export default MainVisualizer;