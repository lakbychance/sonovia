import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AudioAnalysisData, VisualizationMode, VisualizationConfig, AudioData } from '../types/audio';
import LeftSidebar from './LeftSidebar';
import MainVisualizer from './MainVisualizer';
import AudioPlayer from './AudioPlayer';
import MobileBottomSheet from './MobileBottomSheet';
import VisualizerSettings from './VisualizerSettings';
import { isSafariBrowser } from '../utils/userAgent';

interface VisualizerProps {
  audioData: AudioAnalysisData;
  visualizationMode: VisualizationMode;
  config: VisualizationConfig;
  onPlay: () => void;
  onPause: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (time: number) => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  showSettings: boolean;
  onToggleSettings: () => void;
  loadAudio: (url: string) => void;
  startMicrophoneInput: () => void;
  stopMicrophoneInput: () => void;
  onConfigChange: (config: VisualizationConfig) => void;
}

const Visualizer: React.FC<VisualizerProps> = ({
  audioData,
  visualizationMode,
  config,
  onPlay,
  onPause,
  onVolumeChange,
  onSeek,
  onVisualizationModeChange,
  showSettings,
  onToggleSettings,
  loadAudio,
  startMicrophoneInput,
  stopMicrophoneInput,
  onConfigChange,
}) => {
  const [selectedFile, setSelectedFile] = useState<AudioData | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const isSafari = isSafariBrowser(navigator.userAgent);
  const [showFileUploadUI, setShowFileUploadUI] = useState(!isSafari);

  const handleFileSelect = async (file: File) => {
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload an MP3 or WAV audio file.');
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.src = url;
      console.log(`[handleFileSelect] Audio object created. URL: ${url}`);

      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', resolve);
        audio.addEventListener('error', () => {
          alert('Failed to load audio file. Please try a different file.');
          URL.revokeObjectURL(url);
        });
      });

      const audioData: AudioData = {
        id: Math.random().toString(36).substring(2, 9),
        url,
        name: file.name,
        duration: audio.duration,
        attribution: {
          title: 'Uploaded Audio',
          url: '',
        },
        isDemo: false,
      };

      console.log(`[handleFileSelect] Audio data created. URL: ${url}`);
      console.log(`[handleFileSelect] Audio data: ${JSON.stringify(audioData)}`);

      setSelectedFile(audioData);
      loadAudio(url);
      setIsBottomSheetOpen(false);
    } catch (err) {
      console.error('Error processing audio file:', err);
      alert('Failed to process audio file. Please try again.');
    }
  };

  const handleDemoSelect = async (demo: AudioData) => {
    try {
      setSelectedFile(demo);
      loadAudio(demo.url);
      setIsBottomSheetOpen(false);
      if (isSafari && !showFileUploadUI) {
        setShowFileUploadUI(true);
      }
    } catch (err) {
      console.error('Error loading demo song:', err);
      alert('Failed to load demo song. Please try again.');
    }
  };

  const handleMicToggle = () => {
    if (audioData.isMicMode) {
      stopMicrophoneInput();
    } else {
      startMicrophoneInput();
    }
    setIsBottomSheetOpen(false);
  };

  return (
    <>
      <div className="hidden lg:block">
        <LeftSidebar
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          onDemoSelect={handleDemoSelect}
          isMicMode={audioData.isMicMode}
          isTurningOffMicMode={audioData.isTurningOffMicMode}
          onMicToggle={handleMicToggle}
          showFileUploadUI={showFileUploadUI}
        />
      </div>

      <MobileBottomSheet
        selectedFile={selectedFile}
        onFileSelect={handleFileSelect}
        onDemoSelect={handleDemoSelect}
        isOpen={isBottomSheetOpen}
        onOpenChange={setIsBottomSheetOpen}
        isMicMode={audioData.isMicMode}
        onMicToggle={handleMicToggle}
        showFileUploadUI={showFileUploadUI}
      />

      <div className="flex-1 relative lg:ml-2">
        <MainVisualizer
          audioData={audioData}
          onTogglePlayer={() => {
            if (audioData.isPlaying) {
              onPause();
            }
            else {
              onPlay();
            }
          }}
          visualizationMode={visualizationMode}
          config={config}
          hasSelectedFile={!!selectedFile || audioData.isMicMode}
          showSettings={showSettings}
        >
          {(!!selectedFile || audioData.isMicMode) && (
            <AudioPlayer
              audioData={audioData}
              onPlay={onPlay}
              onPause={onPause}
              onVolumeChange={onVolumeChange}
              onSeek={onSeek}
              onVisualizationModeChange={onVisualizationModeChange}
              visualizationMode={visualizationMode}
              showSettings={showSettings}
              onToggleSettings={onToggleSettings}
              trackName={selectedFile?.name || ''}
            />
          )}
          <AnimatePresence>
            {showSettings && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/40 z-40"
                  onClick={onToggleSettings}
                />
                <VisualizerSettings
                  config={config}
                  onConfigChange={onConfigChange}
                  isOpen={showSettings}
                  onClose={onToggleSettings}
                  visualizationMode={visualizationMode}
                />
              </>
            )}
          </AnimatePresence>
        </MainVisualizer>
      </div>
    </>
  );
};

export default Visualizer;