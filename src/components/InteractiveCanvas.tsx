import React, { useEffect, useRef } from 'react';
import { MotionDetector } from '../lib/MotionDetector';

interface InteractiveCanvasProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  detectorRef: React.RefObject<MotionDetector | null>;
  backgroundImage: string | null;
  effectMode: 'reveal' | 'particles' | 'ripples';
  motionThreshold: number;
  flipX: boolean;
  onMotion?: (points: {x: number, y: number, intensity: number}[]) => void;
}

interface Particle {
  type: 'spark' | 'ripple';
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life: number;
  maxLife: number;
  color: string;
  size?: number;
  radius?: number;
}

export default function InteractiveCanvas({
  videoRef,
  detectorRef,
  backgroundImage,
  effectMode,
  motionThreshold,
  flipX,
  onMotion
}: InteractiveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Use a ref to keep track of the latest callback without restarting the loop
  const onMotionRef = useRef(onMotion);
  useEffect(() => {
    onMotionRef.current = onMotion;
  }, [onMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      // Initialize full black for reveal mode
      if (effectMode === 'reveal') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial setup

    let rafId: number;

    const tick = () => {
      if (!videoRef.current || !detectorRef.current || videoRef.current.readyState < 2) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const motionPoints = detectorRef.current.detect(videoRef.current, motionThreshold, flipX);

      if (onMotionRef.current && motionPoints.length > 0) {
        onMotionRef.current(motionPoints);
      }

      if (effectMode === 'reveal') {
        // Fade back to black slowly over time
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Motion "erases" the black to reveal the background image beneath
        ctx.globalCompositeOperation = 'destination-out';
        motionPoints.forEach(p => {
          const x = p.x * canvas.width;
          const y = p.y * canvas.height;
          ctx.beginPath();
          ctx.arc(x, y, 80, 0, Math.PI * 2);
          
          const grad = ctx.createRadialGradient(x, y, 0, x, y, 80);
          grad.addColorStop(0, 'rgba(0,0,0,0.6)');
          grad.addColorStop(1, 'rgba(0,0,0,0)');
          
          ctx.fillStyle = grad;
          ctx.fill();
        });
        ctx.globalCompositeOperation = 'source-over';
      } 
      else {
        // For particles and ripples, create a slight motion blur trail
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (effectMode === 'particles') {
          // Spawn sparks rapidly where there is motion
          motionPoints.forEach(p => {
            if (Math.random() > 0.6) { // Spawn rate control
              particles.push({
                type: 'spark',
                x: p.x * canvas.width,
                y: p.y * canvas.height,
                vx: (Math.random() - 0.5) * 8, // chaotic horizontal
                vy: -Math.random() * 5 - 2,     // constantly float up
                life: 1.0,
                maxLife: 1.0,
                color: `hsl(${Math.random() * 60 + 200}, 100%, 60%)`, // Sci-fi Blue/Purple
                size: Math.random() * 4 + 2
              });
            }
          });
        } 
        else if (effectMode === 'ripples') {
          // Spawn expanding ripples infrequently to avoid noise
          motionPoints.forEach(p => {
            if (Math.random() > 0.97) { 
              particles.push({
                type: 'ripple',
                x: p.x * canvas.width,
                y: p.y * canvas.height,
                life: 1.0,
                maxLife: 1.0,
                color: `hsl(${Math.random() * 360}, 80%, 60%)`, // Rainbow ripples
                radius: 5
              });
            }
          });
        }

        // Update and draw the particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          
          if (p.type === 'spark') {
            p.x += (p.vx || 0);
            p.y += (p.vy || 0);
            p.life -= 0.015;

            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(0, p.life) * (p.size || 2), 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();

          } else if (p.type === 'ripple') {
            if (p.radius !== undefined) {
              p.radius += 4;
              p.life -= 0.015;
              
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
              ctx.strokeStyle = p.color;
              ctx.lineWidth = Math.max(0, p.life) * 4;
              
              ctx.globalAlpha = Math.max(0, p.life);
              ctx.stroke();
              ctx.globalAlpha = 1.0;
            }
          }

          if (p.life <= 0) {
            particles.splice(i, 1);
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(rafId);
    };
  }, [videoRef, detectorRef, effectMode, motionThreshold, flipX]);

  return (
    <div className="absolute inset-0 w-full h-full bg-black overflow-hidden pointer-events-none">
      {/* Background Layer (Generated Image) */}
      {backgroundImage && (
        <img 
          src={backgroundImage} 
          alt="AI Projection Scene" 
          className="absolute inset-0 w-full h-full object-cover" 
        />
      )}
      
      {/* Interactive Canvas Layer */}
      <canvas 
        ref={canvasRef} 
        className={`absolute inset-0 w-full h-full ${effectMode !== 'reveal' ? 'mix-blend-screen' : ''}`} 
      />
    </div>
  );
}
