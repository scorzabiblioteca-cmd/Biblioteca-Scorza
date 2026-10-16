"use client";

import { useEffect, useRef } from "react";

type Mood = "happy" | "surprised" | "password" | "angry" | "shy";

export default function LoginCharacters({ mood }: { mood: Mood }) {
  const scene = useRef<SVGSVGElement>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const svg = scene.current;
    if (!svg) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const update = () => {
      frame = 0;
      const pointer = reducedMotion.matches ? null : lastPointer.current;
      const bounds = svg.getBoundingClientRect();
      const x = pointer ? Math.max(-1, Math.min(1, (pointer.x - bounds.left - bounds.width / 2) / bounds.width)) : 0;
      const y = pointer ? Math.max(-1, Math.min(1, (pointer.y - bounds.top - bounds.height / 2) / bounds.height)) : 0;
      svg.style.setProperty("--look-x", `${x * 16}px`);
      svg.style.setProperty("--look-y", `${y * 10}px`);
      svg.style.setProperty("--lean", `${-x * 5}deg`);
      svg.querySelectorAll<SVGGElement>(".login-character-eye").forEach((eye) => {
        const pupil = eye.querySelector<SVGCircleElement>(".login-character-pupil");
        if (!pupil) return;
        const rect = eye.getBoundingClientRect();
        const dx = pointer ? pointer.x - rect.left - rect.width / 2 : 0;
        const dy = pointer ? pointer.y - rect.top - rect.height / 2 : 0;
        const distance = Math.hypot(dx, dy);
        const amount = Math.min(distance / 65, 3);
        pupil.style.transform = mood === "shy"
          ? "translate(3px, 0px)"
          : `translate(${distance ? dx / distance * amount : 0}px, ${distance ? dy / distance * amount : 0}px)`;
      });
    };
    const move = (event: PointerEvent) => {
      if (reducedMotion.matches || event.pointerType === "touch") return;
      lastPointer.current = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    };
    const reset = () => {
      lastPointer.current = null;
      cancelAnimationFrame(frame);
      update();
    };
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

  const face = (x: number, y: number, wide = 48, kind: "purple" | "dark" | "orange" | "yellow" = "purple") => (
    <g className="login-character-face">
      {(kind === "yellow" ? [0] : [0, wide]).map((offset) => (
        <g className="login-character-eye" key={offset} transform={`translate(${x + offset} ${y})`}>
          <g className="login-character-blink">
            <circle className="login-character-white" r={kind === "dark" ? 8 : 6} fill="#fffdf6" />
            <circle className="login-character-pupil" r={kind === "dark" ? 4 : 3.5} fill="#171423" />
          </g>
          <path className="login-character-lid" d="M-6 0 Q0 -5 6 0" />
          <path className={`login-character-brow ${offset ? "is-right" : ""}`} d="M-7 -12 L7 -8" />
        </g>
      ))}
      {kind === "yellow" ? (
        <rect className="login-character-smile" x={x - 2} y={y + 20} width="75" height="5" rx="2" />
      ) : (
        <path className="login-character-smile" d={`M${x + wide / 2 - 7} ${y + 12} q7 3 14 0 q-1 10 -7 10 q-6 0 -7 -10`} />
      )}
      <ellipse className="login-character-gasp" cx={x + wide / 2} cy={y + 20} rx="4" ry="7" />
      <path className="login-character-frown" d={`M${x + wide / 2 - 8} ${y + 22} q8 -9 16 0`} />
    </g>
  );

  return (
    <div className="login-characters" data-mood={mood} aria-hidden="true">
      <svg ref={scene} viewBox="0 0 500 430" fill="none">
        <g transform="translate(8 35)">
        <ellipse cx="232" cy="369" rx="212" ry="13" fill="#081a30" opacity=".25" />
        <g className="login-character-entry login-entry-purple"><g className="login-character login-character-purple">
          <path className="login-character-body" d={mood === "password"
            ? "M124 365 L148 204 L104 120 L124 24 L298 24 L278 120 L320 204 L298 365Z"
            : "M124 365 L124 204 L124 120 L124 24 L298 24 L298 120 L298 204 L298 365Z"} fill="#6817f5" />
          {face(197, 56, 48)}
        </g></g>
        <g className="login-character-entry login-entry-dark"><g className="login-character login-character-dark">
          <path d="M253 365V137H361V365Z" fill="#24232c" />
          <path d="M253 137H260V365H253Z" fill="#0d0d18" />
          {face(281, 159, 31, "dark")}
        </g></g>
        <g className="login-character-entry login-entry-orange"><g className="login-character login-character-orange">
          <path d="M18 365a144 144 0 0 1 288 0Z" fill="#ff802e" />
          {face(139, 293, 49, "orange")}
        </g></g>
        <g className="login-character-entry login-entry-yellow"><g className="login-character login-character-yellow">
          <path d="M334 365V248a60 60 0 0 1 120 0V365Z" fill="#ffdb27" />
          {face(374, 235, 25, "yellow")}
        </g></g>
        </g>
      </svg>
    </div>
  );
}
