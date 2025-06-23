import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioAnalysisData } from '../types/audio';

const useSafariAudioAnalyzer = () => {
  const [audioData, setAudioData] = useState<AudioAnalysisData>({
    frequencyData: new Uint8Array(),
    timeData: new Uint8Array(),
    volume: 0,
    bpm: null,
    bassEnergy: 0,
    midEnergy: 0,
    highEnergy: 0,
    beat: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    isMicMode: false,
    isTurningOffMicMode: false
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const frameIdRef = useRef<number>(0);
  const prevBeatTimeRef = useRef<number>(0);
  const beatThresholdRef = useRef<number>(0.15);
  const beatHistoryRef = useRef<number[]>([]);
  const beatDetectedRef = useRef<boolean>(false);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const lastAudioStateRef = useRef<{
    src: string;
    currentTime: number;
    isPlaying: boolean;
  } | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  const decodedAudioBufferRef = useRef<AudioBuffer | null>(null);
  const activeAudioBufferSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);

  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new AudioContext();
        analyzerRef.current = audioContextRef.current.createAnalyser();
        analyzerRef.current.fftSize = 2048;
        analyzerRef.current.smoothingTimeConstant = 0.8;

        if (audioContextRef.current) {
          gainNodeRef.current = audioContextRef.current.createGain();
          if (gainNodeRef.current && analyzerRef.current) {
            gainNodeRef.current.connect(analyzerRef.current);
            analyzerRef.current.connect(audioContextRef.current.destination);
          }
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    };

    initAudio();

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
      if (activeAudioBufferSourceNodeRef.current) {
        try {
          activeAudioBufferSourceNodeRef.current.onended = null;
          activeAudioBufferSourceNodeRef.current.stop();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e: unknown) { /* ignore error on cleanup */ }
        activeAudioBufferSourceNodeRef.current.disconnect();
        activeAudioBufferSourceNodeRef.current = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    const updateTime = () => {
      if (audioData.isMicMode) {
        if (!decodedAudioBufferRef.current && !currentAudioUrlRef.current) {
          setAudioData(prev => ({ ...prev, currentTime: 0, duration: 0 }));
        }
        return;
      }

      if (activeAudioBufferSourceNodeRef.current && audioContextRef.current && decodedAudioBufferRef.current) {
        const elapsedTimeInCurrentSegment = audioContextRef.current.currentTime - playbackStartTimeRef.current;
        let newCurrentTime = startOffsetRef.current + elapsedTimeInCurrentSegment;
        if (newCurrentTime < 0) newCurrentTime = 0;
        if (newCurrentTime > decodedAudioBufferRef.current.duration) {
          newCurrentTime = decodedAudioBufferRef.current.duration;
        }
        setAudioData(prev => ({
          ...prev,
          currentTime: newCurrentTime,
          duration: decodedAudioBufferRef.current?.duration || 0,
        }));
      } else if (!activeAudioBufferSourceNodeRef.current && decodedAudioBufferRef.current && !audioData.isPlaying) {
        setAudioData(prev => ({
          ...prev,
          currentTime: startOffsetRef.current,
          duration: decodedAudioBufferRef.current?.duration || 0,
        }));
      }
    };

    timeUpdateIntervalRef.current = window.setInterval(updateTime, 50);

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, [audioData.isMicMode, audioData.isPlaying]);

  const analyzeAudio = useCallback(() => {
    if (!analyzerRef.current) return;
    const frequencyData = new Uint8Array(analyzerRef.current.frequencyBinCount);
    const timeData = new Uint8Array(analyzerRef.current.frequencyBinCount);
    analyzerRef.current.getByteFrequencyData(frequencyData);
    analyzerRef.current.getByteTimeDomainData(timeData);

    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) { sum += frequencyData[i]; }
    const volume = sum / frequencyData.length / 255;

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const binSize = sampleRate / analyzerRef.current.fftSize;
    const bassRange = [Math.floor(20 / binSize), Math.floor(150 / binSize)];
    const midRange = [Math.floor(150 / binSize), Math.floor(2000 / binSize)];
    const highRange = [Math.floor(2000 / binSize), Math.floor(20000 / binSize)];

    let bassSum = 0, bassCount = 0, midSum = 0, midCount = 0, highSum = 0, highCount = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      if (i >= bassRange[0] && i <= bassRange[1]) { bassSum += frequencyData[i]; bassCount++; }
      else if (i >= midRange[0] && i <= midRange[1]) { midSum += frequencyData[i]; midCount++; }
      else if (i >= highRange[0] && i <= highRange[1]) { highSum += frequencyData[i]; highCount++; }
    }

    const bassEnergy = bassCount > 0 ? bassSum / bassCount / 255 : 0;
    const midEnergy = midCount > 0 ? midSum / midCount / 255 : 0;
    const highEnergy = highCount > 0 ? highSum / highCount / 255 : 0;

    const currentContextTime = audioContextRef.current?.currentTime || 0;
    const timeSinceLastBeat = currentContextTime - prevBeatTimeRef.current;
    let beat = false;

    if (bassEnergy > beatThresholdRef.current && timeSinceLastBeat > 0.3) {
      beat = true;
      prevBeatTimeRef.current = currentContextTime;
      if (beatHistoryRef.current.length > 0) {
        const timeSinceLastRecordedBeat = currentContextTime - beatHistoryRef.current[beatHistoryRef.current.length - 1];
        if (timeSinceLastRecordedBeat > 0.3) {
          beatHistoryRef.current.push(currentContextTime);
          if (beatHistoryRef.current.length > 20) beatHistoryRef.current.shift();
        }
      } else {
        beatHistoryRef.current.push(currentContextTime);
      }
    }

    let bpm: number | null = null;
    if (beatHistoryRef.current.length > 3) {
      const intervals = [];
      for (let i = 1; i < beatHistoryRef.current.length; i++) {
        intervals.push(beatHistoryRef.current[i] - beatHistoryRef.current[i - 1]);
      }
      const avgInterval = intervals.reduce((s, val) => s + val, 0) / intervals.length;
      if (avgInterval > 0) {
        const calculatedBpm = Math.round(60 / avgInterval);
        if (calculatedBpm >= 50 && calculatedBpm <= 200) bpm = calculatedBpm;
      }
    }

    beatThresholdRef.current = 0.15 + bassEnergy * 0.1;
    beatDetectedRef.current = beat;

    setAudioData(prev => ({
      ...prev,
      frequencyData, timeData, volume, bpm, bassEnergy, midEnergy, highEnergy, beat,
      isPlaying: prev.isMicMode ? true : !!activeAudioBufferSourceNodeRef.current,
    }));
    frameIdRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  const handleMicModeTurningOff = async () => {
    setAudioData(prev => ({ ...prev, isTurningOffMicMode: true }));
    await new Promise(res => setTimeout(res, 300));
    setAudioData(prev => ({ ...prev, isTurningOffMicMode: false }));
  };

  const play = useCallback(async () => {
    if (audioData.isMicMode || !decodedAudioBufferRef.current || !audioContextRef.current || !analyzerRef.current || !gainNodeRef.current) return;
    try {
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      if (activeAudioBufferSourceNodeRef.current) {
        activeAudioBufferSourceNodeRef.current.onended = null;
        try { activeAudioBufferSourceNodeRef.current.stop(); } catch (e: unknown) { console.warn("Attempted to stop already playing/stopped node in play():", e); }
        activeAudioBufferSourceNodeRef.current.disconnect();
        activeAudioBufferSourceNodeRef.current = null;
      }

      const sourceNode = audioContextRef.current.createBufferSource();
      sourceNode.buffer = decodedAudioBufferRef.current;
      sourceNode.connect(gainNodeRef.current);
      activeAudioBufferSourceNodeRef.current = sourceNode;

      playbackStartTimeRef.current = audioContextRef.current.currentTime;

      sourceNode.start(0, startOffsetRef.current);

      sourceNode.onended = () => {
        if (activeAudioBufferSourceNodeRef.current === sourceNode) {
          activeAudioBufferSourceNodeRef.current = null;
          setAudioData(prev => ({ ...prev, isPlaying: false }));
          if (startOffsetRef.current + (audioContextRef.current!.currentTime - playbackStartTimeRef.current) >= decodedAudioBufferRef.current!.duration - 0.1) {
            startOffsetRef.current = 0;
          }
        }
        if (frameIdRef.current) { cancelAnimationFrame(frameIdRef.current); frameIdRef.current = 0; }
      };
      setAudioData(prev => ({ ...prev, isPlaying: true }));
      if (!frameIdRef.current) frameIdRef.current = requestAnimationFrame(analyzeAudio);
    } catch (error) {
      console.error('Error playing audio:', error);
      setAudioData(prev => ({ ...prev, isPlaying: false }));
      if (activeAudioBufferSourceNodeRef.current) {
        activeAudioBufferSourceNodeRef.current.disconnect();
        activeAudioBufferSourceNodeRef.current = null;
      }
    }
  }, [audioData.isMicMode, analyzeAudio]);

  const loadAudio = useCallback(async (audioUrl: string) => {
    if (!audioContextRef.current || !analyzerRef.current || !gainNodeRef.current) return;
    currentAudioUrlRef.current = audioUrl;

    try {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
        if (audioSourceRef.current && audioSourceRef.current instanceof MediaStreamAudioSourceNode) {

          try { audioSourceRef.current.disconnect(analyzerRef.current); } catch { /* ignore */ }
          audioSourceRef.current = null;
        }
        await handleMicModeTurningOff();
      }
      if (activeAudioBufferSourceNodeRef.current) {
        activeAudioBufferSourceNodeRef.current.onended = null;

        try { activeAudioBufferSourceNodeRef.current.stop(); } catch { /* ignore */ }
        activeAudioBufferSourceNodeRef.current.disconnect();
        activeAudioBufferSourceNodeRef.current = null;
      }
      if (audioSourceRef.current && audioSourceRef.current !== activeAudioBufferSourceNodeRef.current && !(audioSourceRef.current instanceof MediaStreamAudioSourceNode)) {

        try { audioSourceRef.current.disconnect(); } catch { /* ignore */ }
        audioSourceRef.current = null;
      }

      // Ensure the audio path for file playback is correctly wired, regardless of previous mic state.
      if (audioContextRef.current && gainNodeRef.current && analyzerRef.current) {
        // Defensive disconnects before reconnecting to ensure a clean state.
        // Disconnect gain from analyzer if it was connected.
        try { gainNodeRef.current.disconnect(analyzerRef.current); } catch { /* ignore potential error if not connected */ }
        gainNodeRef.current.connect(analyzerRef.current); // GAIN -> ANALYZER

        // Disconnect analyzer from destination if it was connected.
        try { analyzerRef.current.disconnect(audioContextRef.current.destination); } catch { /* ignore potential error if not connected */ }
        analyzerRef.current.connect(audioContextRef.current.destination); // ANALYZER -> DESTINATION
      }

      decodedAudioBufferRef.current = null;
      console.log(`[loadAudio] Audio context state: ${audioContextRef.current?.state}`);
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      console.log(`[loadAudio] Fetching audio from ${audioUrl}`);
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

      decodedAudioBufferRef.current = audioBuffer;
      startOffsetRef.current = 0;
      beatHistoryRef.current = [];
      prevBeatTimeRef.current = 0;
      if (frameIdRef.current) { cancelAnimationFrame(frameIdRef.current); frameIdRef.current = 0; }

      setAudioData(prev => ({
        ...prev, isMicMode: false, isPlaying: false, duration: audioBuffer.duration, currentTime: 0,
        frequencyData: new Uint8Array(analyzerRef.current?.frequencyBinCount || 0),
        timeData: new Uint8Array(analyzerRef.current?.frequencyBinCount || 0),
        volume: gainNodeRef.current?.gain.value ?? prev.volume,
        bpm: null, bassEnergy: 0, midEnergy: 0, highEnergy: 0, beat: false,
      }));

      await play();

    } catch (error) {
      console.error(`Error loading audio (${audioUrl}):`, error);
      currentAudioUrlRef.current = null;
      setAudioData(prev => ({
        ...prev, isMicMode: false, isPlaying: false, duration: 0, currentTime: 0,
        frequencyData: new Uint8Array(), timeData: new Uint8Array(),
      }));
    }
  }, [play, handleMicModeTurningOff]);

  const pause = useCallback(() => {
    if (audioData.isMicMode) return;
    if (activeAudioBufferSourceNodeRef.current && audioContextRef.current && decodedAudioBufferRef.current) {
      try {
        const elapsedTimeInSegment = audioContextRef.current.currentTime - playbackStartTimeRef.current;
        startOffsetRef.current = Math.max(0, Math.min(startOffsetRef.current + elapsedTimeInSegment, decodedAudioBufferRef.current.duration));

        activeAudioBufferSourceNodeRef.current.onended = null;
        activeAudioBufferSourceNodeRef.current.stop();
      } catch (e: unknown) {
        console.warn("Error stopping AudioBufferSourceNode during pause:", e);
      } finally {
        activeAudioBufferSourceNodeRef.current = null;
      }
    }
    if (frameIdRef.current) { cancelAnimationFrame(frameIdRef.current); frameIdRef.current = 0; }
    setAudioData(prev => ({ ...prev, isPlaying: false }));
  }, [audioData.isMicMode]);

  const setVolume = useCallback((level: number) => {
    const newVolume = Math.max(0, Math.min(1, level));
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(newVolume, audioContextRef.current?.currentTime || 0);
    }
  }, []);

  const seek = useCallback(async (time: number) => {
    if (audioData.isMicMode) return;
    if (decodedAudioBufferRef.current && audioContextRef.current) {
      const newTime = Math.max(0, Math.min(time, decodedAudioBufferRef.current.duration));
      const wasPlaying = !!activeAudioBufferSourceNodeRef.current;

      if (activeAudioBufferSourceNodeRef.current) {
        activeAudioBufferSourceNodeRef.current.onended = null;
        try { activeAudioBufferSourceNodeRef.current.stop(); } catch (_e: unknown) { console.warn("Error stopping node on seek:", _e); }
        activeAudioBufferSourceNodeRef.current.disconnect();
        activeAudioBufferSourceNodeRef.current = null;
      }

      startOffsetRef.current = newTime;

      if (wasPlaying) {
        await play();
      } else {
        setAudioData(prev => ({ ...prev, currentTime: newTime, isPlaying: false }));
      }
    }
  }, [audioData.isMicMode, play]);

  const startMicrophoneInput = useCallback(async () => {
    if (!audioContextRef.current || !analyzerRef.current || !gainNodeRef.current) return;
    try {
      const wasFilePlaying = !!activeAudioBufferSourceNodeRef.current;
      const currentFileTime = startOffsetRef.current;

      if (activeAudioBufferSourceNodeRef.current) {
        activeAudioBufferSourceNodeRef.current.onended = null;
        try { activeAudioBufferSourceNodeRef.current.stop(); } catch (e: unknown) {
          console.warn("Error stopping active audio buffer source while starting mic:", e);
        }
        activeAudioBufferSourceNodeRef.current.disconnect();
        activeAudioBufferSourceNodeRef.current = null;
      }

      if (currentAudioUrlRef.current) {
        lastAudioStateRef.current = {
          src: currentAudioUrlRef.current,
          currentTime: currentFileTime,
          isPlaying: wasFilePlaying,
        };
      }

      if (micStreamRef.current) micStreamRef.current.getTracks().forEach(track => track.stop());
      if (audioSourceRef.current) { audioSourceRef.current.disconnect(); audioSourceRef.current = null; }

      if (gainNodeRef.current && analyzerRef.current && audioContextRef.current) {

        try { gainNodeRef.current.disconnect(analyzerRef.current); } catch { /*ignore*/ }

        try { analyzerRef.current.disconnect(audioContextRef.current.destination); } catch { /*ignore*/ }
      }

      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const micSource = audioContextRef.current.createMediaStreamSource(stream);
      micSource.connect(analyzerRef.current);
      audioSourceRef.current = micSource;

      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = requestAnimationFrame(analyzeAudio);
      setAudioData(prev => ({ ...prev, isMicMode: true, isPlaying: true, currentTime: 0 }));
    } catch (error) {
      console.error('Error accessing microphone:', error);
      if (lastAudioStateRef.current && lastAudioStateRef.current.src) {
        const stateToRestore = { ...lastAudioStateRef.current };
        lastAudioStateRef.current = null;
        await loadAudio(stateToRestore.src);
        if (decodedAudioBufferRef.current) {
          startOffsetRef.current = stateToRestore.currentTime;
          if (stateToRestore.isPlaying) await play();
          else setAudioData(prev => ({ ...prev, currentTime: stateToRestore.currentTime, isPlaying: false }));
        }
      } else {
        setAudioData(prev => ({ ...prev, isMicMode: false, isPlaying: false }));
      }
      alert('Could not access microphone. Please check permissions and ensure no other app is using it.');
    }
  }, [analyzeAudio, loadAudio, play]);

  const stopMicrophoneInput = useCallback(async () => {
    let shouldRestoreAudio = false;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
      shouldRestoreAudio = true;
    }
    if (audioSourceRef.current && audioSourceRef.current instanceof MediaStreamAudioSourceNode) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (analyzerRef.current && gainNodeRef.current && audioContextRef.current) {

      try { gainNodeRef.current.disconnect(analyzerRef.current); } catch { /* defensive disconnect */ }

      try { analyzerRef.current.disconnect(audioContextRef.current.destination); } catch { /* defensive disconnect */ }
      gainNodeRef.current.connect(analyzerRef.current);
      analyzerRef.current.connect(audioContextRef.current.destination);
    }

    if (shouldRestoreAudio) await handleMicModeTurningOff();

    setAudioData(prev => ({ ...prev, isMicMode: false, isPlaying: false }));

    if (lastAudioStateRef.current && lastAudioStateRef.current.src) {
      const lastState = { ...lastAudioStateRef.current };
      lastAudioStateRef.current = null;
      await loadAudio(lastState.src);
    } else {
      if (!decodedAudioBufferRef.current && !currentAudioUrlRef.current && frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = 0;
      }
      setAudioData(prev => ({ ...prev, isPlaying: false }));
    }
  }, [loadAudio]);

  return {
    audioData,
    loadAudio,
    play,
    pause,
    setVolume,
    seek,
    startMicrophoneInput,
    stopMicrophoneInput
  };
};

export default useSafariAudioAnalyzer;