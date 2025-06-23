import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioAnalysisData } from '../types/audio';

const useAudioAnalyzer = () => {
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
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
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

  // Initialize audio context and analyzer
  useEffect(() => {
    const initAudio = async () => {
      try {
        audioContextRef.current = new AudioContext();
        analyzerRef.current = audioContextRef.current.createAnalyser();
        analyzerRef.current.fftSize = 2048;
        analyzerRef.current.smoothingTimeConstant = 0.8;

        audioElementRef.current = new Audio();
        audioElementRef.current.crossOrigin = 'anonymous';

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

      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.src = '';
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

  // Update time more frequently
  useEffect(() => {
    const updateTime = () => {
      if (audioElementRef.current && !audioElementRef.current.paused) {
        setAudioData(prev => ({
          ...prev,
          currentTime: audioElementRef.current?.currentTime || 0,
          duration: audioElementRef.current?.duration || 0,
        }));
      }
    };

    timeUpdateIntervalRef.current = window.setInterval(updateTime, 50);

    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
    };
  }, []);

  // Analyze audio data in animation frame
  const analyzeAudio = useCallback(() => {
    if (!analyzerRef.current) return;

    const frequencyData = new Uint8Array(analyzerRef.current.frequencyBinCount);
    const timeData = new Uint8Array(analyzerRef.current.frequencyBinCount);

    analyzerRef.current.getByteFrequencyData(frequencyData);
    analyzerRef.current.getByteTimeDomainData(timeData);

    let sum = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      sum += frequencyData[i];
    }
    const volume = sum / frequencyData.length / 255;

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    const binSize = sampleRate / analyzerRef.current.fftSize;

    const bassRange = [Math.floor(20 / binSize), Math.floor(150 / binSize)];
    const midRange = [Math.floor(150 / binSize), Math.floor(2000 / binSize)];
    const highRange = [Math.floor(2000 / binSize), Math.floor(20000 / binSize)];

    let bassSum = 0;
    let bassCount = 0;
    let midSum = 0;
    let midCount = 0;
    let highSum = 0;
    let highCount = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      if (i >= bassRange[0] && i <= bassRange[1]) {
        bassSum += frequencyData[i];
        bassCount++;
      } else if (i >= midRange[0] && i <= midRange[1]) {
        midSum += frequencyData[i];
        midCount++;
      } else if (i >= highRange[0] && i <= highRange[1]) {
        highSum += frequencyData[i];
        highCount++;
      }
    }

    const bassEnergy = bassCount > 0 ? bassSum / bassCount / 255 : 0;
    const midEnergy = midCount > 0 ? midSum / midCount / 255 : 0;
    const highEnergy = highCount > 0 ? highSum / highCount / 255 : 0;

    const currentTime = audioContextRef.current?.currentTime || 0;
    const timeSinceLastBeat = currentTime - prevBeatTimeRef.current;

    let beat = false;

    if (bassEnergy > beatThresholdRef.current && timeSinceLastBeat > 0.3) {
      beat = true;
      prevBeatTimeRef.current = currentTime;

      if (beatHistoryRef.current.length > 0) {
        const timeSinceLastRecordedBeat = currentTime - beatHistoryRef.current[beatHistoryRef.current.length - 1];
        if (timeSinceLastRecordedBeat > 0.3) {
          beatHistoryRef.current.push(currentTime);
          if (beatHistoryRef.current.length > 20) {
            beatHistoryRef.current.shift();
          }
        }
      } else {
        beatHistoryRef.current.push(currentTime);
      }
    }

    let bpm: number | null = null;
    if (beatHistoryRef.current.length > 3) {
      const intervals = [];
      for (let i = 1; i < beatHistoryRef.current.length; i++) {
        intervals.push(beatHistoryRef.current[i] - beatHistoryRef.current[i - 1]);
      }

      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const calculatedBpm = Math.round(60 / avgInterval);

      if (calculatedBpm >= 50 && calculatedBpm <= 200) {
        bpm = calculatedBpm;
      }
    }

    beatThresholdRef.current = 0.15 + bassEnergy * 0.1;

    beatDetectedRef.current = beat;

    setAudioData(prev => ({
      ...prev,
      frequencyData,
      timeData,
      volume,
      bpm,
      bassEnergy,
      midEnergy,
      highEnergy,
      beat,
      isPlaying: prev.isMicMode ? true : !audioElementRef.current?.paused,
    }));

    frameIdRef.current = requestAnimationFrame(analyzeAudio);
  }, []);

  const startMicrophoneInput = useCallback(async () => {
    if (!audioContextRef.current || !analyzerRef.current) return;

    try {
      // Store current audio state before switching to mic
      if (audioElementRef.current) {
        lastAudioStateRef.current = {
          src: audioElementRef.current.src,
          currentTime: audioElementRef.current.currentTime,
          isPlaying: !audioElementRef.current.paused
        };
        audioElementRef.current.pause();
      }

      // Stop any existing streams
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Disconnect existing audio source
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }

      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Disconnect analyzer from destination to prevent mic output
      analyzerRef.current.disconnect();

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Create and connect microphone source
      const micSource = audioContextRef.current.createMediaStreamSource(stream);
      micSource.connect(analyzerRef.current);
      audioSourceRef.current = micSource;

      // Start analysis
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      frameIdRef.current = requestAnimationFrame(analyzeAudio);

      setAudioData(prev => ({
        ...prev,
        isMicMode: true,
        isPlaying: true
      }));

    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check your permissions.');
    }
  }, [analyzeAudio]);

  const handleMicModeTurningOff = async () => {
          setAudioData(prev=>({...prev, isTurningOffMicMode: true}));
      await new Promise(res=>setTimeout(res, 1000));
         setAudioData(prev=>({...prev, isTurningOffMicMode: false}));
  }

  const stopMicrophoneInput = useCallback(async () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
      await handleMicModeTurningOff();
   
    }

    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    setAudioData(prev => ({
      ...prev,
      isMicMode: false,
      isPlaying: false
    }));

    // Restore previous audio state if it exists
    if (lastAudioStateRef.current && lastAudioStateRef.current.src) {
      await loadAudio(lastAudioStateRef.current.src);
      if (lastAudioStateRef.current.isPlaying) {
        audioElementRef.current?.play();
      }
      if (audioElementRef.current) {
        audioElementRef.current.currentTime = lastAudioStateRef.current.currentTime;
      }
      lastAudioStateRef.current = null;
    }
  }, []);

  const loadAudio = useCallback(async (audioUrl: string) => {
    if (!audioContextRef.current || !analyzerRef.current) return;

    try {
      // Stop microphone if it's active
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
        await handleMicModeTurningOff();
      }

      // Stop any currently playing audio
      if (audioElementRef.current?.src) {
        audioElementRef.current.pause();
      }

      // Disconnect and clean up any existing audio source
      if (audioSourceRef.current) {
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }

      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Disconnect analyzer from any previous connections
      analyzerRef.current.disconnect();

      // Create a new audio element
      const newAudioElement = new Audio();
      newAudioElement.crossOrigin = 'anonymous';
      newAudioElement.src = audioUrl;

      // Wait for the new audio to load
      await new Promise((resolve, reject) => {
        newAudioElement.addEventListener('loadedmetadata', resolve);
        newAudioElement.addEventListener('error', reject);
      });

      // Replace the old audio element
      if (audioElementRef.current) {
        audioElementRef.current.remove();
      }
      audioElementRef.current = newAudioElement;

      beatHistoryRef.current = [];
      prevBeatTimeRef.current = 0;

      // Create and connect the new audio source
      audioSourceRef.current = audioContextRef.current.createMediaElementSource(newAudioElement);
      audioSourceRef.current.connect(analyzerRef.current);
      analyzerRef.current.connect(audioContextRef.current.destination);

      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }

      frameIdRef.current = requestAnimationFrame(analyzeAudio);

      // Automatically play the audio
      await newAudioElement.play();

      setAudioData(prev => ({
        ...prev,
        isMicMode: false
      }));
    } catch (error) {
      console.error('Error loading audio:', error);
    }
  }, [analyzeAudio]);

  const play = useCallback(async () => {
    if (!audioElementRef.current || !audioContextRef.current) return;

    try {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      await audioElementRef.current.play();

      if (!frameIdRef.current) {
        frameIdRef.current = requestAnimationFrame(analyzeAudio);
      }
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [analyzeAudio]);

  const pause = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
  }, []);

  const setVolume = useCallback((level: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = Math.max(0, Math.min(1, level));
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = time;
    }
  }, []);

  return {
    audioData,
    loadAudio,
    play,
    pause,
    setVolume,
    seek,
    audioElement: audioElementRef.current,
    startMicrophoneInput,
    stopMicrophoneInput
  };
};

export default useAudioAnalyzer;