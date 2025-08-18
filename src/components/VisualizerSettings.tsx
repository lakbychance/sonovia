import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, X } from 'lucide-react';
import { ColorPicker, useColor } from 'react-color-palette';
import type { IColor } from 'react-color-palette';
import "react-color-palette/dist/css/rcp.css";
import { VisualizationConfig, VisualizationMode, defaultConfigs } from '../types/audio';

interface VisualizerSettingsProps {
  config: VisualizationConfig;
  onConfigChange: (config: VisualizationConfig) => void;
  isOpen: boolean;
  onClose: () => void;
  visualizationMode: VisualizationMode;
}

const VisualizerSettings: React.FC<VisualizerSettingsProps> = ({
  config,
  onConfigChange,
  isOpen,
  onClose,
  visualizationMode,
}) => {
  const [color, setColor] = useColor(config.baseColor);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleChange = (
    field: keyof VisualizationConfig,
    value: string | number | boolean
  ) => {
    onConfigChange({
      ...config,
      [field]: value,
    });
  };

  const handleColorChange = (newColor: IColor) => {
    setColor(newColor);
    handleChange('baseColor', newColor.hex);
  };

  const disableColorModeList = ['flux', 'blackhole', 'wormhole', 'organic', 'origami'];

  return (
    <motion.div
      role="dialog"
      aria-label="Visualization Settings"
      aria-modal="true"
      className="fixed right-1 top-1 bottom-1 z-[9999] w-64 md:w-80 bg-gradient-to-b from-zinc-900/90 to-zinc-800/90 backdrop-blur-lg shadow-xl border rounded-lg border-zinc-700/50 overflow-y-auto"
      style={{
        boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05), -4px 0 16px rgba(0, 0, 0, 0.4)'
      }}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ ease: "easeOut", duration: 0.25 }}
    >
      <div className="p-4 h-full flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-orange-500/10">
              <Settings className="w-5 h-5 text-orange-500" aria-hidden="true" />
            </div>
            <h2 id="settings-title" className="text-lg font-semibold text-zinc-100">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-orange-500/10 transition-colors text-zinc-400 hover:text-orange-500 active:scale-95"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col space-y-6 flex-1">
          {/* Sensitivity */}
          <div className="space-y-2">
            <label htmlFor="sensitivity" className="text-sm text-zinc-300 flex justify-between">
              <span>Sensitivity</span>
              <span className="text-orange-500 font-medium">{config.sensitivity.toFixed(1)}</span>
            </label>
            <div className="relative h-2 bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
              <input
                id="sensitivity"
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={config.sensitivity}
                onChange={(e) => handleChange('sensitivity', parseFloat(e.target.value))}
                className="absolute w-full h-full opacity-0 cursor-pointer"
                aria-valuemin={0.5}
                aria-valuemax={3}
                aria-valuenow={config.sensitivity}
              />
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-150"
                style={{
                  width: `${((config.sensitivity - 0.5) / 2.5) * 100}%`,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Subtle</span>
              <span>Intense</span>
            </div>
          </div>

          {/* Motion Intensity */}
          <div className="space-y-2">
            <label htmlFor="motion" className="text-sm text-zinc-300 flex justify-between">
              <span>Motion Intensity</span>
              <span className="text-orange-500 font-medium">{config.motionIntensity.toFixed(1)}</span>
            </label>
            <div className="relative h-2 bg-zinc-800/80 rounded-full overflow-hidden shadow-inner">
              <input
                id="motion"
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={config.motionIntensity}
                onChange={(e) => handleChange('motionIntensity', parseFloat(e.target.value))}
                className="absolute w-full h-full opacity-0 cursor-pointer"
                aria-valuemin={0.5}
                aria-valuemax={3}
                aria-valuenow={config.motionIntensity}
              />
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-150"
                style={{
                  width: `${((config.motionIntensity - 0.5) / 2.5) * 100}%`,
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)'
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-zinc-500">
              <span>Calm</span>
              <span>Energetic</span>
            </div>
          </div>

          {/* Color Mode */}
          {!disableColorModeList.includes(visualizationMode) && (
            <div className="space-y-2" role="radiogroup" aria-label="Color Mode">
              <label className="text-sm text-zinc-300">Color Mode</label>
              <div className="flex flex-wrap gap-2">
                {(visualizationMode === 'github' ? ['monochrome', 'spectrum'] : ['dynamic', 'monochrome', 'spectrum']).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => handleChange('colorMode', mode as 'dynamic' | 'monochrome' | 'spectrum')}
                    className={`px-3 py-2 rounded-xl text-xs transition-all ${config.colorMode === mode
                      ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg'
                      : 'bg-zinc-800/80 text-zinc-400 hover:bg-orange-500/10 hover:text-orange-500 shadow-inner'
                      }`}
                    style={{
                      boxShadow: config.colorMode === mode
                        ? '0 2px 4px rgba(0, 0, 0, 0.3), inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                        : 'inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(255, 255, 255, 0.05)'
                    }}
                    role="radio"
                    aria-checked={config.colorMode === mode}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Base Color */}
          {config.colorMode === 'monochrome' && !disableColorModeList.includes(visualizationMode) && (
            <ColorPicker
              color={color}
              onChange={handleColorChange}
              hideInput
              hideAlpha
              aria-labelledby="color-picker-label"
            />
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-700/50">
          <button
            onClick={() => onConfigChange(defaultConfigs[visualizationMode])}
            className="w-full py-2 bg-zinc-800/80 hover:bg-orange-500/10 text-zinc-300 hover:text-orange-500 rounded-xl text-sm transition-all shadow-inner active:scale-95"
            style={{
              boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.2), 0 1px 1px rgba(255, 255, 255, 0.05)'
            }}
            aria-label="Reset all settings to default values"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default VisualizerSettings;