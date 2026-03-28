"use client";

import { useEffect, useRef, useState, useCallback, ChangeEvent } from "react";
import { RotateCcw, ImagePlus, User, Award, Download, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function useWindowSize() {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 800,
    height: typeof window !== 'undefined' ? window.innerHeight : 600
  });
  useEffect(() => {
    const handleResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
}

// --- Flappy Aman Game Types ---
type Bird = { y: number; vy: number; radius: number; rotation: number };
type Pipe = { x: number; topHeight: number; bottomY: number; passed: boolean; width: number; label: string; index: number };

// Make the game slower and gaps larger so users can read and observe the hurdles
const GRAVITY = 0.8;
const FLAP_STRENGTH = -12;
const PIPE_SPEED = 3.5; // Slower speed gives time to read and react to the life hurdle
const PIPE_WIDTH = 120; // Wide enough for presence
const PIPE_GAP = 280; // Large space so the intention has room to be processed
const PIPE_SPAWN_RATE = 160; // Slower spawn rate gives breathing room between hurdles

// The 20 Life Hurdles
const LIFE_HURDLES = [
  "Self-Doubt",
  "Procrastination",
  "Distractions",
  "Fear of Failure",
  "Financial Stress",
  "Burnout",
  "Expectations",
  "Imposter Syndrome",
  "Rejection",
  "Loneliness",
  "Health Issues",
  "Overthinking",
  "Lack of Motivation",
  "Time Management",
  "Toxic People",
  "Unexpected Crisis",
  "Creative Block",
  "Unfair Comparison",
  "Loss of Direction",
  "Giving Up"
];

const TOTAL_HURDLES = LIFE_HURDLES.length;

export default function Home() {
  const [phase, setPhase] = useState<"matrix" | "menu" | "game">("matrix");

  const windowSize = useWindowSize();
  
  // Responsive Physics Constants (Mobile vs Desktop)
  const isMobile = windowSize.width < 768;
  const activeGravity = isMobile ? 0.45 : GRAVITY;
  const activeFlapStrength = isMobile ? -8 : FLAP_STRENGTH;
  const activePipeSpeed = isMobile ? 2.0 : PIPE_SPEED;
  const activePipeWidth = isMobile ? 80 : PIPE_WIDTH;
  const activePipeGap = isMobile ? 240 : PIPE_GAP;

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [victory, setVictory] = useState(false); 
  const [victoryAnim, setVictoryAnim] = useState(false); 
  const [gameStarted, setGameStarted] = useState(false); // Pause state before first flap

  const [customImgSrc, setCustomImgSrc] = useState<string | null>(null);

  // Certificate State
  const [certPhase, setCertPhase] = useState<"none" | "input" | "preview">("none");
  const [playerName, setPlayerName] = useState("");
  const [certDataUrl, setCertDataUrl] = useState<string | null>(null);

  const matrixCanvasRef = useRef<HTMLCanvasElement>(null);
  const gameCanvasRef = useRef<HTMLCanvasElement>(null);
  const birdSpriteRef = useRef<HTMLCanvasElement | null>(null);
  
  const requestRef = useRef<number>();

  // Game Refs
  const birdRef = useRef<Bird | null>(null);
  const pipesRef = useRef<Pipe[]>([]);
  const distanceAccumulatorRef = useRef(0);
  const spawnCountRef = useRef(0);

  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const victoryRef = useRef(false);
  const gameStartedRef = useRef(false);
  
  // Victory Animation Refs
  const victoryAnimRef = useRef(false);
  const victoryTimerRef = useRef(0);

  // Initialize Game State
  const initGame = useCallback((imgSource?: string | null) => {
    const srcToLoad = imgSource || customImgSrc || '/aman.png';
    const img = new Image();
    img.src = srcToLoad;
    img.onload = () => {
      // PRE-RENDER BIRD AVATAR (MASSIVE MOBILE LAG FIX) WITH RETINA SCALING
      const scale = 3; // 3x Supersampling for ultra-crisp displays
      const oc = document.createElement("canvas");
      oc.width = 44 * scale; 
      oc.height = 44 * scale;
      const octx = oc.getContext("2d");
      if(octx) {
         octx.scale(scale, scale);
         octx.beginPath();
         octx.arc(22, 22, 20, 0, Math.PI * 2);
         octx.clip();
         octx.drawImage(img, 2, 2, 40, 40);
         octx.lineWidth = 3;
         octx.strokeStyle = "#fff";
         octx.stroke();
      }
      birdSpriteRef.current = oc;
    };

    birdRef.current = {
      y: windowSize.height / 2,
      vy: 0,
      radius: 20,
      rotation: 0
    };
    pipesRef.current = [];
    distanceAccumulatorRef.current = 560; // Spawn immediately
    spawnCountRef.current = 0;

    scoreRef.current = 0;
    setScore(0);
    gameOverRef.current = false;
    setGameOver(false);
    victoryRef.current = false;
    setVictory(false);
    victoryAnimRef.current = false;
    victoryTimerRef.current = 0;
    setVictoryAnim(false);
    gameStartedRef.current = false;
    setGameStarted(false);
    setCertPhase("none");

    setPhase("game");
  }, [windowSize.height, customImgSrc]);

  const flap = useCallback(() => {
    if (gameOverRef.current || victoryRef.current || victoryAnimRef.current) return;
    
    if (!gameStartedRef.current) {
      gameStartedRef.current = true;
      setGameStarted(true);
    }

    if (birdRef.current) {
      birdRef.current.vy = activeFlapStrength;
    }
  }, [activeFlapStrength]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomImgSrc(url);
      initGame(url);
    }
  };

  const startWithOG = () => {
    setCustomImgSrc(null);
    initGame('/aman.png');
  };

  const generateCertificate = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 840;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Dark Blue/Slate
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Borders
    ctx.strokeStyle = "#fbbf24"; // Gold
    ctx.lineWidth = 12;
    ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(55, 55, canvas.width - 110, canvas.height - 110);
    ctx.strokeRect(65, 65, canvas.width - 130, canvas.height - 130);

    // Corner Accents
    ctx.fillStyle = "#fbbf24";
    const cornerSize = 40;
    ctx.fillRect(35, 35, cornerSize, cornerSize);
    ctx.fillRect(canvas.width - 35 - cornerSize, 35, cornerSize, cornerSize);
    ctx.fillRect(35, canvas.height - 35 - cornerSize, cornerSize, cornerSize);
    ctx.fillRect(canvas.width - 35 - cornerSize, canvas.height - 35 - cornerSize, cornerSize, cornerSize);

    // Header Texture/Gradient
    const gradient = ctx.createLinearGradient(0, 100, canvas.width, 100);
    gradient.addColorStop(0, "#f59e0b");
    gradient.addColorStop(0.5, "#fef3c7");
    gradient.addColorStop(1, "#f59e0b");

    ctx.fillStyle = gradient;
    ctx.font = "bold 60px 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.fillText("CERTIFICATE OF RESILIENCE", canvas.width / 2, 200);

    // Subtitle
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "24px 'Arial', sans-serif";
    ctx.letterSpacing = "5px";
    ctx.fillText("AWARDED PROUDLY TO", canvas.width / 2, 300);

    // Player Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "italic bold 80px 'Times New Roman', cursive, serif";
    ctx.fillText(playerName.trim() || "A Brave Soul", canvas.width / 2, 420);

    // Line under name
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2 - 350, 440);
    ctx.lineTo(canvas.width / 2 + 350, 440);
    ctx.stroke();

    // Body Text
    ctx.fillStyle = "#94a3b8";
    ctx.font = "italic 34px 'Times New Roman', serif";
    ctx.textAlign = "center";
    ctx.fillText("Unyielding resilience", canvas.width / 2, 530);
    ctx.fillText("an unstoppable, unbreakable spirit.", canvas.width / 2, 580);

    // Footer lines
    ctx.font = "bold 20px 'Arial', sans-serif";
    ctx.fillStyle = "#cbd5e1";
    ctx.letterSpacing = "2px";

    ctx.fillText("DATE", canvas.width / 4, 760);
    ctx.fillStyle = "#ffffff";
    ctx.font = "italic 28px 'Times New Roman', serif";
    ctx.fillText(new Date().toLocaleDateString(), canvas.width / 4, 720);
    ctx.beginPath();
    ctx.strokeStyle = "#475569";
    ctx.moveTo(canvas.width / 4 - 100, 730);
    ctx.lineTo(canvas.width / 4 + 100, 730);
    ctx.stroke();

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 20px 'Arial', sans-serif";
    ctx.fillText("SIGNATURE", (canvas.width / 4) * 3, 760);
    ctx.fillStyle = "#fbbf24";
    ctx.font = "italic 40px 'Times New Roman', cursive, serif";
    ctx.fillText("Aman Agrahari", (canvas.width / 4) * 3, 720);
    ctx.beginPath();
    ctx.strokeStyle = "#475569";
    ctx.moveTo((canvas.width / 4) * 3 - 150, 730);
    ctx.lineTo((canvas.width / 4) * 3 + 150, 730);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, 700, 60, 0, 2 * Math.PI);
    ctx.fillStyle = "#b45309";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#fbbf24";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(canvas.width / 2, 700, 45, 0, 2 * Math.PI);
    ctx.strokeStyle = "#fbbf24";
    ctx.stroke();

    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("★", canvas.width / 2, 715);

    setCertDataUrl(canvas.toDataURL("image/png"));
    setCertPhase("preview");
  };

  // 1. MATRIX RAIN EFFECT
  useEffect(() => {
    if (phase !== "matrix") return;
    if (typeof window === "undefined") return;

    const canvas = matrixCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const chars = "AmanAgrahari010101".split("");
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#0F0";
      ctx.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    };

    const interval = setInterval(draw, 33);
    const timeout = setTimeout(() => {
      setCustomImgSrc(null);
      initGame('/aman.png');
    }, 3000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [phase, initGame]);

  // 2. FLAPPY BIRD GAME LOOP
  useEffect(() => {
    if (phase !== "game") return;

    const canvas = gameCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName.toLowerCase() === 'input') {
        return;
      }
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault();
        flap();
      }
    };

    const handleMouseDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName.toLowerCase() === 'button' ||
        target.closest('button') ||
        target.tagName.toLowerCase() === 'input' ||
        target.tagName.toLowerCase() === 'a' ||
        target.closest('a')
      ) return;
      if (e.type === 'touchstart') e.preventDefault();
      flap();
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("touchstart", handleMouseDown, { passive: false });

    const spawnPipe = () => {
      if (spawnCountRef.current >= TOTAL_HURDLES) return; 

      const minPipeHeight = 50;
      const maxTopHeight = windowSize.height - activePipeGap - minPipeHeight;
      const topHeight = Math.max(minPipeHeight, Math.random() * maxTopHeight);

      const label = LIFE_HURDLES[spawnCountRef.current];

      pipesRef.current.push({
        x: windowSize.width,
        topHeight: topHeight,
        bottomY: topHeight + activePipeGap,
        passed: false,
        width: activePipeWidth,
        label: label,
        index: spawnCountRef.current
      });

      spawnCountRef.current++;
    };

    let animationFrameId: number;
    let lastTime = 0;

    const update = (time: number) => {
      
      if (lastTime === 0) lastTime = time;
      let dt = time - lastTime;
      lastTime = time;

      // Clamp max dt to prevent physics explosions if tabs are backgrounded
      if (dt > 100) dt = 16.666;
      
      // Map to 60fps baseline for universal true-speed
      const timeScale = dt / 16.666;

      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
      if (canvas.width !== windowSize.width * dpr || canvas.height !== windowSize.height * dpr) {
        canvas.width = windowSize.width * dpr;
        canvas.height = windowSize.height * dpr;
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      if (!gameOverRef.current && !victoryRef.current && birdRef.current) {
        const bird = birdRef.current;
        const birdX = windowSize.width / 3;

        // Snappy Bird Physics
        if (!gameStartedRef.current) {
           // Hover gently before game starts
           bird.y = (windowSize.height / 2) + Math.sin(time * 0.005) * 15;
           bird.rotation = 0;
        } else if (!victoryAnimRef.current) {
           bird.vy += activeGravity * timeScale;
           bird.y += bird.vy * timeScale;
           bird.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (bird.vy * 0.1)));
        } else {
           // VICTORY CUTSCENE PHYSICS
           bird.rotation = 0;
           const targetY = windowSize.height - 140; // Rest gracefully on the platform
           
           if (bird.y < targetY - 1 || bird.vy < 0) {
              bird.vy += (activeGravity * 0.8) * timeScale; 
              bird.y += bird.vy * timeScale; 
              
              if (bird.y >= targetY) {
                  bird.y = targetY; 
                  bird.vy = bird.vy > 3 ? -bird.vy * 0.3 : 0; 
              }
           } else {
              bird.y = targetY; 
              bird.vy = 0;
           }

           // Tally up cutscene frames until panel pops
           victoryTimerRef.current += timeScale;
           if (victoryTimerRef.current > 160) { // ~2.5 Seconds at 60Hz
              victoryRef.current = true;
              setVictory(true); 
           }
        }

        // Spawn Pipes Framerate-Independently based on Distance
        if (gameStartedRef.current && !victoryAnimRef.current) {
          distanceAccumulatorRef.current += activePipeSpeed * timeScale;
          if (distanceAccumulatorRef.current >= 560) {
             spawnPipe();
             distanceAccumulatorRef.current = 0;
          }
        }

        // Process Pipes
        for (let i = pipesRef.current.length - 1; i >= 0; i--) {
          const pipe = pipesRef.current[i];
          if (gameStartedRef.current) {
             pipe.x -= activePipeSpeed * timeScale;
          }

          // Score Logic
          if (!pipe.passed && pipe.x + pipe.width < birdX - bird.radius) {
            pipe.passed = true;
            scoreRef.current += 1;
            setScore(scoreRef.current);

            // Victory Check Trigger
            if (scoreRef.current >= TOTAL_HURDLES && !victoryAnimRef.current) {
              victoryAnimRef.current = true;
              setVictoryAnim(true); // Hide UI & init sequence 
            }
          }

          // Collision Logic (Only active if not in Victory cutscene!)
          if (!victoryAnimRef.current) {
            const birdLeft = birdX - bird.radius + 5;
            const birdRight = birdX + bird.radius - 5;
            const birdTop = bird.y - bird.radius + 5;
            const birdBottom = bird.y + bird.radius - 5;

            const pipeLeft = pipe.x;
            const pipeRight = pipe.x + pipe.width;

            if (birdRight > pipeLeft && birdLeft < pipeRight) {
              if (birdTop < pipe.topHeight || birdBottom > pipe.bottomY) {
                gameOverRef.current = true;
                setGameOver(true);
              }
            }
          }

          if (pipe.x + pipe.width < 0) {
            pipesRef.current.splice(i, 1);
          }
        }

        // Floor / Ceiling Collision
        if (!victoryAnimRef.current && (bird.y + bird.radius >= windowSize.height || bird.y - bird.radius <= 0)) {
          gameOverRef.current = true;
          setGameOver(true);
        }
      }

      // RENDERING PIPES
      for (const pipe of pipesRef.current) {
        const isFinal = pipe.index === TOTAL_HURDLES - 1;

        ctx.fillStyle = isFinal ? "#ef4444" : "#6366f1"; 
        ctx.fillRect(pipe.x, 0, pipe.width, pipe.topHeight);
        ctx.fillRect(pipe.x, pipe.bottomY, pipe.width, windowSize.height - pipe.bottomY);

        ctx.fillStyle = isFinal ? "#b91c1c" : "#4f46e5";
        ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, pipe.width + 10, 20);
        ctx.fillRect(pipe.x - 5, pipe.bottomY, pipe.width + 10, 20);

        ctx.save();
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        
        // Use true dynamic center of the pipe gap (supports screen resizes better)
        const gapCenter = pipe.topHeight + (pipe.bottomY - pipe.topHeight) / 2;
        
        ctx.fillText(pipe.label.toUpperCase(), pipe.x + pipe.width / 2 + 2, gapCenter + 2);
        
        ctx.fillStyle = isFinal ? "#fca5a5" : "#e0e7ff";
        ctx.fillText(pipe.label.toUpperCase(), pipe.x + pipe.width / 2, gapCenter);
        ctx.restore();
      }

      // RENDERING BIRD AND VICTORY ANIMATION
      if (birdRef.current && !victoryRef.current) {
        const bird = birdRef.current;
        const birdX = windowSize.width / 3;

        // Draw The Victory Celebration Environment
        if (victoryAnimRef.current) {
           const platY = windowSize.height - 50;

           // Grassy Platform Base
           ctx.fillStyle = "#22c55e"; 
           ctx.fillRect(0, platY, windowSize.width, 50);
           ctx.fillStyle = "#166534"; 
           ctx.fillRect(0, platY, windowSize.width, 10);

           // Plant the Victory Flag Pole
           const flagX = Math.min(birdX + 130, windowSize.width - 60);
           ctx.strokeStyle = "#cbd5e1"; // Silver Pole
           ctx.lineWidth = 6;
           ctx.lineCap = "round";
           ctx.beginPath();
           ctx.moveTo(flagX, platY);
           ctx.lineTo(flagX, platY - 200);
           ctx.stroke();

           // Dynamic Waving Red Flag Cloth
           const wave = Math.sin(victoryTimerRef.current * 0.1) * 12;
           ctx.fillStyle = "#ef4444"; 
           ctx.beginPath();
           ctx.moveTo(flagX, platY - 190 + wave);
           ctx.lineTo(flagX + 80, platY - 170 - wave); // Trailing end 
           ctx.lineTo(flagX, platY - 140 + wave);
           ctx.fill();

           // Golden 'WIN' text drawn onto the waving red flag 
           ctx.fillStyle = "#fbbf24";
           ctx.font = "900 16px sans-serif";
           ctx.textAlign = "left";
           ctx.fillText("WIN", flagX + 22, platY - 162 + wave);

           // Morphing Bird into A Cheering Stick Figure Man
           // Wait until the bird physically reaches the ground / target location
           if (bird.y >= windowSize.height - 145) {
             ctx.strokeStyle = "#fff";
             ctx.lineWidth = 4;
             ctx.lineCap = "round";
             ctx.lineJoin = "round";
             
             ctx.beginPath();
             // Spine
             ctx.moveTo(birdX, bird.y + bird.radius);
             ctx.lineTo(birdX, bird.y + bird.radius + 40);
             
             // Animated Cheering/Waving Arms
             const armOffset = Math.sin(victoryTimerRef.current * 0.3) * 15;
             ctx.moveTo(birdX, bird.y + bird.radius + 15);
             ctx.lineTo(birdX - 25, bird.y + bird.radius - 15 + armOffset);
             ctx.moveTo(birdX, bird.y + bird.radius + 15);
             ctx.lineTo(birdX + 25, bird.y + bird.radius - 15 - armOffset);
             
             // Stable Standing Legs
             ctx.moveTo(birdX, bird.y + bird.radius + 40);
             ctx.lineTo(birdX - 15, bird.y + bird.radius + 70); // Left Foot
             ctx.moveTo(birdX, bird.y + bird.radius + 40);
             ctx.lineTo(birdX + 15, bird.y + bird.radius + 70); // Right foot
             ctx.stroke();
           }
        }

        ctx.save();
        ctx.translate(birdX, bird.y);
        ctx.rotate(bird.rotation);

        if (birdSpriteRef.current) {
          ctx.drawImage(birdSpriteRef.current, -22, -22, 44, 44);
        } else {
          ctx.fillStyle = "#ecc94b"; 
          ctx.beginPath();
          ctx.arc(0, 0, bird.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("touchstart", handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [phase, windowSize, flap]);

  useEffect(() => {
    if (gameOver && score > highScore) {
      setHighScore(score);
    }
  }, [gameOver, score, highScore]);

  return (
    <main className="fixed inset-0 z-0 bg-[#1e1e2f] overflow-hidden flex flex-col items-center justify-center font-sans select-none"
         style={{
           backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)`,
           backgroundSize: '40px 40px'
         }}
    >

      <AnimatePresence>
        {phase === "matrix" && (
          <motion.canvas
            key="matrix-canvas"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            ref={matrixCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "menu" && (
          <motion.div
            key="menu-ui"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex items-center justify-center z-20 px-4 md:px-6 backdrop-blur-sm"
          >
            <div className="bg-black/60 backdrop-blur-xl border border-indigo-500/30 p-6 md:p-12 rounded-2xl flex flex-col items-center shadow-[0_0_50px_rgba(99,102,241,0.2)] max-w-lg w-full">
              <h2 className="text-2xl md:text-4xl text-white font-bold tracking-widest mb-2 text-center drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">CHOOSE YOUR BIRD</h2>
              <p className="text-indigo-300 text-center mb-8 text-xs md:text-base">Play as the OG Aman or upload your OG face!</p>

              <div className="flex flex-col sm:flex-row gap-4 md:gap-6 w-full items-center justify-center">

                {/* Option 1: OG Aman */}
                <button
                  onClick={startWithOG}
                  className="group relative flex flex-col items-center justify-center bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/50 rounded-xl p-4 md:p-6 w-full sm:w-1/2 transition-all hover:scale-105"
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-white/50 overflow-hidden mb-3 md:mb-4 group-hover:border-white transition-colors">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/aman.png" alt="OG Aman" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-white font-bold tracking-widest text-sm md:text-lg">OG A-MAN</span>
                </button>

                {/* Option 2: Upload Own */}
                <label className="group relative flex flex-col items-center justify-center bg-zinc-800/40 hover:bg-zinc-800/60 border border-zinc-600/50 rounded-xl p-4 md:p-6 w-full sm:w-1/2 cursor-pointer transition-all hover:scale-105">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-white/30 border-dashed flex items-center justify-center mb-3 md:mb-4 text-white/50 group-hover:text-white group-hover:border-white transition-colors">
                    <ImagePlus className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <span className="text-white/80 font-bold tracking-widest text-center text-xs md:text-lg leading-tight group-hover:text-white">UPLOAD<br />YOURS</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "game" && (
          <motion.div
            key="flappy-ui"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full"
          >
            <canvas ref={gameCanvasRef} className="absolute inset-0 w-full h-full block" />

            {/* Header Overlay */}
            {!victoryAnim && (
               <div className="absolute top-0 left-0 right-0 flex justify-between items-start pointer-events-none p-4 md:p-8 z-10 w-full drop-shadow-lg">
               <div className="flex flex-col gap-1 md:gap-2 pointer-events-auto bg-black/30 p-3 md:p-4 rounded-xl backdrop-blur-md border border-white/10">
                   <div className="flex items-center gap-2 text-white">
                   <span className="text-xs md:text-sm font-bold opacity-80 uppercase tracking-widest">Hurdles Cleared</span>
                   </div>
                   <div className="text-white text-2xl md:text-4xl font-black tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                   {score} / 20
                   </div>
               </div>
               </div>
            )}

            {/* Victory Overlay & Certificate Flow */}
            {victory && (
              <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center backdrop-blur-md z-30 pointer-events-none px-4 md:px-6">

                {/* 1. Base Victory Screen */}
                {certPhase === "none" && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="pointer-events-auto flex flex-col items-center max-w-2xl text-center">
                    <div className="text-amber-400 mb-4 md:mb-6 flex animate-bounce">
                      <Award size={60} className="md:w-[80px] md:h-[80px]" />
                    </div>
                    <h2 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-4 md:mb-6 tracking-widest drop-shadow-[0_0_20px_rgba(250,204,21,0.8)] text-white uppercase">
                      Congratulations!
                    </h2>
                    <p className="text-white text-base sm:text-lg md:text-2xl mb-8 md:mb-12 font-medium leading-relaxed max-w-xl px-2">
                      You navigated through 20 of life&apos;s toughest hurdles without giving up.
                      No matter what obstacles get in your way, you have the resilience to keep flying forward.
                      <br /><br />
                      <span className="text-amber-400 font-bold">Never stop believing in your journey.</span>
                    </p>
                    <div className="flex flex-col w-full sm:flex-row gap-3 md:gap-4 justify-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPhase("menu"); }}
                        className="flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-bold tracking-widest text-sm md:text-xl border border-zinc-600 shadow-xl"
                      >
                        <User size={20} className="md:w-6 md:h-6" />
                        FLY AGAIN
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCertPhase("input"); }}
                        className="flex items-center justify-center gap-2 px-4 py-3 sm:px-8 sm:py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl transition-all font-bold tracking-widest text-sm md:text-xl shadow-[0_0_30px_rgba(251,191,36,0.6)] transform hover:scale-105"
                      >
                        <Award size={20} className="md:w-6 md:h-6" />
                        CLAIM CERTIFICATE
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 2. Certificate Name Input Screen */}
                {certPhase === "input" && (
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="pointer-events-auto flex flex-col items-center max-w-lg w-full bg-slate-800/80 p-6 md:p-8 rounded-2xl border border-amber-500/30 shadow-2xl">
                    <h3 className="text-xl md:text-2xl text-amber-400 font-bold mb-2 md:mb-4 tracking-widest uppercase text-center">Print Your Certificate</h3>
                    <p className="text-slate-300 mb-4 md:mb-6 text-xs md:text-sm text-center">Enter the name you wish to appear on your official Certificate of Resilience.</p>

                    <input
                      type="text"
                      placeholder="Enter your full name"
                      className="w-full bg-slate-900 border border-slate-600 text-white text-lg md:text-xl rounded-lg px-3 py-2 md:px-4 md:py-3 mb-4 md:mb-6 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors"
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      autoFocus
                    />

                    <div className="flex gap-3 md:gap-4 w-full">
                      <button onClick={() => setCertPhase("none")} className="flex-1 py-2 md:py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold tracking-wider transition-colors text-xs md:text-base">
                        CANCEL
                      </button>
                      <button onClick={generateCertificate} className="flex-1 py-2 md:py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-lg font-bold tracking-wider transition-colors shadow-[0_0_15px_rgba(251,191,36,0.5)] text-xs md:text-base">
                        GENERATE
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* 3. Certificate Preview Screen */}
                {certPhase === "preview" && certDataUrl && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="pointer-events-auto flex flex-col items-center w-full max-w-4xl px-2 md:px-4">
                    <h3 className="text-lg md:text-3xl text-white font-bold mb-4 md:mb-6 tracking-widest flex items-center gap-2 md:gap-3">
                      <CheckCircle2 className="text-green-400 w-6 h-6 md:w-8 md:h-8" />
                      CERTIFICATE READY
                    </h3>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={certDataUrl} alt="Certificate of Resilience" className="w-full object-contain max-h-[40vh] md:max-h-[50vh] rounded-lg shadow-2xl border border-amber-500/50 mb-6 md:mb-8" />

                    <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full justify-center">
                      <button onClick={() => setCertPhase("none")} className="px-4 py-3 md:px-6 md:py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold tracking-wider transition-colors text-xs md:text-base">
                        BACK
                      </button>
                      <a href={certDataUrl} download={`Resilience_Certificate_${playerName.trim() || 'Award'}.png`} className="flex items-center justify-center gap-2 px-6 py-3 md:px-8 md:py-4 bg-amber-500 hover:bg-amber-400 text-slate-900 rounded-xl font-bold tracking-wider transition-colors shadow-[0_0_20px_rgba(251,191,36,0.5)] transform hover:scale-105 text-xs md:text-base">
                        <Download size={20} className="md:w-6 md:h-6" />
                        DOWNLOAD
                      </a>
                    </div>
                  </motion.div>
                )}

              </div>
            )}

            {/* Game Over Overlay */}
            {gameOver && !victory && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm z-20 pointer-events-none px-4 md:px-6">
                <div className="pointer-events-auto flex flex-col items-center text-center w-full">
                  <h2 className="text-4xl sm:text-5xl md:text-7xl font-bold mb-3 md:mb-4 tracking-widest drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] text-white">
                    OBSTACLE HIT
                  </h2>
                  <p className="text-indigo-300 text-sm sm:text-lg md:text-2xl mb-8 md:mb-12 font-medium max-w-md">
                    You cleared <span className="text-white font-bold">{score}</span> hurdles. It&apos;s okay to fall—just dust yourself off and try again!
                  </p>
                  <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3 md:gap-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); initGame(); }}
                      className="flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all font-bold tracking-widest text-sm md:text-xl shadow-[0_0_20px_rgba(99,102,241,0.5)] transform hover:scale-105"
                    >
                      <RotateCcw size={20} className="md:w-6 md:h-6" />
                      RETRY
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPhase("menu"); }}
                      className="flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-all font-bold tracking-widest text-sm md:text-xl border border-zinc-600"
                    >
                      <User size={20} className="md:w-6 md:h-6" />
                      CHANGE BIRD
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Start Button Overlay */}
            <AnimatePresence>
              {!gameStarted && !gameOver && !victory && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 bg-black/40 backdrop-blur-sm z-20 flex flex-col items-center justify-center pointer-events-none px-4 text-center"
                >
                  <div className="bg-slate-900/60 border border-indigo-500/30 p-8 md:p-12 rounded-3xl backdrop-blur-xl shadow-[0_0_50px_rgba(99,102,241,0.2)] flex flex-col items-center max-w-lg w-full relative overflow-hidden">
                    {/* Decorative glow inside */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-indigo-500/20 blur-[50px] rounded-full pointer-events-none"></div>

                    <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-widest mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white via-indigo-200 to-indigo-500 drop-shadow-lg uppercase">
                      Get Ready
                    </h2>
                    
                    <p className="text-indigo-200/80 text-sm md:text-lg mb-10 font-medium max-w-xs md:max-w-sm">
                      Life is full of unexpected hurdles. Prove that you have the resilience to overcome all 20 of them.
                    </p>
                    
                    <button className="relative group pointer-events-auto flex items-center justify-center gap-3 bg-indigo-600 border border-indigo-400/50 hover:border-indigo-300 text-white px-8 md:px-10 py-4 md:py-5 rounded-2xl font-bold tracking-widest text-lg md:text-xl shadow-[0_0_40px_rgba(99,102,241,0.4)] transform hover:scale-105 transition-all overflow-hidden"
                            onClick={(e) => { e.stopPropagation(); flap(); }}>
                      <span className="relative z-10 flex items-center gap-3">
                        <User className="w-5 h-5 md:w-6 md:h-6" />
                        START FLYING
                      </span>
                      {/* Shine sweep effect on hover */}
                      <div className="absolute top-0 -left-[100%] w-[120%] h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-20deg] group-hover:left-[100%] transition-all duration-1000 ease-out z-0"></div>
                    </button>
                    
                    <p className="text-white/40 mt-6 text-[10px] md:text-xs uppercase tracking-[0.3em] pointer-events-none">
                      Tap anywhere to jump
                    </p>
                    </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hint Layer */}
            {gameStarted && !gameOver && !victory && !victoryAnim && score === 0 && (
              <div className="absolute bottom-1/4 left-0 right-0 flex justify-center pointer-events-none">
                <p className="text-white drop-shadow-lg text-sm sm:text-lg md:text-2xl tracking-widest font-bold bg-indigo-600/80 px-4 py-2 sm:px-8 sm:py-4 rounded-full backdrop-blur-sm animate-pulse">
                  TAP or JUMP
                </p>
              </div>
            )}
            
            {/* Next Hurdle Indicator */}
            {!gameOver && !victory && !victoryAnim && score < TOTAL_HURDLES && (
              <div className="absolute bottom-8 lg:bottom-12 left-0 right-0 flex justify-center pointer-events-none z-10 transition-opacity">
                <div className="bg-black/40 border border-white/10 px-4 py-2 md:px-6 md:py-3 rounded-full backdrop-blur-md flex items-center gap-2 md:gap-3 drop-shadow-xl">
                  <span className="text-indigo-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">Facing:</span>
                  <span className="text-white text-xs sm:text-sm md:text-lg font-bold tracking-widest">{LIFE_HURDLES[score].toUpperCase()}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
