"use client";

import { useEffect, useRef } from "react";

type Mood = "happy" | "surprised" | "angry" | "shy";

export default function LoginCharacters({ mood }: { mood: Mood }) {
  const scene = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = scene.current;
    if (!svg) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let pointer: { x: number; y: number } | null = null;
    const update = () => {
      frame = 0;
      svg.querySelectorAll<SVGGElement>(".login-character-eye").forEach((eye) => {
        const pupil = eye.querySelector<SVGCircleElement>(".login-character-pupil");
        if (!pupil) return;
        const rect = eye.getBoundingClientRect();
        const dx = pointer ? pointer.x - rect.left - rect.width / 2 : 0;
        const dy = pointer ? pointer.y - rect.top - rect.height / 2 : 0;
        const distance = Math.hypot(dx, dy);
        const amount = Math.min(distance / 70, 5);
        pupil.style.transform = mood === "shy"
          ? "translate(-5px, -2px)"
          : `translate(${distance ? dx / distance * amount : 0}px, ${distance ? dy / distance * amount : 0}px)`;
      });
    };
    const move = (event: PointerEvent) => {
      if (reducedMotion.matches || event.pointerType === "touch") return;
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    };
    const reset = () => { pointer = null; update(); };
    const scroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("blur", reset);
    document.documentElement.addEventListener("pointerleave", reset);
    reducedMotion.addEventListener("change", reset);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("blur", reset);
      document.documentElement.removeEventListener("pointerleave", reset);
      reducedMotion.removeEventListener("change", reset);
    };
  }, [mood]);

  const face = (x: number, y: number, wide = 48, beak = false) => (
    <g className="login-character-face">
      {(beak ? [0] : [0, wide]).map((offset) => (
        <g className="login-character-eye" key={offset} transform={`translate(${x + offset} ${y})`}>
          <circle className="login-character-white" r="10" fill="#fffdf6" />
          <circle className="login-character-pupil" r="4.8" fill="#171423" />
          <path className="login-character-lid" d="M-9 0 Q0 6 9 0" />
          <path className={`login-character-brow ${offset ? "is-right" : ""}`} d="M-10 -16 L10 -11" />
        </g>
      ))}
      {beak ? (
        <rect className="login-character-smile" x={x + 18} y={y + 20} width="75" height="6" rx="2" />
      ) : (
        <path className="login-character-smile" d={`M${x + wide / 2 - 13} ${y + 26} q13 4 26 0 q-1 18 -13 18 q-12 0 -13 -18`} />
      )}
      <ellipse className="login-character-gasp" cx={x + wide / 2} cy={y + 34} rx="8" ry="11" />
      <path className="login-character-frown" d={`M${x + wide / 2 - 11} ${y + 36} q11 -12 22 0`} />
    </g>
  );

  return (
    <div className="login-characters" data-mood={mood} aria-hidden="true">
      <svg ref={scene} viewBox="0 0 460 390" fill="none">
        <ellipse cx="232" cy="369" rx="212" ry="13" fill="#081a30" opacity=".25" />
        <g className="login-character login-character-purple">
          <path d="M124 365 V30 Q124 24 130 24 H292 Q298 24 298 30 V365Z" fill="#7838ee" />
          <path d="M124 30V365H136V24H130Q124 24 124 30" fill="#5623bc" opacity=".4" />
          {face(203, 62, 48)}
        </g>
        <g className="login-character login-character-dark">
          <path d="M253 365V137H361V365Z" fill="#24232c" />
          <path d="M253 137H260V365H253Z" fill="#0d0d18" />
          {face(290, 159, 39)}
        </g>
        <g className="login-character login-character-orange">
          <path d="M18 365a144 144 0 0 1 288 0Z" fill="#ff802e" />
          {face(176, 282, 57)}
        </g>
        <g className="login-character login-character-yellow">
          <path d="M334 365V248a60 60 0 0 1 120 0V365Z" fill="#ffdb27" />
          {face(365, 244, 39, true)}
        </g>
      </svg>
    </div>
  );
}
