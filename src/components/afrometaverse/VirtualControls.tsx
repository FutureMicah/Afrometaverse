/**
 * Compact circular on-screen controls for mobile / touch / desktop overlay.
 * Reads layout from controlLayoutStore; writes live axes/buttons for PlayerController.
 */

import { useCallback, useEffect, useRef } from "react";
import {
  CONTROL_CATALOG,
  getControlDef,
  useControlLayoutStore,
  type ControlId,
  type PlacedControl,
} from "@/stores/controlLayoutStore";
import { useRoamStore } from "@/stores/roamStore";

type PointerMap = Map<number, { id: ControlId; originX: number; originY: number }>;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function Stick({
  placed,
  opacity,
  editMode,
  onPointerDown,
}: {
  placed: PlacedControl;
  opacity: number;
  editMode: boolean;
  onPointerDown: (e: React.PointerEvent, id: ControlId) => void;
}) {
  const def = getControlDef(placed.id);
  const size = def.baseSize * placed.scale;
  const knobRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const pointerId = useRef<number | null>(null);

  const setAxis = useControlLayoutStore((s) => s.setAxis);

  const release = useCallback(() => {
    active.current = false;
    pointerId.current = null;
    if (knobRef.current) {
      knobRef.current.style.transform = "translate(-50%, -50%)";
    }
    if (placed.id === "move") {
      setAxis("moveX", 0);
      setAxis("moveZ", 0);
    } else {
      setAxis("lookX", 0);
      setAxis("lookY", 0);
    }
  }, [placed.id, setAxis]);

  useEffect(() => {
    const up = (e: PointerEvent) => {
      if (pointerId.current !== null && e.pointerId === pointerId.current) release();
    };
    const move = (e: PointerEvent) => {
      if (!active.current || pointerId.current !== e.pointerId || !rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const maxR = rect.width * 0.32;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      if (len > maxR) {
        dx = (dx / len) * maxR;
        dy = (dy / len) * maxR;
      }
      if (knobRef.current) {
        knobRef.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      }
      const nx = dx / maxR;
      const ny = dy / maxR;
      if (placed.id === "move") {
        setAxis("moveX", nx);
        setAxis("moveZ", ny);
      } else {
        setAxis("lookX", nx);
        setAxis("lookY", ny);
      }
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("pointermove", move);
    };
  }, [placed.id, release, setAxis]);

  return (
    <div
      ref={rootRef}
      className={`am-vc-stick ${editMode ? "am-vc-edit" : ""}`}
      style={{
        left: `${placed.x}%`,
        bottom: `${placed.y}%`,
        width: size,
        height: size,
        opacity,
        touchAction: "none",
      }}
      onPointerDown={(e) => {
        if (editMode) {
          onPointerDown(e, placed.id);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        active.current = true;
        pointerId.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      aria-label={def.label}
    >
      <div className="am-vc-stick-ring" />
      <div ref={knobRef} className="am-vc-stick-knob">
        <span>{def.glyph}</span>
      </div>
    </div>
  );
}

function ActionButton({
  placed,
  opacity,
  editMode,
  onPointerDown,
}: {
  placed: PlacedControl;
  opacity: number;
  editMode: boolean;
  onPointerDown: (e: React.PointerEvent, id: ControlId) => void;
}) {
  const def = getControlDef(placed.id);
  const size = def.baseSize * placed.scale;
  const setButton = useControlLayoutStore((s) => s.setButton);
  const toggleMinimap = useRoamStore((s) => s.toggleMinimap);
  const held = useRef(false);

  const press = (down: boolean) => {
    if (editMode) return;
    held.current = down;
    const key = placed.id as "jump" | "sprint" | "crouch" | "interact" | "camera" | "fire" | "minimap";
    if (key === "minimap" && down) {
      toggleMinimap();
      return;
    }
    setButton(key, down);
  };

  return (
    <button
      type="button"
      className={`am-vc-btn ${editMode ? "am-vc-edit" : ""} ${held.current ? "am-vc-btn-active" : ""}`}
      style={{
        left: `${placed.x}%`,
        bottom: `${placed.y}%`,
        width: size,
        height: size,
        opacity,
        touchAction: "none",
      }}
      aria-label={def.label}
      onPointerDown={(e) => {
        if (editMode) {
          onPointerDown(e, placed.id);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        press(true);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={() => press(false)}
      onPointerCancel={() => press(false)}
      onPointerLeave={() => {
        if (held.current) press(false);
      }}
    >
      <span className="am-vc-btn-glyph">{def.glyph}</span>
      <span className="am-vc-btn-label">{def.label}</span>
    </button>
  );
}

export function VirtualControls({ forceShow = false }: { forceShow?: boolean }) {
  const layout = useControlLayoutStore((s) => s.layout);
  const editMode = useControlLayoutStore((s) => s.editMode);
  const showVirtualControls = useControlLayoutStore((s) => s.showVirtualControls);
  const opacity = useControlLayoutStore((s) => s.opacity);
  const setControlPos = useControlLayoutStore((s) => s.setControlPos);
  const persist = useControlLayoutStore((s) => s.persist);
  const clearInput = useControlLayoutStore((s) => s.clearInput);

  const dragRef = useRef<{
    id: ControlId;
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    return () => clearInput();
  }, [clearInput]);

  useEffect(() => {
    if (!editMode) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const parent = document.querySelector(".am-vc-layer") as HTMLElement | null;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dxPct = ((e.clientX - d.startX) / rect.width) * 100;
      const dyPct = ((d.startY - e.clientY) / rect.height) * 100; // bottom-based
      setControlPos(d.id, d.origX + dxPct, d.origY + dyPct);
    };
    const onUp = (e: PointerEvent) => {
      if (dragRef.current?.pointerId === e.pointerId) {
        dragRef.current = null;
        persist();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [editMode, setControlPos, persist]);

  if (!forceShow && !showVirtualControls && !editMode) return null;

  const visible = layout.filter((c) => c.visible || editMode);

  const onEditPointerDown = (e: React.PointerEvent, id: ControlId) => {
    e.preventDefault();
    e.stopPropagation();
    const placed = layout.find((c) => c.id === id);
    if (!placed) return;
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: placed.x,
      origY: placed.y,
    };
  };

  return (
    <div className={`am-vc-layer ${editMode ? "am-vc-layer-edit" : ""}`} aria-hidden={!editMode}>
      {editMode && (
        <div className="am-vc-edit-banner">
          Drag controls to move · Use the Controls settings panel to scale / add / remove
        </div>
      )}
      {visible.map((placed) => {
        const def = CONTROL_CATALOG.find((c) => c.id === placed.id);
        if (!def) return null;
        if (def.kind === "stick") {
          return (
            <Stick
              key={placed.id}
              placed={placed}
              opacity={opacity}
              editMode={editMode}
              onPointerDown={onEditPointerDown}
            />
          );
        }
        return (
          <ActionButton
            key={placed.id}
            placed={placed}
            opacity={opacity}
            editMode={editMode}
            onPointerDown={onEditPointerDown}
          />
        );
      })}
    </div>
  );
}

export default VirtualControls;
