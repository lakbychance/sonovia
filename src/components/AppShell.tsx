import { useState } from 'react';
import useAudioAnalyzer from '../hooks/useAudioAnalyzer'; // Standard hook for non-Safari
import { VisualizationMode, VisualizationConfig, defaultConfigs } from '../types/audio';
import Visualizer from './Visualizer';

function AppShell() {
    const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('circular');
    const [showSettings, setShowSettings] = useState(false);
    const [visualizationConfigs, setVisualizationConfigs] = useState<Record<VisualizationMode, VisualizationConfig>>(() => {
        return Object.entries(defaultConfigs).reduce((acc, [mode, config]) => ({
            ...acc,
            [mode]: { ...config }
        }), {} as Record<VisualizationMode, VisualizationConfig>);
    });

    // Assuming the old useAudioAnalyzer has a similar return signature.
    // If not, this part might need adjustment based on your old hook's actual return values.
    const {
        audioData,
        loadAudio,
        play,
        pause,
        setVolume,
        seek,
        startMicrophoneInput,
        stopMicrophoneInput,
        // Add any other specific functions/data your old hook returned and Visualizer expects
    } = useAudioAnalyzer();

    const handleVisualizationModeChange = (mode: VisualizationMode) => {
        setVisualizationMode(mode);
    };

    const handleConfigChange = (newConfig: VisualizationConfig) => {
        setVisualizationConfigs(prev => ({
            ...prev,
            [visualizationMode]: newConfig
        }));
    };

    return (
        <div className="h-[100dvh] bg-[#121212] text-white overflow-hidden flex flex-col">
            <div className="w-full relative mx-auto px-2 md:px-4 py-2 flex-1 flex flex-col">
                <main className="flex-1 flex min-h-0">
                    <Visualizer
                        audioData={audioData} // Ensure this matches the type from your old useAudioAnalyzer
                        visualizationMode={visualizationMode}
                        config={visualizationConfigs[visualizationMode]}
                        onPlay={play}
                        onPause={pause}
                        onVolumeChange={setVolume}
                        onSeek={seek}
                        onVisualizationModeChange={handleVisualizationModeChange}
                        showSettings={showSettings}
                        onToggleSettings={() => setShowSettings(!showSettings)}
                        loadAudio={loadAudio}
                        startMicrophoneInput={startMicrophoneInput}
                        stopMicrophoneInput={stopMicrophoneInput}
                        onConfigChange={handleConfigChange}
                    // Ensure all props expected by Visualizer that come from the hook are provided
                    />
                </main>
            </div>
        </div>
    );
}

export default AppShell; 