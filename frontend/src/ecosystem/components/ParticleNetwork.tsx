import { useEffect, useRef } from "react";

interface ParticleNetworkProps {
  size?: number;
  nodeCount?: number;
}

/**
 * Animated network graph for the "Reading your profile…" modal. Nodes float,
 * lines connect any pair within range, opacity falls off with distance.
 * Brand-colored, low CPU, no dependencies.
 */
export function ParticleNetwork({ size = 220, nodeCount = 22 }: ParticleNetworkProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      pulse: number;
    }

    const nodes: Node[] = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * size,
      y: Math.random() * size,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 1.6 + Math.random() * 1.4,
      pulse: Math.random() * Math.PI * 2,
    }));

    const linkRange = size * 0.32;
    let frame = 0;
    let raf = 0;

    const tick = () => {
      ctx.clearRect(0, 0, size, size);
      frame++;

      // update positions
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.04;
        if (n.x < 6 || n.x > size - 6) n.vx *= -1;
        if (n.y < 6 || n.y > size - 6) n.vy *= -1;
      }

      // draw edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < linkRange) {
            const t = 1 - dist / linkRange;
            ctx.strokeStyle = `rgba(8, 72, 184, ${0.08 + t * 0.45})`; // nucleus-blue
            ctx.lineWidth = 0.6 + t * 0.8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // draw nodes
      for (const n of nodes) {
        const pulseR = n.r + Math.sin(n.pulse) * 0.6;
        // halo
        ctx.fillStyle = "rgba(8, 72, 184, 0.14)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseR + 3, 0, Math.PI * 2);
        ctx.fill();
        // core — alternate blue / gold for character
        ctx.fillStyle = (frame + Math.floor(n.x + n.y)) % 7 === 0
          ? "#d89a36"
          : "#0848b8";
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [size, nodeCount]);

  return <canvas ref={canvasRef} style={{ display: "block" }} />;
}
