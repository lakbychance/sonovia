import { useState, useEffect } from 'react';
import useSafariAudioAnalyzer from '../hooks/useSafariAudioAnalyzer';
import { VisualizationMode, VisualizationConfig, defaultConfigs } from '../types/audio'; // AudioData, AudioAnalysisData removed as unused in this component scope
import Visualizer from './Visualizer';
import { isSafariApp } from '../utils/userAgent';

function SafariAppShell() {
    const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('circular');
    const [showSettings, setShowSettings] = useState(false);
    const [visualizationConfigs, setVisualizationConfigs] = useState<Record<VisualizationMode, VisualizationConfig>>(() => {
        return Object.entries(defaultConfigs).reduce((acc, [mode, config]) => ({
            ...acc,
            [mode]: { ...config }
        }), {} as Record<VisualizationMode, VisualizationConfig>);
    });

    const {
        audioData, // This is AudioAnalysisData type implicitly
        loadAudio,
        play,
        pause,
        setVolume,
        seek,
        startMicrophoneInput,
        stopMicrophoneInput,
    } = useSafariAudioAnalyzer();

    const handleVisualizationModeChange = (mode: VisualizationMode) => {
        setVisualizationMode(mode);
    };

    const handleConfigChange = (newConfig: VisualizationConfig) => {
        setVisualizationConfigs(prev => ({
            ...prev,
            [visualizationMode]: newConfig
        }));
    };

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && isSafariApp(navigator.userAgent)) {
                window.location.reload();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);

    return (
        <div className="h-[100dvh] bg-[#121212] text-white overflow-hidden flex flex-col">
            <div className="w-full relative mx-auto px-2 md:px-4 py-2 flex-1 flex flex-col">
                <main className="flex-1 flex min-h-0">
                    <Visualizer
                        audioData={audioData} // audioData from the hook is of type AudioAnalysisData
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
                    />
                </main>
            </div>
        </div>
    );
}

export default SafariAppShell; 