import React, { useState, useRef, useEffect } from 'react';
import { Drawer } from 'vaul';
import { Menu } from 'lucide-react';
import { AudioData } from '../types/audio';
import LeftSidebar from './LeftSidebar';
import { motion, AnimatePresence } from 'framer-motion';

interface MobileBottomSheetProps {
  selectedFile: AudioData | null;
  onFileSelect: (file: File) => void;
  onDemoSelect: (demo: AudioData) => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isMicMode: boolean;
  onMicToggle: () => void;
  showFileUploadUI: boolean;
}

const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
  selectedFile,
  onFileSelect,
  onDemoSelect,
  isOpen,
  onOpenChange,
  isMicMode,
  onMicToggle,
  showFileUploadUI,
}) => {
  const [showButton, setShowButton] = useState(true);
  const timeoutRef = useRef<number>();
  const lastSelectedFileRef = useRef<string | null>(selectedFile?.id || null);

  const resetTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setShowButton(true);

    if (!isOpen && (selectedFile || isMicMode)) {
      timeoutRef.current = window.setTimeout(() => {
        setShowButton(false);
      }, 3000);
    }
  };

  useEffect(() => {
    resetTimer();
    document.addEventListener('mousemove', resetTimer);
    document.addEventListener('click', resetTimer);
    document.addEventListener('touchstart', resetTimer);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      document.removeEventListener('mousemove', resetTimer);
      document.removeEventListener('click', resetTimer);
      document.removeEventListener('touchstart', resetTimer);
    };
  }, [isOpen, selectedFile, isMicMode]);

  useEffect(() => {
    const currentFileId = selectedFile?.id || null;
    if (currentFileId !== lastSelectedFileRef.current) {
      lastSelectedFileRef.current = currentFileId;
      resetTimer();
    }
  }, [selectedFile]);

  return (
    <Drawer.Root open={isOpen} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {showButton && (
          <Drawer.Trigger asChild>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden fixed top-4 left-4 md:left-6 z-50 w-10 h-10 flex items-center justify-center rounded-xl bg-zinc-800/80 backdrop-blur-sm border border-zinc-700 text-zinc-400 hover:text-orange-500 hover:bg-orange-500/10 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </motion.button>
          </Drawer.Trigger>
        )}
      </AnimatePresence>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40" />
        <Drawer.Content className="bg-gradient-to-b from-zinc-900/90 to-zinc-800/90 backdrop-blur-lg flex flex-col rounded-t-[10px] border border-zinc-700 mt-24 fixed bottom-0 left-1 right-1">
          <Drawer.Title className="sr-only">Audio Controls Menu</Drawer.Title>
          <div className="p-4 rounded-t-[10px] flex-1 overflow-y-auto">
            <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-600 mb-8" />
            <LeftSidebar
              selectedFile={selectedFile}
              onFileSelect={onFileSelect}
              onDemoSelect={onDemoSelect}
              isMicMode={isMicMode}
              isTurningOffMicMode={false}
              onMicToggle={onMicToggle}
              showFileUploadUI={showFileUploadUI}
            />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default MobileBottomSheet;