import React, { useEffect, useRef } from 'react';

interface TransparentCameraVideoPopupProps {
  isOpen: boolean;
  onComplete: () => void;
}

// Shared singleton AudioContext unlocked on user's click of "Publish My Photo & Review"
let sharedAudioCtx: AudioContext | null = null;

export function unlockCameraAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Preloads the real studio photograph of the straight-front DSLR camera,
 * removes ONLY the exterior white studio background via outer-border flood fill
 * (preserving 100% of the real camera's metallic markings, leather texture, and lens glass),
 * and crops to the exact non-transparent bounding box so it is mathematically centered.
 */
let cachedCenteredCameraCanvas: HTMLCanvasElement | null = null;

function prepareCenteredRealCameraPhoto(onReady?: (canvas: HTMLCanvasElement) => void) {
  if (typeof document === 'undefined') return;
  if (cachedCenteredCameraCanvas) {
    onReady?.(cachedCenteredCameraCanvas);
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = '/real-dslr-front.jpg';
  img.onload = () => {
    const S = 560;
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = S;
    rawCanvas.height = S;
    const rawCtx = rawCanvas.getContext('2d', { willReadFrequently: true });
    if (!rawCtx) return;

    rawCtx.drawImage(img, 0, 0, S, S);
    const imgData = rawCtx.getImageData(0, 0, S, S);
    const data = imgData.data;

    const visited = new Uint8Array(S * S);
    const queue = new Int32Array(S * S);
    let head = 0;
    let tail = 0;

    const push = (x: number, y: number) => {
      if (x < 0 || x >= S || y < 0 || y >= S) return;
      const idx = y * S + x;
      if (visited[idx]) return;
      visited[idx] = 1;
      queue[tail++] = idx;
    };

    // Seed flood-fill from all 4 outer edges
    for (let x = 0; x < S; x++) {
      push(x, 0);
      push(x, S - 1);
    }
    for (let y = 0; y < S; y++) {
      push(0, y);
      push(S - 1, y);
    }

    const isWhiteStudioBg = (pixelIdx: number) => {
      const p = pixelIdx * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      const brightness = (r + g + b) / 3;
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      return brightness > 224 && maxDiff < 26;
    };

    while (head < tail) {
      const curr = queue[head++];
      if (isWhiteStudioBg(curr)) {
        data[curr * 4 + 3] = 0;
        const cx = curr % S;
        const cy = (curr / S) | 0;
        push(cx - 1, cy);
        push(cx + 1, cy);
        push(cx, cy - 1);
        push(cx, cy + 1);
      }
    }

    // Soften 1-2px boundary edge around the real camera contour for crisp anti-aliasing
    for (let y = 1; y < S - 1; y++) {
      for (let x = 1; x < S - 1; x++) {
        const idx = y * S + x;
        const p = idx * 4;
        if (data[p + 3] > 0) {
          const hasTransparentNeighbor =
            data[((y - 1) * S + x) * 4 + 3] === 0 ||
            data[((y + 1) * S + x) * 4 + 3] === 0 ||
            data[(y * S + (x - 1)) * 4 + 3] === 0 ||
            data[(y * S + (x + 1)) * 4 + 3] === 0;
          if (hasTransparentNeighbor) {
            const brightness = (data[p] + data[p + 1] + data[p + 2]) / 3;
            if (brightness > 185) {
              const smoothAlpha = Math.max(0, Math.min(255, ((232 - brightness) / 47) * 255));
              data[p + 3] = Math.round(smoothAlpha);
            }
          }
        }
      }
    }

    rawCtx.putImageData(imgData, 0, 0);

    // Compute exact bounding box of non-transparent camera pixels so it is 100% centered
    let minX = S;
    let minY = S;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (data[(y * S + x) * 4 + 3] > 25) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX <= minX || maxY <= minY) {
      cachedCenteredCameraCanvas = rawCanvas;
      onReady?.(rawCanvas);
      return;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;
    const outSide = Math.max(cropW, cropH);

    const centeredCanvas = document.createElement('canvas');
    centeredCanvas.width = outSide;
    centeredCanvas.height = outSide;
    const centeredCtx = centeredCanvas.getContext('2d');
    if (centeredCtx) {
      const destX = Math.round((outSide - cropW) / 2);
      const destY = Math.round((outSide - cropH) / 2);
      centeredCtx.drawImage(rawCanvas, minX, minY, cropW, cropH, destX, destY, cropW, cropH);
      cachedCenteredCameraCanvas = centeredCanvas;
      onReady?.(centeredCanvas);
    }
  };
}

// Kick off preload immediately in browser
if (typeof window !== 'undefined') {
  prepareCenteredRealCameraPhoto();
}

/**
 * Generates authentic DSLR autofocus double-beep, mechanical mirror + shutter
 * capture sound ("KA-CHICK!"), and modern reveal chime.
 */
function createCameraSoundController() {
  const getCtx = () => unlockCameraAudio();

  return {
    playFocusLockBeep() {
      const audioCtx = getCtx();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      [0, 0.09].forEach((offset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2950, now + offset);

        gain.gain.setValueAtTime(0.001, now + offset);
        gain.gain.linearRampToValueAtTime(0.24, now + offset + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.065);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.07);
      });
    },

    playShutterAndFlash() {
      const audioCtx = getCtx();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      const triggerMechanicalSnap = (
        offsetSec: number,
        durationSec: number,
        bandFreq: number,
        bodyFreq: number,
        volume: number
      ) => {
        const start = now + offsetSec;
        const sampleCount = Math.floor(audioCtx.sampleRate * durationSec);
        const buffer = audioCtx.createBuffer(1, sampleCount, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < sampleCount; i++) {
          const env = Math.exp(-i / (sampleCount * 0.22));
          data[i] = (Math.random() * 2 - 1) * env;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const bandpass = audioCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(bandFreq, start);
        bandpass.Q.setValueAtTime(1.4, start);

        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(volume, start);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, start + durationSec);

        noise.connect(bandpass);
        bandpass.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        noise.start(start);

        const bodyOsc = audioCtx.createOscillator();
        const bodyGain = audioCtx.createGain();
        bodyOsc.type = 'triangle';
        bodyOsc.frequency.setValueAtTime(bodyFreq, start);
        bodyOsc.frequency.exponentialRampToValueAtTime(45, start + durationSec * 0.9);

        bodyGain.gain.setValueAtTime(volume * 0.78, start);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, start + durationSec * 0.9);

        bodyOsc.connect(bodyGain);
        bodyGain.connect(audioCtx.destination);
        bodyOsc.start(start);
        bodyOsc.stop(start + durationSec);
      };

      // Mirror flip up + 1st curtain ("KA-")
      triggerMechanicalSnap(0, 0.045, 2400, 220, 0.9);
      triggerMechanicalSnap(0.012, 0.03, 4800, 340, 0.7);

      // 2nd curtain + mirror return ("-CHICK!")
      triggerMechanicalSnap(0.068, 0.055, 3100, 185, 1.0);
      triggerMechanicalSnap(0.082, 0.035, 5600, 290, 0.75);
    },

    playModernRevealChime() {
      const audioCtx = getCtx();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;

      const chord = [587.33, 880.0, 1174.66, 1760.0];
      chord.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        const start = now + idx * 0.055;
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.65);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.7);
      });
    },
  };
}

export const TransparentCameraVideoPopup: React.FC<TransparentCameraVideoPopupProps> = ({
  isOpen,
  onComplete,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isOpen) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cameraCanvas: HTMLCanvasElement | null = cachedCenteredCameraCanvas;
    if (!cameraCanvas) {
      prepareCenteredRealCameraPhoto((readyCanvas) => {
        cameraCanvas = readyCanvas;
      });
    }

    const sound = createCameraSoundController();
    let playedFocusBeep = false;
    let playedShutter = false;
    let playedRevealChime = false;

    const DURATION_MS = 5400; // Plays 1 time cleanly and exits
    const startTime = performance.now();
    let rafId = 0;
    let finished = false;

    const renderFrame = (now: number) => {
      if (finished) return;
      const elapsed = now - startTime;
      const t = elapsed / 1000;

      if (elapsed >= DURATION_MS) {
        finished = true;
        onCompleteRef.current();
        return;
      }

      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Master fade-in (0 - 0.28s) and fade-out (4.8 - 5.4s)
      let masterAlpha = 1;
      if (t < 0.28) {
        masterAlpha = t / 0.28;
      } else if (t > 4.8) {
        masterAlpha = Math.max(0, 1 - (t - 4.8) / 0.6);
      }

      ctx.save();
      ctx.globalAlpha = masterAlpha;

      // 1. DSLR Autofocus Double-Beep at t = 0.75s
      if (t >= 0.75 && !playedFocusBeep) {
        playedFocusBeep = true;
        sound.playFocusLockBeep();
      }

      // 2. Mechanical DSLR Picture Capture Sound ("KA-CHICK!") at t = 1.35s
      if (t >= 1.35 && !playedShutter) {
        playedShutter = true;
        sound.playShutterAndFlash();
      }

      // 3. Modern Text Reveal Chime at t = 1.9s
      if (t >= 1.9 && !playedRevealChime) {
        playedRevealChime = true;
        sound.playModernRevealChime();
      }

      // Centered Real Front-Facing DSLR Camera Animation
      const camEnter = Math.min(1, t / 0.42);
      const camEase = 1 - Math.pow(1 - camEnter, 3);
      const shutterKick =
        t >= 1.35 && t <= 1.58 ? Math.sin(((t - 1.35) / 0.23) * Math.PI) * 0.038 : 0;
      const camScale = 0.86 + 0.14 * camEase - shutterKick;
      const camCenterX = W / 2;
      const camCenterY = H * 0.37 + (1 - camEase) * 20;

      // Pop-up flash unit rises above the real DSLR prism between t = 0.65s and t = 1.1s
      const flashPopupProgress = Math.max(0, Math.min(1, (t - 0.65) / 0.4));
      const flashPopupEase = 1 - Math.pow(1 - flashPopupProgress, 3);

      ctx.save();
      ctx.translate(camCenterX, camCenterY);
      ctx.scale(camScale, camScale);

      // Realistic Pop-Up Xenon Flash emerging from the top of the DSLR pentaprism
      if (flashPopupEase > 0) {
        const liftY = flashPopupEase * 44;
        ctx.save();
        ctx.translate(0, -112 - liftY);

        // Dual metallic support arms
        ctx.strokeStyle = '#1C1C21';
        ctx.lineWidth = 5.5;
        ctx.beginPath();
        ctx.moveTo(-24, 38);
        ctx.lineTo(-18, 8);
        ctx.moveTo(24, 38);
        ctx.lineTo(18, 8);
        ctx.stroke();

        // Matte black DSLR flash head casing
        const flashGrad = ctx.createLinearGradient(0, -28, 0, 14);
        flashGrad.addColorStop(0, '#27272A');
        flashGrad.addColorStop(1, '#09090B');
        ctx.fillStyle = flashGrad;
        ctx.strokeStyle = '#3F3F46';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-42, -26, 84, 40, 8);
        ctx.fill();
        ctx.stroke();

        // Xenon flash diffuser glass
        ctx.fillStyle = t >= 1.35 && t <= 1.75 ? '#FFFFFF' : '#E2E8F0';
        ctx.beginPath();
        ctx.roundRect(-33, -18, 66, 24, 4);
        ctx.fill();

        // Fresnel vertical diffuser lines
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
        ctx.lineWidth = 1;
        for (let gx = -24; gx <= 24; gx += 6) {
          ctx.beginPath();
          ctx.moveTo(gx, -18);
          ctx.lineTo(gx, 6);
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw the Real Straight-Front DSLR Photograph (mathematically centered in its bounding box)
      const camSize = 310;
      if (cameraCanvas) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 14;
        ctx.drawImage(cameraCanvas, -camSize / 2, -camSize / 2, camSize, camSize);
        ctx.restore();
      }

      // Subtle Green Autofocus Lock Ring inside the real front lens (t = 0.75s - 1.28s)
      if (t >= 0.75 && t <= 1.28) {
        const afPulse = 0.55 + 0.45 * Math.sin((t - 0.75) * 30);
        ctx.save();
        ctx.strokeStyle = `rgba(74, 222, 128, ${afPulse})`;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 14, 42, -0.35, 0.95);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 14, 42, Math.PI - 0.35, Math.PI + 0.95);
        ctx.stroke();
        ctx.restore();
      }

      // Mechanical Shutter Curtain & Iris Snap inside the real lens at capture (t = 1.32s - 1.68s)
      if (t >= 1.32 && t <= 1.68) {
        const snap =
          t < 1.46 ? (t - 1.32) / 0.14 : Math.max(0, 1 - (t - 1.46) / 0.22);
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 14, 52, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(12, 13, 17, ${0.88 * snap})`;
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      // Modern Typography Reveal centered directly below the Real DSLR Camera (t >= 1.78s)
      const drawModernLine = (
        text: string,
        yPos: number,
        startSec: number,
        durationSec: number,
        font: string,
        fillColor: string
      ) => {
        if (t < startSec) return;
        const p = Math.max(0, Math.min(1, (t - startSec) / durationSec));
        const easeOut = 1 - Math.pow(1 - p, 4);
        const yOffset = (1 - easeOut) * 22;
        const scale = 0.94 + 0.06 * easeOut;

        ctx.save();
        ctx.translate(W / 2, yPos + yOffset);
        ctx.scale(scale, scale);
        ctx.globalAlpha = masterAlpha * easeOut;
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = 'rgba(74, 21, 37, 0.38)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = fillColor;
        ctx.fillText(text, 0, 0);
        ctx.restore();
      };

      // Line 1: "We Got it framed"
      drawModernLine(
        'We Got it framed',
        H * 0.67,
        1.78,
        0.52,
        '700 38px "Plus Jakarta Sans", sans-serif',
        '#FFFFFF'
      );

      // Line 2: "on our Website,"
      drawModernLine(
        'on our Website,',
        H * 0.745,
        1.96,
        0.55,
        '700 38px "Plus Jakarta Sans", sans-serif',
        '#FFFFFF'
      );

      // Line 3: "Thanks for Choosing LOL."
      drawModernLine(
        'Thanks for Choosing LOL.',
        H * 0.825,
        2.26,
        0.62,
        '600 25px "Plus Jakarta Sans", sans-serif',
        '#FBCFE8'
      );

      // Camera Flash Burst at Picture Capture (t = 1.36s - 1.88s)
      if (t >= 1.36 && t <= 1.88) {
        const flashIntensity =
          t < 1.45
            ? (t - 1.36) / 0.09
            : Math.pow(Math.max(0, 1 - (t - 1.45) / 0.43), 2);
        const grad = ctx.createRadialGradient(
          camCenterX,
          camCenterY - 15,
          12,
          camCenterX,
          camCenterY,
          W * 0.85
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, flashIntensity * 1.3)})`);
        grad.addColorStop(0.55, `rgba(255, 240, 248, ${flashIntensity * 0.95})`);
        grad.addColorStop(1, 'rgba(255, 240, 248, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);

    return () => {
      finished = true;
      cancelAnimationFrame(rafId);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center p-4 sm:p-6 bg-[#881337]/80 backdrop-blur-sm transition-opacity duration-300"
    >
      <canvas
        ref={canvasRef}
        width={640}
        height={680}
        className="w-[min(88vw,460px)] max-h-[84dvh] aspect-[16/17] object-contain mx-auto my-auto bg-transparent border-0 shadow-none outline-none pointer-events-none"
      />
    </div>
  );
};
