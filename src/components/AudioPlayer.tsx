import React, { useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Settings, ChevronDown } from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { AudioAnalysisData, VisualizationMode } from '../types/audio';
import { isSafariBrowser } from '../utils/userAgent';

interface AudioPlayerProps {
  audioData: AudioAnalysisData;
  onPlay: () => void;
  onPause: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (time: number) => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  visualizationMode: VisualizationMode;
  showSettings: boolean;
  onToggleSettings: () => void;
  trackName: string;
}

const visualizationOptions: { value: VisualizationMode; label: string }[] = [
  { value: 'circular', label: 'Circular' },
  { value: 'waveform', label: 'Waveform' },
  { value: 'rings', label: 'Rings' },
  { value: 'tunnel', label: 'Tunnel' },
  { value: 'spiral', label: 'Spiral' },
  { value: 'wobble', label: 'Wobble' },
  { value: 'bars', label: 'Bars' },
  { value: 'halos', label: 'Halos' },
  { value: 'planetary', label: 'Planetary' },
  { value: 'solarflare', label: 'Solar Flare' },
  { value: 'stockgraph', label: 'Stock Graph' },
  ...(isSafariBrowser(navigator.userAgent) ? [] : [{ value: 'pacman' as VisualizationMode, label: 'Pacman' }]),
  { value: 'hyperspace', label: 'Hyperspace' },
  { value: 'flux', label: 'Flux' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'beatjumper', label: 'Beat Jumper' },
  { value: 'github', label: 'GitHub Graph' }
]

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioData,
  onPlay,
  onPause,
  onVolumeChange,
  onSeek,
  onVisualizationModeChange,
  visualizationMode,
  showSettings,
  onToggleSettings,
  trackName,
}) => {
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    onVolumeChange(newVolume);

    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      onVolumeChange(volume || 0.5);
    } else {
      setIsMuted(true);
      onVolumeChange(0);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
      <div className="space-y-2">
        {/* Progress Bar - Only show when not in mic mode */}
        {!audioData.isMicMode && (
          <div className="flex items-center space-x-2">
            <span className="text-[10px] md:text-xs text-zinc-400 w-8 text-right">
              {formatTime(audioData.currentTime)}
            </span>
            <div className="relative flex-1 h-2 bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
              <input
                type="range"
                min="0"
                max={audioData.duration || 100}
                value={audioData.currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                className="absolute w-full h-full opacity-0 cursor-pointer"
              />
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full"
                style={{
                  width: `${(audioData.currentTime / audioData.duration) * 100}%`,
                  transition: isDragging ? 'none' : 'width 0.1s linear',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                }}
              />
            </div>
            <span className="text-[10px] md:text-xs text-zinc-400 w-8 md:w-12">
              {formatTime(audioData.duration)}
            </span>
          </div>
        )}

        {/* Mobile Controls */}
        <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0">
          {/* Track Info & Play Button */}
          <div className="flex items-center justify-between md:justify-start md:flex-1">
            <div className="flex items-center space-x-3">
              {!audioData.isMicMode && (
                <button
                  onClick={audioData.isPlaying ? onPause : onPlay}
                  className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 rounded-full text-white shadow-lg hover:from-orange-600 hover:to-orange-700 transition-all active:scale-95"
                  style={{
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                  }}
                >
                  {audioData.isPlaying ? (
                    <Pause className="w-5 h-5 md:w-6 md:h-6" />
                  ) : (
                    <Play className="w-5 h-5 md:w-6 md:h-6 ml-0.5" />
                  )}
                </button>
              )}

              <div className="flex items-center space-x-3">
                <p className="text-zinc-200 text-xs md:text-sm font-medium truncate max-w-[200px] md:max-w-[200px]">
                  {audioData.isMicMode ? 'Microphone Input' : trackName}
                </p>
              </div>
            </div>

            {/* Mobile Volume Controls */}
            {!audioData.isMicMode &&
              <div className="flex items-center space-x-2 md:hidden">
                <button
                  onClick={toggleMute}
                  className="text-zinc-400 hover:text-orange-500 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <div className="relative w-16 h-2 bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="absolute w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-150"
                    style={{
                      width: `${(isMuted ? 0 : volume) * 100}%`,
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                </div>
              </div>
            }
          </div>

          {/* Desktop Controls */}
          <div className="flex items-center justify-between space-x-2 md:space-x-4">
            <Select.Root value={visualizationMode} onValueChange={onVisualizationModeChange}>
              <Select.Trigger
                className="bg-zinc-800/80 text-zinc-200 text-xs md:text-sm rounded-xl px-3 py-1.5 md:px-4 md:py-2 border border-zinc-700/50 focus:outline-none focus:ring-1 focus:ring-orange-500 shadow-inner flex items-center justify-between gap-2 min-w-[140px] hover:bg-zinc-700/50 transition-colors backdrop-blur-sm"
                style={{
                  boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(255, 255, 255, 0.05)'
                }}
              >
                <Select.Value />
                <Select.Icon>
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                </Select.Icon>
              </Select.Trigger>


              <Select.Content
                className="bg-zinc-800/95 backdrop-blur-sm rounded-xl border border-zinc-700/50 shadow-xl overflow-hidden z-50"
                position="popper"
                sideOffset={5}
                align="center"
                style={{
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), 0 1px 1px rgba(255, 255, 255, 0.05)'
                }}
              >
                <Select.Viewport className="p-1">
                  {visualizationOptions.map((option) => (
                    <Select.Item
                      key={option.value}
                      value={option.value}
                      className="text-zinc-200 text-xs md:text-sm px-3 py-1.5 rounded-lg outline-none cursor-pointer data-[highlighted]:bg-orange-500/10 data-[state=checked]:text-orange-500"
                    >
                      <Select.ItemText>{option.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>

            </Select.Root>

            <div className="flex space-x-2">
              <button
                onClick={onToggleSettings}
                className={`w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full transition-all ${showSettings
                  ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-orange-500/10 hover:text-orange-500'
                  }`}
                style={{
                  boxShadow: showSettings
                    ? '0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                    : 'inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(255, 255, 255, 0.05)'
                }}
              >
                <Settings className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            {/* Desktop Volume Controls */}
            {!audioData.isMicMode &&
              <div className="hidden md:flex items-center space-x-2 md:space-x-3">
                <button
                  onClick={toggleMute}
                  className="text-zinc-400 hover:text-orange-500 transition-colors"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 md:w-5 md:h-5" /> : <Volume2 className="w-4 h-4 md:w-5 md:h-5" />}
                </button>

                <div className="relative w-16 md:w-24 h-2 bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="absolute w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-150"
                    style={{
                      width: `${(isMuted ? 0 : volume) * 100}%`,
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                    }}
                  />
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;