
export interface AudioAnalysisData {
  frequencyData: Uint8Array;
  timeData: Uint8Array;
  volume: number;
  bpm: number | null;
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  beat: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isMicMode: boolean;
  isTurningOffMicMode: boolean;
}

export interface AudioData {
  id: string;
  name: string;
  url: string;
  duration: number;
  attribution?: {
    title: string;
    url: string;
  };
  isDemo: boolean;
}

export interface VisualizationConfig {
  sensitivity: number;
  colorMode: 'dynamic' | 'monochrome' | 'spectrum';
  baseColor: string;
  motionIntensity: number;
}

export type VisualizationMode =
  | 'circular'
  | 'waveform'
  | 'rings'
  | 'tunnel'
  | 'spiral'
  | 'wobble'
  | 'bars'
  | 'halos'
  | 'planetary'
  | 'solarflare'
  | 'stockgraph'
  | 'pacman'
  | 'hyperspace'
  | 'flux'
  | 'terminal'
  | 'beatjumper'
  | 'github'
  | 'pong'
  | 'clock'
  | 'blackhole'
  | 'wormhole'
  | 'organic'
  | 'origami';

export const defaultConfigs: Record<VisualizationMode, VisualizationConfig> = {
  circular: {
    sensitivity: 1.2,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 2.0
  },
  waveform: {
    sensitivity: 1.2,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.0
  },
  rings: {
    sensitivity: 3.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.1
  },
  tunnel: {
    sensitivity: 1.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.0
  },
  spiral: {
    sensitivity: 3.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.4
  },
  wobble: {
    sensitivity: 3.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 2.0
  },
  bars: {
    sensitivity: 1.5,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.3
  },
  halos: {
    sensitivity: 3.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 3.0
  },
  planetary: {
    sensitivity: 2.5,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 3.0
  },
  solarflare: {
    sensitivity: 3.0,
    colorMode: 'dynamic',
    baseColor: '#ff6b3b',
    motionIntensity: 2.0
  },
  stockgraph: {
    sensitivity: 2.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.5
  },
  pacman: {
    sensitivity: 1.5,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.5
  },
  hyperspace: {
    sensitivity: 2.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.0
  },
  flux: {
    sensitivity: 2.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.0
  },
  terminal: {
    sensitivity: 3.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 2.0
  },
  beatjumper: {
    sensitivity: 2.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 2.0
  },
  github: {
    sensitivity: 1.0,
    colorMode: 'monochrome',
    baseColor: '#9ae9a8',
    motionIntensity: 3.0
  },
  pong: {
    sensitivity: 2.0,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 2.5
  },
  clock: {
    sensitivity: 1.2,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 2.5
  },
  blackhole: {
    sensitivity: 1.5,
    colorMode: 'dynamic',
    baseColor: '#ff3b30',
    motionIntensity: 1.8
  },
  wormhole: {
    sensitivity: 1.5,
    colorMode: 'dynamic',
    baseColor: '#7dd3fc',
    motionIntensity: 1.5
  },
  organic: {
    sensitivity: 0.8,
    colorMode: 'dynamic',
    baseColor: '#7dd3fc',
    motionIntensity: 1.8
  },
  origami: {
    sensitivity: 0.8,
    colorMode: 'dynamic',
    baseColor: '#8b5cf6',
    motionIntensity: 1.8
  }
};

export const demoSongs: AudioData[] = [
  {
    id: 'demo-1',
    name: 'Still here',
    url: 'https://cdn1.suno.ai/6a30f474-5acc-4a76-b087-228c867ebb34.webm',
    duration: 0,
    isDemo: true,
    attribution: {
      title: 'Still here',
      url: 'https://suno.com/s/j0UpBP8x82T43Ioo'
    }
  },
  {
    id: 'demo-2',
    name: 'Insomnia',
    url: 'https://cdn1.suno.ai/f054adeb-7e52-46e5-a31e-e8d25c49012a.webm',
    duration: 0,
    isDemo: true,
    attribution: {
      title: 'Insomnia',
      url: 'https://suno.com/song/f054adeb-7e52-46e5-a31e-e8d25c49012a'
    }
  },
  {
    id: 'demo-3',
    name: 'Dance in the light',
    url: 'https://cdn1.suno.ai/d60542e0-879c-4103-a57b-47cc686005e5.webm',
    duration: 0,
    isDemo: true,
    attribution: {
      title: 'Dance in the light',
      url: 'https://suno.com/song/d60542e0-879c-4103-a57b-47cc686005e5'
    }
  },
  {
    id: 'demo-4',
    name: 'Highway harmony',
    url: 'https://cdn1.suno.ai/1406ec15-69a5-485f-a114-01c053700619.webm',
    duration: 0,
    isDemo: true,
    attribution: {
      title: 'Highway harmony',
      url: 'https://suno.com/song/1406ec15-69a5-485f-a114-01c053700619'
    }
  },
  {
    id: 'demo-5',
    name: 'Orbit',
    url: 'https://cdn1.suno.ai/1f52e0b1-1a76-4088-beef-316f49d8e325.webm',
    duration: 0,
    isDemo: true,
    attribution: {
      title: 'Orbit',
      url: 'https://suno.com/song/1f52e0b1-1a76-4088-beef-316f49d8e325'
    }
  }
];