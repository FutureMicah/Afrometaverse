/**
 * Settings: on-screen touch control prefs + camera / look settings.
 */

import { useState } from "react";
import {
  CONTROL_CATALOG,
  useControlLayoutStore,
  type ControlId,
} from "@/stores/controlLayoutStore";
import { useCameraSettingsStore } from "@/stores/cameraSettingsStore";

type Tab = "onscreen" | "camera";

export function ControlEditor() {
  const [tab, setTab] = useState<Tab>("camera");

  return (
    <div className="am-controls-editor">
      <div className="am-settings-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`am-settings-tab ${tab === "camera" ? "am-settings-tab-active" : ""}`}
          aria-selected={tab === "camera"}
          onClick={() => setTab("camera")}
        >
          Camera
        </button>
        <button
          type="button"
          role="tab"
          className={`am-settings-tab ${tab === "onscreen" ? "am-settings-tab-active" : ""}`}
          aria-selected={tab === "onscreen"}
          onClick={() => setTab("onscreen")}
        >
          On-screen controls
        </button>
      </div>
      {tab === "camera" ? <CameraSettingsPanel /> : <OnScreenControlsPanel />}
    </div>
  );
}

function CameraSettingsPanel() {
  const lookSensitivity = useCameraSettingsStore((s) => s.lookSensitivity);
  const touchSensitivity = useCameraSettingsStore((s) => s.touchSensitivity);
  const invertY = useCameraSettingsStore((s) => s.invertY);
  const tpsFov = useCameraSettingsStore((s) => s.tpsFov);
  const fpsFov = useCameraSettingsStore((s) => s.fpsFov);
  const showFpsBody = useCameraSettingsStore((s) => s.showFpsBody);
  const fpsLegVisibility = useCameraSettingsStore((s) => s.fpsLegVisibility);
  const setLookSensitivity = useCameraSettingsStore((s) => s.setLookSensitivity);
  const setTouchSensitivity = useCameraSettingsStore((s) => s.setTouchSensitivity);
  const setInvertY = useCameraSettingsStore((s) => s.setInvertY);
  const setTpsFov = useCameraSettingsStore((s) => s.setTpsFov);
  const setFpsFov = useCameraSettingsStore((s) => s.setFpsFov);
  const setShowFpsBody = useCameraSettingsStore((s) => s.setShowFpsBody);
  const setFpsLegVisibility = useCameraSettingsStore((s) => s.setFpsLegVisibility);
  const resetCamera = useCameraSettingsStore((s) => s.resetCamera);
  const persist = useCameraSettingsStore((s) => s.persist);

  const save = () => persist();

  return (
    <div className="am-controls-editor-body">
      <header className="am-controls-editor-head">
        <h2>Camera & look</h2>
        <p className="am-note">
          Mouse and touch look sensitivity, FOV, and first-person body (hands while you walk, legs when
          you look down).
        </p>
      </header>

      <section className="am-controls-section">
        <h3>Look sensitivity</h3>
        <label className="am-controls-row">
          <span>Mouse</span>
          <input
            type="range"
            min={35}
            max={260}
            value={Math.round(lookSensitivity * 100)}
            onChange={(e) => {
              setLookSensitivity(Number(e.target.value) / 100);
              save();
            }}
          />
          <em>{lookSensitivity.toFixed(2)}×</em>
        </label>
        <label className="am-controls-row">
          <span>Touch</span>
          <input
            type="range"
            min={35}
            max={260}
            value={Math.round(touchSensitivity * 100)}
            onChange={(e) => {
              setTouchSensitivity(Number(e.target.value) / 100);
              save();
            }}
          />
          <em>{touchSensitivity.toFixed(2)}×</em>
        </label>
        <label className="am-controls-toggle">
          <input
            type="checkbox"
            checked={invertY}
            onChange={(e) => {
              setInvertY(e.target.checked);
              save();
            }}
          />
          <span>Invert look Y</span>
        </label>
      </section>

      <section className="am-controls-section">
        <h3>Field of view</h3>
        <label className="am-controls-row">
          <span>3rd person</span>
          <input
            type="range"
            min={35}
            max={75}
            value={tpsFov}
            onChange={(e) => {
              setTpsFov(Number(e.target.value));
              save();
            }}
          />
          <em>{Math.round(tpsFov)}°</em>
        </label>
        <label className="am-controls-row">
          <span>1st person</span>
          <input
            type="range"
            min={50}
            max={100}
            value={fpsFov}
            onChange={(e) => {
              setFpsFov(Number(e.target.value));
              save();
            }}
          />
          <em>{Math.round(fpsFov)}°</em>
        </label>
      </section>

      <section className="am-controls-section">
        <h3>First-person body</h3>
        <p className="am-note">
          Through the character&apos;s eyes: hands swing as you walk or run. Look down to see your
          legs, the way real eyes do.
        </p>
        <label className="am-controls-toggle">
          <input
            type="checkbox"
            checked={showFpsBody}
            onChange={(e) => {
              setShowFpsBody(e.target.checked);
              save();
            }}
          />
          <span>Show hands &amp; legs in first-person (V)</span>
        </label>
        <label className="am-controls-row">
          <span>Leg amount</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(fpsLegVisibility * 100)}
            onChange={(e) => {
              setFpsLegVisibility(Number(e.target.value) / 100);
              save();
            }}
          />
          <em>{Math.round(fpsLegVisibility * 100)}%</em>
        </label>
      </section>

      <div className="am-controls-actions">
        <button type="button" className="am-btn am-btn-ghost" onClick={() => resetCamera()}>
          Reset camera defaults
        </button>
      </div>
    </div>
  );
}

function OnScreenControlsPanel() {
  const layout = useControlLayoutStore((s) => s.layout);
  const showVirtualControls = useControlLayoutStore((s) => s.showVirtualControls);
  const opacity = useControlLayoutStore((s) => s.opacity);
  const setShowVirtualControls = useControlLayoutStore((s) => s.setShowVirtualControls);
  const setOpacity = useControlLayoutStore((s) => s.setOpacity);
  const setControlScale = useControlLayoutStore((s) => s.setControlScale);
  const setControlVisible = useControlLayoutStore((s) => s.setControlVisible);
  const addControl = useControlLayoutStore((s) => s.addControl);
  const removeControl = useControlLayoutStore((s) => s.removeControl);
  const resetLayout = useControlLayoutStore((s) => s.resetLayout);
  const persist = useControlLayoutStore((s) => s.persist);

  const byId = new Map(layout.map((c) => [c.id, c]));

  return (
    <div className="am-controls-editor-body">
      <header className="am-controls-editor-head">
        <h2>On-screen controls</h2>
        <p className="am-note">
          Compact circular pads for touch play. Size and visibility preferences are stored on this
          device.
        </p>
      </header>

      <section className="am-controls-section">
        <h3>Display</h3>
        <label className="am-controls-toggle">
          <input
            type="checkbox"
            checked={showVirtualControls}
            onChange={(e) => setShowVirtualControls(e.target.checked)}
          />
          <span>Prefer compact circular overlay styling</span>
        </label>
        <label className="am-controls-row">
          <span>Opacity</span>
          <input
            type="range"
            min={25}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => {
              setOpacity(Number(e.target.value) / 100);
              persist();
            }}
          />
          <em>{Math.round(opacity * 100)}%</em>
        </label>
        <div className="am-controls-actions">
          <button
            type="button"
            className="am-btn am-btn-ghost"
            onClick={() => {
              resetLayout();
              persist();
            }}
          >
            Reset layout
          </button>
          <button type="button" className="am-btn am-btn-ghost" onClick={() => persist()}>
            Save
          </button>
        </div>
      </section>

      <section className="am-controls-section">
        <h3>Buttons</h3>
        <ul className="am-controls-list">
          {CONTROL_CATALOG.map((def) => {
            const placed = byId.get(def.id);
            if (!placed) return null;
            const onScreen = placed.visible;
            return (
              <li key={def.id} className={`am-controls-item ${onScreen ? "" : "am-controls-item-off"}`}>
                <div className="am-controls-item-main">
                  <span className="am-controls-glyph" aria-hidden>
                    {def.glyph}
                  </span>
                  <div>
                    <strong>{def.label}</strong>
                    <small>
                      {def.kind === "stick" ? "Joystick" : "Button"} ·{" "}
                      {Math.round(def.baseSize * placed.scale)}px
                    </small>
                  </div>
                </div>
                <div className="am-controls-item-tools">
                  <label className="am-controls-scale">
                    <span>Size</span>
                    <input
                      type="range"
                      min={55}
                      max={160}
                      value={Math.round(placed.scale * 100)}
                      onChange={(e) => {
                        setControlScale(def.id as ControlId, Number(e.target.value) / 100);
                        persist();
                      }}
                    />
                  </label>
                  {onScreen ? (
                    <button
                      type="button"
                      className="am-btn am-btn-ghost am-btn-sm"
                      onClick={() => {
                        removeControl(def.id as ControlId);
                        persist();
                      }}
                    >
                      Remove
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="am-btn am-btn-secondary am-btn-sm"
                      onClick={() => {
                        addControl(def.id as ControlId);
                        persist();
                      }}
                    >
                      Add
                    </button>
                  )}
                  <label className="am-controls-toggle am-controls-toggle-inline">
                    <input
                      type="checkbox"
                      checked={onScreen}
                      onChange={(e) => {
                        setControlVisible(def.id as ControlId, e.target.checked);
                        persist();
                      }}
                    />
                    <span>On</span>
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

export default ControlEditor;
