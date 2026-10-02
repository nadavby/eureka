import React, { useRef, useEffect, useState } from 'react';
import { eurekaPath, viewBox } from './eureka-logo-path';

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  color: string;
  scatteredColor: string;
  life: number;
  velocity: {
    x: number;
    y: number;
  };
}

const EurekaParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePositionRef = useRef({ x: 0, y: 0 });
  const isTouchingRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const letters = ['E', 'U', 'R', 'E', 'K', 'A'];
  const getLetterSpacing = (index: number) => {
    if (index === 4) return 10;
    return 15;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = Math.min(600, window.innerHeight * 0.6);
      setIsMobile(window.innerWidth < 768);
    };

    updateCanvasSize();

    let particles: Particle[] = [];
    let textImageData: ImageData | null = null;

    function createTextImage() {
      if (!ctx || !canvas) return 0;

      ctx.fillStyle = '#0d6efd';
      ctx.save();

      const logoHeight = isMobile ? 100 : Math.min(180, canvas.height * 0.5);
      const scale = isMobile ? 1.8 : 2.3;
      
      const totalWidth = letters.reduce((acc, letter, index) => {
        const [, , width] = viewBox[letter as keyof typeof viewBox].split(' ').map(Number);
        return acc + width + (index < letters.length - 1 ? getLetterSpacing(index + 1) : 0);
      }, 0);

      const startX = (canvas.width - totalWidth * scale) / 2;
      const startY = (canvas.height - logoHeight) / 2 + (canvas.height * 0.1);

      let currentX = startX;
      letters.forEach((letter, index) => {
        const path = new Path2D(eurekaPath[letter as keyof typeof eurekaPath]);
        const [, , width] = viewBox[letter as keyof typeof viewBox].split(' ').map(Number);
        
        ctx.save();
        ctx.translate(currentX, startY);
        ctx.scale(scale, scale);
        ctx.fill(path);
        ctx.restore();

        currentX += (width + getLetterSpacing(index + 1)) * scale;
      });

      textImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      return scale;
    }

    function createParticle(scale: number): Particle | null {
      if (!ctx || !canvas || !textImageData) return null;

      const data = textImageData.data;

      for (let attempt = 0; attempt < 100; attempt++) {
        const x = Math.floor(Math.random() * canvas.width);
        const y = Math.floor(Math.random() * canvas.height);

        if (data[(y * canvas.width + x) * 4 + 3] > 128) {
          return {
            x,
            y,
            baseX: x,
            baseY: y,
            size: Math.random() * 1.2 + 0.8,
            color: '#0d6efd',
            scatteredColor: '#00a3ff',
            life: Math.random() * 150 + 100,
            velocity: {
              x: (Math.random() - 0.5) * 0.3,
              y: (Math.random() - 0.5) * 0.3
            }
          };
        }
      }

      return null;
    }

    function createInitialParticles(scale: number) {
      const baseParticleCount = isMobile ? 3000 : 6000;
      const particleCount = Math.floor(baseParticleCount * Math.sqrt((canvas.width * canvas.height) / (1920 * 600)));
      for (let i = 0; i < particleCount; i++) {
        const particle = createParticle(scale);
        if (particle) particles.push(particle);
      }
    }

    let animationFrameId: number;
    let time = 0;

    function animate(scale: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 0.008;
      const { x: mouseX, y: mouseY } = mousePositionRef.current;
      const maxDistance = isMobile ? 120 : 180;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        p.x += Math.sin(time + p.baseX * 0.008) * 0.2 + p.velocity.x;
        p.y += Math.cos(time + p.baseY * 0.008) * 0.2 + p.velocity.y;

        if (distance < maxDistance && (isTouchingRef.current || !('ontouchstart' in window))) {
          const force = (maxDistance - distance) / maxDistance;
          const angle = Math.atan2(dy, dx);
          const moveX = Math.cos(angle) * force * 45;
          const moveY = Math.sin(angle) * force * 45;
          p.x = p.baseX - moveX;
          p.y = p.baseY - moveY;
          
          ctx.fillStyle = p.scatteredColor;
        } else {
          p.x += (p.baseX - p.x) * 0.03;
          p.y += (p.baseY - p.y) * 0.03;
          ctx.fillStyle = p.color;
        }

        ctx.fillRect(p.x, p.y, p.size, p.size);

        if (p.x < 0 || p.x > canvas.width || p.y < 0 || p.y > canvas.height) {
          p.x = p.baseX + (Math.random() - 0.5) * 10;
          p.y = p.baseY + (Math.random() - 0.5) * 10;
        }

        p.life--;
        if (p.life <= 0) {
          const newParticle = createParticle(scale);
          if (newParticle) {
            particles[i] = newParticle;
          } else {
            particles.splice(i, 1);
            i--;
          }
        }
      }

      const baseParticleCount = isMobile ? 3000 : 6000;
      const targetParticleCount = Math.floor(baseParticleCount * Math.sqrt((canvas.width * canvas.height) / (1920 * 600)));
      while (particles.length < targetParticleCount) {
        const newParticle = createParticle(scale);
        if (newParticle) particles.push(newParticle);
      }

      animationFrameId = requestAnimationFrame(() => animate(scale));
    }

    const scale = createTextImage();
    createInitialParticles(scale);
    animate(scale);

    const handleResize = () => {
      updateCanvasSize();
      const newScale = createTextImage();
      particles = [];
      createInitialParticles(newScale);
    };

    const handleMove = (x: number, y: number) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      mousePositionRef.current = {
        x: x - rect.left,
        y: y - rect.top
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchStart = () => {
      isTouchingRef.current = true;
    };

    const handleTouchEnd = () => {
      isTouchingRef.current = false;
      mousePositionRef.current = { x: 0, y: 0 };
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', () => {
      mousePositionRef.current = { x: 0, y: 0 };
    });
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', () => {
        mousePositionRef.current = { x: 0, y: 0 };
      });
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isMobile]);

  return (
    <div className="canvas-container">
      <canvas 
        ref={canvasRef}
        style={{ touchAction: 'none' }}
        aria-label="Interactive particle effect with Eureka logo"
      />
    </div>
  );
};

export default EurekaParticles; 