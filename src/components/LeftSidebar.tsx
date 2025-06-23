import React, { useRef, useState } from 'react';
import { Upload, Lock, ExternalLink, AlertTriangle, Mic, MicOff, Loader2, Play, Download } from 'lucide-react';
import { AudioData, demoSongs } from '../types/audio';
import { showCustomToast } from '../utils/toastUtils';

interface LeftSidebarProps {
  selectedFile: AudioData | null;
  onFileSelect: (file: File) => void;
  onDemoSelect: (demo: AudioData) => void;
  isMicMode: boolean;
  isTurningOffMicMode: boolean;
  onMicToggle: () => void;
  showFileUploadUI: boolean;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({
  selectedFile,
  onFileSelect,
  onDemoSelect,
  isMicMode,
  isTurningOffMicMode,
  onMicToggle,
  showFileUploadUI,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const convertToAudioFile = async (arrayBuffer: ArrayBuffer, filename: string): Promise<File> => {
    const audioContext = new AudioContext();
    
    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Create an offline context for rendering
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    // Create a buffer source
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();
    
    // Render the audio
    const renderedBuffer = await offlineContext.startRendering();
    
    // Convert AudioBuffer to WAV format
    const numberOfChannels = renderedBuffer.numberOfChannels;
    const length = renderedBuffer.length * numberOfChannels * 2;
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);
    
    // Write WAV header
    const writeString = (view: DataView, offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, renderedBuffer.sampleRate, true);
    view.setUint32(28, renderedBuffer.sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);
    
    // Write audio data
    const offset = 44;
    for (let i = 0; i < renderedBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, renderedBuffer.getChannelData(channel)[i]));
        view.setInt16(offset + (i * numberOfChannels + channel) * 2, sample * 0x7FFF, true);
      }
    }
    
    // Create WAV file
    const wavBlob = new Blob([buffer], { type: 'audio/wav' });
    return new File([wavBlob], `${filename}.wav`, { type: 'audio/wav' });
  };

  return (
    <div
      className="w-full lg:w-[300px] lg:h-full px-4 lg:p-4 flex flex-col space-y-4 overflow-y-auto"
    >
      <div className="flex items-center space-x-2 mb-2 flex-shrink-0">
        <img
          src="https://ik.imagekit.io/lapstjup/sonovia/Sonovia_logo.png?updatedAt=1746821544015"
          alt="Sonovia"
          className="w-8 h-8 rounded-lg"
        />
        <h1 className="text-lg font-semibold text-zinc-100">Sonovia</h1>
      </div>

      {!showFileUploadUI ? (
        <div className="p-4 lg:p-6 rounded-2xl border-2 border-dashed border-zinc-700 flex-shrink-0 flex flex-col items-center justify-center text-center space-y-2 lg:space-y-3">
          <div className="p-2 lg:p-3 bg-orange-500/10 rounded-full">
            <Lock className="w-6 h-6 lg:w-8 lg:h-8 text-orange-500" />
          </div>
          <div>
            <p className="text-sm lg:text-base font-medium text-zinc-200 mb-1">
              Unlock file upload
            </p>
            <p className="text-xs lg:text-sm text-zinc-400">
              Play a demo song
            </p>
          </div>
        </div>
      ) : (
        <>
          <div
            className={`p-4 lg:p-6 rounded-2xl border-2 border-dashed transition-colors duration-200 cursor-pointer flex-shrink-0 ${isDraggingFile
              ? 'border-orange-500 bg-orange-500/10'
              : 'border-zinc-700 hover:border-orange-500/50 hover:bg-orange-500/5'
              }`}
            onClick={() => {
              fileInputRef.current?.click();
            }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onFileSelect(e.target.files[0]);
                }
              }}
            />

            <div className="flex flex-col items-center justify-center text-center space-y-2 lg:space-y-3">
              <div className="p-2 lg:p-3 bg-orange-500/10 rounded-full">
                <Upload className="w-6 h-6 lg:w-8 lg:h-8 text-orange-500" />
              </div>
              <div>
                <p className="text-sm lg:text-base font-medium text-zinc-200 mb-1">
                  {isDraggingFile ? 'Drop your audio file here' : 'Click or drag audio file'}
                </p>
                <p className="text-xs lg:text-sm text-zinc-400">Supports MP3, WAV</p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="relative flex items-center w-full">
        <div className="flex-grow border-t border-zinc-700" />
        <span className="mx-2 text-sm text-zinc-400 whitespace-nowrap">
          or choose a demo song
        </span>
        <div className="flex-grow border-t border-zinc-700" />
      </div>

      <div className="space-y-1.5 lg:space-y-2">
        {demoSongs.map(demo => (
          <button
            key={demo.id}
            onClick={() => {
              onDemoSelect(demo);
            }}
            className={`w-full p-2 lg:p-3 flex items-center justify-between rounded-xl border transition-all ${selectedFile?.id === demo.id
              ? 'border-orange-500/50 bg-orange-500/10'
              : 'border-zinc-700 hover:border-orange-500/30 hover:bg-orange-500/5'
              }`}
          >
            <div className="flex items-center space-x-2 lg:space-x-3">
              <div className="w-6 h-6 lg:w-8 lg:h-8 flex items-center justify-center bg-orange-500/10 rounded-lg">
                <Play className="w-3 h-3 lg:w-4 lg:h-4 text-orange-500 ml-0.5" />
              </div>
              <span className="text-xs lg:text-sm font-medium text-zinc-200">{demo.name}</span>
            </div>
            {demo.attribution && (
              <a
                href={demo.attribution.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center space-x-1 text-xs text-zinc-500 hover:text-orange-500 transition-colors px-2 py-1 rounded-lg hover:bg-orange-500/5"
              >
                <ExternalLink className="w-3 h-3 lg:w-4 lg:h-4" />
              </a>
            )}
          </button>
        ))}
      </div>

      <div className="relative flex items-center w-full">
        <div className="flex-grow border-t border-zinc-700" />
        <span className="mx-2 text-sm text-zinc-400 whitespace-nowrap">
          or
        </span>
        <div className="flex-grow border-t border-zinc-700" />
      </div>

      <button
        onClick={onMicToggle}
        disabled={isTurningOffMicMode}
        className={`w-full p-2 lg:p-3 flex items-center justify-between rounded-xl border transition-all ${isMicMode
          ? 'border-orange-500/50 bg-orange-500/10'
          : 'border-zinc-700 hover:border-orange-500/30 hover:bg-orange-500/5'
          } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-zinc-700`}
      >
        <div className="flex items-center space-x-2 lg:space-x-3">
          <div className="w-6 h-6 lg:w-8 lg:h-8 flex items-center justify-center bg-orange-500/10 rounded-lg">
            {isTurningOffMicMode ? (
              <Loader2 className="w-3 h-3 lg:w-4 lg:h-4 text-orange-500 animate-spin" />
            ) : isMicMode ? (
              <MicOff className="w-3 h-3 lg:w-4 lg:h-4 text-orange-500" />
            ) : (
              <Mic className="w-3 h-3 lg:w-4 lg:h-4 text-orange-500" />
            )}
          </div>
          <span className="text-xs lg:text-sm font-medium text-zinc-200">
            {isTurningOffMicMode ? 'Turning off...' : isMicMode ? 'Stop Microphone' : 'Use Microphone'}
          </span>
        </div>
      </button>

      <div className='flex flex-col flex-1 justify-end'>
        <hr className="border-t border-zinc-700" />
        <div className="flex justify-center gap-1.5 !mt-2 items-start text-[10px] lg:text-xs text-zinc-400 w-full">
          <AlertTriangle className="w-2.5 h-2.5 lg:w-3 lg:h-3 mt-0.5 flex-shrink-0 text-orange-500" />
          <p className="leading-tight">Epilepsy caution: flashing visuals</p>
        </div>
      </div>
    </div>
  );
};

export default LeftSidebar;