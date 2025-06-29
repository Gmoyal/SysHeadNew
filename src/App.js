import React, { useReducer } from "react";
import "./styles.css";

const pipeMaterials = {
  Copper: {
    c: 140,
    sizes: {
      0.5: 0.545,
      0.75: 0.785,
      1: 1.025,
      1.25: 1.265,
      1.5: 1.585,
      2: 2.045,
    },
  },
  "PVC Sch. 40": { c: 150, sizes: { 2: 2.067, 3: 3.068, 4: 4.026 } },
  "CPVC Sch. 80": {
    c: 130,
    sizes: { 2: 1.913, 3: 2.864, 4: 3.786, 6: 5.709, 8: 7.625 },
  },
  Steel: {
    c: 120,
    sizes: {
      0.5: 0.622,
      0.75: 0.824,
      1: 1.049,
      1.25: 1.38,
      1.5: 1.61,
      2: 2.067,
    },
  },
};

const fittingTypes = [
  "90° Elbow",
  "45° Elbow",
  "Tee (Run)",
  "Tee (Branch)",
  "Ball Valve",
  "Gate Valve",
  "Check Valve",
  "Reducer",
];
const defaultKValues = {
  "90° Elbow": 0.7,
  "45° Elbow": 0.4,
  "Tee (Run)": 0.6,
  "Tee (Branch)": 1.8,
  "Ball Valve": 0.05,
  "Gate Valve": 0.15,
  "Check Valve": 2,
  Reducer: 0.4,
};
function getFluidProps(type, pct) {
  if (type === "glycol") {
    if (pct <= 10) return { C: 130, density: 1.01 };
    if (pct <= 20) return { C: 120, density: 1.03 };
    if (pct <= 30) return { C: 110, density: 1.06 };
    if (pct <= 40) return { C: 100, density: 1.08 };
    return { C: 90, density: 1.1 };
  }
  return { C: 140, density: 0.998 };
}
function blankRun(material = "Copper") {
  return {
    id: Math.random().toString(36).slice(2, 10),
    material,
    size: "",
    length: "",
    fittings: Object.fromEntries(fittingTypes.map((f) => [f, ""])),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case "add": {
      const { material, size, length, fittings } = state.currentRun;
      if (!size || !length || isNaN(length) || Number(length) <= 0)
        return state;
      return {
        ...state,
        runs: [...state.runs, state.currentRun],
        currentRun: blankRun(material),
      };
    }
    case "remove": {
      return { ...state, runs: state.runs.filter((r) => r.id !== action.id) };
    }
    case "updateCurrent": {
      return { ...state, currentRun: { ...state.currentRun, ...action.up } };
    }
    case "updateFitting": {
      return {
        ...state,
        currentRun: {
          ...state.currentRun,
          fittings: { ...state.currentRun.fittings, [action.ft]: action.value },
        },
      };
    }
    case "setFlow":
      return { ...state, flow: action.flow };
    case "setFluid":
      return { ...state, fluid: action.fluid, pct: action.pct ?? state.pct };
    default:
      return state;
  }
}

function calcPipeRun(run, flow, props) {
  const mat = pipeMaterials[run.material];
  const d_in = mat.sizes[run.size];
  if (!d_in) return null;
  const d_ft = d_in / 12;
  const area = Math.PI * (d_ft / 2) ** 2;
  const q_cfs = flow / 448.831;
  const v = q_cfs / area;
  const C = props.C;
  const length = Number(run.length) || 0;
  const hL_100ft =
    (4.52 * Math.pow(flow, 1.85)) / (Math.pow(C, 1.85) * Math.pow(d_in, 4.87));
  const pipeHL = (hL_100ft * length) / 100;
  let totalK = 0;
  for (let ft of fittingTypes) {
    const count = Number(run.fittings[ft]) || 0;
    const K = defaultKValues[ft] || 0;
    totalK += count * K;
  }
  const g = 32.174;
  const fitHL = (totalK * v * v) / (2 * g);
  const headLoss = pipeHL + fitHL;
  const psiDrop = (headLoss * props.density * 62.4) / 144;
  return {
    ...run,
    d_in,
    velocity: v,
    headLoss,
    pressureDrop: psiDrop,
    totalK,
  };
}

function SystemDiagram({ runs }) {
  if (runs.length === 0)
    return (
      <div className="no-runs-hint" style={{ minHeight: 60 }}>
        <em>No pipe runs defined. Click "Add Pipe Run" to get started.</em>
      </div>
    );
  const W = 100 * runs.length + 40;
  return (
    <svg width={W} height={80} className="diagram-bg">
      <g>
        {runs.map((run, i) => {
          const x = 30 + i * 100;
          return (
            <g key={run.id}>
              <rect x={x} y={35} width={60} height={10} fill="#4b9ce2" />
              <text x={x + 30} y={60} textAnchor="middle" fontSize="12">
                {run.material} {run.size}"
              </text>
              {Object.entries(run.fittings)
                .filter(([_, n]) => Number(n) > 0)
                .map(([ft, n], j) => (
                  <circle
                    key={ft}
                    cx={x + 10 + j * 9}
                    cy={40}
                    r={4}
                    fill="#fa0"
                    stroke="#222"
                  >
                    <title>
                      {ft}: {n}
                    </title>
                  </circle>
                ))}
              {i === 0 && (
                <polygon
                  points={`${x - 15},40 ${x},35 ${x},45`}
                  fill="#10b981"
                />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, {
    runs: [],
    currentRun: blankRun(),
    flow: "",
    fluid: "water",
    pct: "",
  });
  const flowVal = Number(state.flow) || 0;
  const fluidProps = getFluidProps(state.fluid, Number(state.pct) || 0);
  const results = state.runs.map((run) =>
    calcPipeRun(run, flowVal, fluidProps)
  );
  const total = results.reduce(
    (acc, r) => ({
      velocity: Math.max(acc.velocity, r?.velocity || 0),
      headLoss: acc.headLoss + (r?.headLoss || 0),
      pressureDrop: acc.pressureDrop + (r?.pressureDrop || 0),
      totalK: acc.totalK + (r?.totalK || 0),
      length: acc.length + (Number(r?.length) || 0),
    }),
    { velocity: 0, headLoss: 0, pressureDrop: 0, totalK: 0, length: 0 }
  );

  const showSummary = state.runs.length > 0;

  return (
    <div className="main-bg">
      <div className="header-bar">
        <div className="header-bar__logo">
          <img src="/logo-maktinta.png" alt="Maktinta Energy" height={48} />
        </div>
        <div className="header-bar__title">
          <b>System Head Calculator</b>
        </div>
        <div className="header-bar__contact">
          <span style={{ marginRight: 12 }}>
            <a href="tel:4084329900" className="header-link">
              (408) 432-9900
            </a>
          </span>
          <span>
            <a
              href="https://www.maktinta.com"
              target="_blank"
              rel="noopener noreferrer"
              className="header-link"
            >
              www.maktinta.com
            </a>
          </span>
        </div>
      </div>
      <div className="flex-row main-flex">
        <div className="input-card input-card-narrow">
          <div className="input-card-title">Project Inputs</div>
          <label>
            Flow Rate (GPM)
            <input
              type="number"
              min={0.01}
              value={state.flow}
              placeholder="Flow (GPM)"
              onChange={(e) =>
                dispatch({ type: "setFlow", flow: e.target.value })
              }
            />
          </label>
          <label>
            Fluid
            <select
              value={state.fluid}
              onChange={(e) =>
                dispatch({ type: "setFluid", fluid: e.target.value })
              }
            >
              <option value="water">Water</option>
              <option value="glycol">Water-Glycol</option>
            </select>
          </label>
          {state.fluid === "glycol" && (
            <label>
              % Glycol
              <input
                type="number"
                min={0}
                max={60}
                value={state.pct}
                placeholder="% Glycol"
                onChange={(e) =>
                  dispatch({
                    type: "setFluid",
                    fluid: "glycol",
                    pct: e.target.value,
                  })
                }
              />
            </label>
          )}
          <div style={{ margin: "16px 0 8px" }}>
            <b>Pipe Runs</b>
            <button
              className="add-btn"
              onClick={() => dispatch({ type: "add" })}
              style={{ marginLeft: 10 }}
            >
              Add Pipe Run
            </button>
          </div>
          <div className="run-box">
            <div className="flex-row space">
              <span>Run {state.runs.length + 1}</span>
            </div>
            <div className="input-sub-row">
              <label>
                Material
                <select
                  value={state.currentRun.material}
                  onChange={(e) =>
                    dispatch({
                      type: "updateCurrent",
                      up: {
                        material: e.target.value,
                        size: "", // Reset size if material changes
                      },
                    })
                  }
                >
                  {Object.keys(pipeMaterials).map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Nominal Size (in)
                <select
                  value={state.currentRun.size}
                  onChange={(e) =>
                    dispatch({
                      type: "updateCurrent",
                      up: { size: e.target.value },
                    })
                  }
                  style={{ minWidth: 78 }}
                >
                  <option value="">Select size</option>
                  {Object.keys(pipeMaterials[state.currentRun.material].sizes)
                    .map(Number)
                    .sort((a, b) => a - b)
                    .map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Length (ft)
                <input
                  type="number"
                  min={1}
                  value={state.currentRun.length}
                  placeholder="Length (ft)"
                  onChange={(e) =>
                    dispatch({
                      type: "updateCurrent",
                      up: { length: e.target.value },
                    })
                  }
                  style={{ maxWidth: 120 }}
                />
              </label>
            </div>
            <div className="fit-row-box fit-row-col">
              <b>Fittings</b>
              <div className="fittings-horizontal-grid">
                {fittingTypes.map((ft) => (
                  <div className="fitting-item" key={ft}>
                    <label className="fitting-label">{ft}</label>
                    <input
                      type="number"
                      min={0}
                      value={state.currentRun.fittings[ft]}
                      className="fitting-input"
                      placeholder="0"
                      onChange={(e) =>
                        dispatch({
                          type: "updateFitting",
                          ft,
                          value: e.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="output-card output-card-wide">
          <div className="output-card-title">Summary & Results</div>
          {showSummary ? (
            <>
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Material</th>
                    <th>Size</th>
                    <th>Length (ft)</th>
                    <th>Velocity (ft/s)</th>
                    <th>Head Loss (ft)</th>
                    <th>Pressure Drop (psi)</th>
                    <th>Total K</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(
                    (r, i) =>
                      r && (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{r.material}</td>
                          <td>{r.size}</td>
                          <td>{r.length}</td>
                          <td>{r.velocity?.toFixed(2)}</td>
                          <td>{r.headLoss?.toFixed(2)}</td>
                          <td>{r.pressureDrop?.toFixed(2)}</td>
                          <td>{r.totalK?.toFixed(2)}</td>
                          <td>
                            <button
                              className="del-row-btn"
                              title="Delete Pipe Run"
                              onClick={() =>
                                dispatch({
                                  type: "remove",
                                  id: state.runs[i].id,
                                })
                              }
                            >
                              &#10006;
                            </button>
                          </td>
                        </tr>
                      )
                  )}
                  <tr className="total-row">
                    <td colSpan={4}>
                      <b>TOTAL</b>
                    </td>
                    <td>{total.velocity.toFixed(2)}</td>
                    <td>{total.headLoss.toFixed(2)}</td>
                    <td>{total.pressureDrop.toFixed(2)}</td>
                    <td>{total.totalK.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              <div style={{ margin: "18px 0 10px" }}>
                <b>System Diagram</b>
                <SystemDiagram runs={state.runs} />
              </div>
            </>
          ) : (
            <div
              style={{ padding: "24px", color: "#555", textAlign: "center" }}
            >
              <em>
                No pipe runs defined. Click "Add Pipe Run" to get started.
              </em>
            </div>
          )}
        </div>
      </div>
      <div className="footer-notes">
        <b>Calculation Notes:</b>
        <ul>
          <li>Uses Hazen-Williams and K-values from ASHRAE/Crane TP-410.</li>
          <li>All values are imperial units.</li>
          <li>Always verify results for your project and code compliance.</li>
        </ul>
      </div>
      <div className="disclaimer-bar">
        <span>
          <span style={{ color: "#be2222" }}>
            Disclaimer: This tool provides a preliminary estimate for
            informational purposes only. For a more accurate proposal,
            contact&nbsp;
          </span>
          <b style={{ color: "#114477" }}>Maktinta Energy</b>
          <span style={{ color: "#19498a" }}>
            {" "}
            at{" "}
            <a href="tel:4084329900" className="disclaimer-link">
              (408)-432-9900
            </a>
          </span>
          <span style={{ color: "#222" }}>
            {" "}
            or visit{" "}
            <a
              href="https://www.maktinta.com"
              target="_blank"
              rel="noopener noreferrer"
              className="disclaimer-link"
            >
              www.maktinta.com
            </a>
          </span>
        </span>
      </div>
    </div>
  );
}
