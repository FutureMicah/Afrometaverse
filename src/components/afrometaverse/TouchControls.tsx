import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRoamStore } from "@/stores/roamStore";
import { resetTouchInput, touchInput } from "@/lib/touchInput";

/** Hold-to-press touch buttons. */
type HoldKey = "run" | "jump" | "crouch";

/** Joystick travel radius in CSS px before the knob saturates. */
const JOY_RADIUS = 56;
/** Fraction of the stick travel ignored so resting thumbs do not drift the player. */
const JOY_DEADZONE = 0.14;

/** True on touch-first devices (coarse primary pointer). Desktop never sees the overlay. */
export function useIsTouchDevice(): boolean {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mql.matches);
    update();
    mql.addEventListener?.("change", update);
    return () => mql.removeEventListener?.("change", update);
  }, []);
  return isTouch;
}

type JoyState = { active: boolean; ox: number; oy: number; kx: number; ky: number };

/**
 * On-screen controls for phones. Layout:
 * - left half: floating joystick (touch down anywhere on the left, drag to walk)
 * - right half: camera look drag (same yaw/pitch math as pointer lock)
 * - bottom-right cluster: hold RUN / JUMP / CROUCH, tap ENTER/EXIT and VIEW
 *
 * The look layer and the joystick layer are siblings of the buttons, not parents, and
 * use pointer capture, so a finger that starts on a button never moves the camera and a
 * finger that starts on the look area never presses a button.
 */
export function TouchControls() {
  const mountedVehicleId = useRoamStore((s) => s.mountedVehicleId);
  const nearVehicleId = useRoamStore((s) => s.nearVehicleId);
  const [joy, setJoy] = useState<JoyState>({ active: false, ox: 0, oy: 0, kx: 0, ky: 0 });
  const [pressed, setPressed] = useState<Partial<Record<HoldKey, boolean>>>({});
  const joyId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });

  useEffect(() => {
    resetTouchInput();
    const clear = () => {
      resetTouchInput();
      joyId.current = null;
      lookId.current = null;
      setJoy((j) => ({ ...j, active: false }));
      setPressed({});
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      resetTouchInput();
    };
  }, []);

  // ----- joystick (left) -----
  // Origin is kept in a ref (client coords) so move events never read a stale render.
  const joyOrigin = useRef({ x: 0, y: 0 });
  const onJoyDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joyId.current !== null) return;
    joyId.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    joyOrigin.current = { x: e.clientX, y: e.clientY };
    setJoy({
      active: true,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      kx: 0,
      ky: 0,
    });
  };
  const onJoyMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joyId.current) return;
    const rawX = e.clientX - joyOrigin.current.x;
    const rawY = e.clientY - joyOrigin.current.y;
    const dist = Math.hypot(rawX, rawY);
    const k = dist > JOY_RADIUS ? JOY_RADIUS / dist : 1;
    const kx = rawX * k;
    const ky = rawY * k;
    const mag = Math.hypot(kx, ky) / JOY_RADIUS;
    if (mag < JOY_DEADZONE) {
      touchInput.move.x = 0;
      touchInput.move.y = 0;
    } else {
      // Rescale so the usable travel starts at 0 past the deadzone and reaches 1 at the rim.
      const scaled = (mag - JOY_DEADZONE) / (1 - JOY_DEADZONE);
      const dir = scaled / mag;
      touchInput.move.x = (kx / JOY_RADIUS) * dir;
      touchInput.move.y = (ky / JOY_RADIUS) * dir;
    }
    setJoy((j) => ({ ...j, kx, ky }));
  };
  const onJoyEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joyId.current) return;
    joyId.current = null;
    touchInput.move.x = 0;
    touchInput.move.y = 0;
    setJoy({ active: false, ox: 0, oy: 0, kx: 0, ky: 0 });
  };

  // ----- camera look (right) -----
  const onLookDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (lookId.current !== null) return;
    lookId.current = e.pointerId;
    lookLast.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onLookMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookId.current) return;
    touchInput.lookDx += e.clientX - lookLast.current.x;
    touchInput.lookDy += e.clientY - lookLast.current.y;
    lookLast.current = { x: e.clientX, y: e.clientY };
  };
  const onLookEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookId.current) return;
    lookId.current = null;
  };

  // ----- buttons -----
  const holdProps = (key: HoldKey, apply: (on: boolean) => void) => {
    const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      apply(false);
      setPressed((p) => ({ ...p, [key]: false }));
    };
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        apply(true);
        setPressed((p) => ({ ...p, [key]: true }));
      },
      onPointerUp: release,
      onPointerCancel: release,
      onLostPointerCapture: release,
      onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
    };
  };

  const tapVehicle = () => {
    const st = useRoamStore.getState();
    if (st.mountedVehicleId) st.exitVehicle();
    else st.enterNearestVehicle();
  };
  const tapView = () => {
    touchInput.viewToggles += 1;
  };

  const vehicleLabel = mountedVehicleId ? "EXIT" : "ENTER";
  const vehicleDim = !mountedVehicleId && !nearVehicleId;

  return (
    <div className="am-touch-layer" aria-label="Touch controls">
      <div
        className="am-touch-zone am-touch-move"
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyEnd}
        onPointerCancel={onJoyEnd}
        onLostPointerCapture={onJoyEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {joy.active ? (
          <div className="am-touch-joy" style={{ left: joy.ox, top: joy.oy }}>
            <div className="am-touch-joy-knob" style={{ transform: `translate(${joy.kx}px, ${joy.ky}px)` }} />
          </div>
        ) : (
          <div className="am-touch-joy-hint" aria-hidden="true" />
        )}
      </div>

      <div
        className="am-touch-zone am-touch-look"
        onPointerDown={onLookDown}
        onPointerMove={onLookMove}
        onPointerUp={onLookEnd}
        onPointerCancel={onLookEnd}
        onLostPointerCapture={onLookEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="am-touch-look-hint">drag to look</span>
      </div>

      <div className="am-touch-buttons">
        <button
          type="button"
          className={`am-touch-btn am-touch-btn-vehicle ${vehicleDim ? "am-touch-btn-dim" : ""}`}
          aria-label={mountedVehicleId ? "Exit vehicle" : "Enter nearest vehicle"}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            tapVehicle();
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {vehicleLabel}
        </button>
        <button
          type="button"
          className="am-touch-btn am-touch-btn-view"
          aria-label="Toggle first or third person"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            tapView();
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          VIEW
        </button>
        <button
          type="button"
          className={`am-touch-btn am-touch-btn-crouch ${pressed.crouch ? "am-touch-btn-on" : ""}`}
          aria-label="Crouch (hold)"
          aria-pressed={!!pressed.crouch}
          {...holdProps("crouch", (on) => (touchInput.crouch = on))}
        >
          CROUCH
        </button>
        <button
          type="button"
          className={`am-touch-btn am-touch-btn-run ${pressed.run ? "am-touch-btn-on" : ""}`}
          aria-label="Run (hold)"
          aria-pressed={!!pressed.run}
          {...holdProps("run", (on) => (touchInput.sprint = on))}
        >
          RUN
        </button>
        <button
          type="button"
          className={`am-touch-btn am-touch-btn-jump ${pressed.jump ? "am-touch-btn-on" : ""}`}
          aria-label="Jump (hold)"
          aria-pressed={!!pressed.jump}
          {...holdProps("jump", (on) => (touchInput.jump = on))}
        >
          JUMP
        </button>
      </div>
    </div>
  );
}
