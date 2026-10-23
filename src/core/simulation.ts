import type {GameState} from "./types";

export const FOOD_PER_CREW_SECOND = 0.05;
export const GREENHOUSE_FOOD_PER_SECOND = 0.3;
export const LOW_FOOD = 5;
const STEP_MS = 250;

export function greenhouseWorking(state: GameState): boolean {
  const worker = state.crew.find(c => c.id === state.greenhouse.workerId);
  const {x, y, w, h} = state.greenhouse.area;
  return !!worker && !worker.path.length && worker.position.x >= x &&
    worker.position.x < x + w && worker.position.y >= y && worker.position.y < y + h;
}

/** Deterministic fixed steps keep resources and movement on the same clock. */
export class Simulation {
  private accumulator = 0;
  private clockAccumulator = 0;

  constructor(private state: GameState, private onChange: () => void = () => {}) {}

  advance(elapsedMs: number): void {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0 || !this.state.speed) return;
    this.accumulator += elapsedMs * this.state.speed;
    let changed = false;
    while (this.accumulator >= STEP_MS) {
      this.accumulator -= STEP_MS;
      const before = this.state.food;
      const production = greenhouseWorking(this.state) ? GREENHOUSE_FOOD_PER_SECOND : 0;
      const consumption = this.state.crew.length * FOOD_PER_CREW_SECOND;
      this.state.food = Math.max(0, Math.min(this.state.foodCapacity,
        before + (production - consumption) * STEP_MS / 1000));
      if (before > LOW_FOOD && this.state.food <= LOW_FOOD) {
        this.log("Réserves de nourriture faibles : affectez un membre à la serre.");
      }
      if (before > 0 && this.state.food === 0) {
        this.log("Nourriture épuisée ! La serre doit reprendre la production.");
      }
      changed = changed || this.state.food !== before;

      // Only a crew member present at the start of the step can produce.
      for (const crew of this.state.crew) {
        if (crew.path.length) {
          crew.position = crew.path.shift()!;
          changed = true;
        }
      }
      this.clockAccumulator += STEP_MS;
      if (this.clockAccumulator >= 1000) {
        this.state.time++;
        this.clockAccumulator -= 1000;
        changed = true;
      }
    }
    if (changed) this.onChange();
  }

  private log(message: string): void {
    this.state.logs = [message, ...this.state.logs].slice(0, 8);
  }
}
