import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants } from 'motion/react';

interface SplashScreenProps {
  onComplete?: () => void;
  duration?: number; // Total display duration in ms before auto-dismiss
}

export default function SplashScreen({ onComplete, duration = 2200 }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleExitComplete = () => {
    if (onComplete) {
      onComplete();
    }
  };

  const title = "Satyam Medical";
  const subtitle = "PHARMACY & HEALTHCARE";

  // Animation variants for container staggering
  const titleContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.045,
        delayChildren: 0.25,
      },
    },
  };

  const letterVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 18, 
      rotateX: -45,
      filter: 'blur(4px)'
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      rotateX: 0,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        damping: 14,
        stiffness: 180,
      }
    },
  };

  const subtitleContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.025,
        delayChildren: 0.85,
      },
    },
  };

  const subtitleLetterVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 10,
      filter: 'blur(2px)'
    },
    visible: { 
      opacity: 1, 
      y: 0,
      filter: 'blur(0px)',
      transition: {
        type: 'spring',
        damping: 12,
        stiffness: 220,
      }
    },
  };

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isVisible && (
        <motion.div
          key="splash-overlay-screen"
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0, 
            y: -16,
            transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } 
          }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-[#070b12] text-slate-900 dark:text-slate-100 select-none overflow-hidden"
        >
          {/* Ambient Background Glow */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Central Brand Icon Container */}
          <div className="relative mb-6 flex items-center justify-center">
            {/* Pulsing Ripple Rings */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0.9 }}
              animate={{ 
                scale: [0.85, 1.6, 2.1], 
                opacity: [0.8, 0.3, 0] 
              }}
              transition={{ 
                duration: 1.8, 
                repeat: Infinity, 
                ease: "easeOut",
                delay: 0.2
              }}
              className="absolute h-16 w-16 rounded-full border-2 border-emerald-500/60 dark:border-emerald-400/60"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0.7 }}
              animate={{ 
                scale: [0.85, 1.4, 1.8], 
                opacity: [0.7, 0.25, 0] 
              }}
              transition={{ 
                duration: 1.8, 
                repeat: Infinity, 
                ease: "easeOut",
                delay: 0.6
              }}
              className="absolute h-16 w-16 rounded-full border border-sky-500/50 dark:border-sky-400/50"
            />

            {/* Glowing Icon Frame */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 260, 
                damping: 20,
                delay: 0.1 
              }}
              className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-600 shadow-xl shadow-sky-500/25 dark:shadow-sky-500/40 p-3"
            >
              {/* Medical Cross Vector */}
              <svg 
                className="h-full w-full text-white" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="3.2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <motion.path 
                  d="M12 5v14" 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.25, ease: "easeInOut" }}
                />
                <motion.path 
                  d="M5 12h14" 
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.35, ease: "easeInOut" }}
                />
              </svg>
            </motion.div>
          </div>

          {/* Staggered Brand Title Letters */}
          <motion.div
            variants={titleContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-center overflow-hidden py-1 px-4"
          >
            {title.split("").map((char, index) => (
              <motion.span
                key={`title-char-${index}`}
                variants={letterVariants}
                className="inline-block text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white"
                style={{ 
                  marginRight: char === " " ? "0.45rem" : "0.02rem",
                  transformOrigin: "bottom center"
                }}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </motion.div>

          {/* Staggered Subtitle Letters */}
          <motion.div
            variants={subtitleContainerVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center justify-center overflow-hidden mt-1.5 px-4"
          >
            {subtitle.split("").map((char, index) => (
              <motion.span
                key={`subtitle-char-${index}`}
                variants={subtitleLetterVariants}
                className="inline-block text-[10px] sm:text-xs font-bold tracking-[0.22em] text-sky-600 dark:text-sky-400 uppercase"
                style={{ 
                  marginRight: char === " " ? "0.35rem" : "0.01rem" 
                }}
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </motion.div>

          {/* Bottom Progress Pulse Line */}
          <motion.div 
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.4, ease: "easeInOut" }}
            className="mt-8 h-1 w-32 rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-sky-500 origin-center"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
