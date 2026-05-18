/**
 * MarketAnalysisMLEngine
 *
 * Pure-JavaScript machine learning engine — no external dependencies.
 * Runs entirely in the browser alongside the existing analysis service.
 *
 * Components:
 *  1. DigitNeuralNetwork — 2-hidden-layer feedforward NN trained online with
 *     backpropagation + SGD. Predicts P(next digit is even) and P(price rises).
 *  2. EnsembleVoter — tracks rolling prediction accuracy per formula and derives
 *     proportional weights. Formulas that have been right recently get more say.
 *  3. extractMLFeatures — converts a price buffer into a 12-feature vector.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export const ENSEMBLE_KEYS = [
    'chi_square',
    'z_score',
    'markov',
    'runs_test',
    'rsi_eo',
    'binomial',
    'mwc',
    'neural_net',
] as const;

export type EnsembleKey = (typeof ENSEMBLE_KEYS)[number];

export const ENSEMBLE_LABELS: Record<EnsembleKey, string> = {
    chi_square: 'Chi-Square',
    z_score: 'Z-Score',
    markov: 'Markov Chain',
    runs_test: 'Runs Test',
    rsi_eo: 'Digit RSI (E/O)',
    binomial: 'Binomial Test',
    mwc: 'Multi-Window',
    neural_net: 'Neural Network',
};

export interface MLPrediction {
    evenProb: number; // 0–1: NN P(next digit is even)
    riseProb: number; // 0–1: NN P(price rises next tick)
    trainingTicks: number; // how many ticks the NN has been trained on
    nnAccuracy: number; // rolling NN accuracy for even/odd (0–1)
    accuracies: Record<EnsembleKey, number>; // per-formula rolling accuracy
    weights: Record<EnsembleKey, number>; // derived ensemble weight
    ensembleEvenProb: number; // 0–1: weighted ensemble probability for Even
    ensembleEvenScore: number; // 0–100: confidence for dominant side
}

// ─── Neural Network ───────────────────────────────────────────────────────────

/**
 * Feedforward neural network: 12 → 20 → 10 → 2
 *
 * Inputs  (12): last 10 digits normalised + even ratio + streak length
 * Outputs  (2): P(even), P(rise) — both via sigmoid
 * Training: online SGD with backpropagation, learning rate 0.008
 * Weights:  He-initialised (sqrt(2/fan_in)) to avoid vanishing gradients
 */
export class DigitNeuralNetwork {
    private w1: number[][]; // [20][12]
    private b1: number[]; // [20]
    private w2: number[][]; // [10][20]
    private b2: number[]; // [10]
    private w3: number[][]; // [2][10]
    private b3: number[]; // [2]
    private readonly lr = 0.008;

    trainingTicks = 0;

    private accWindow: boolean[] = [];
    private accCorrect = 0;
    private readonly accSize = 150;

    constructor() {
        const he = (n: number) => Math.sqrt(2 / n);
        const r = (s: number) => (Math.random() * 2 - 1) * s;
        this.w1 = Array.from({ length: 20 }, () => Array.from({ length: 12 }, () => r(he(12))));
        this.b1 = new Array(20).fill(0);
        this.w2 = Array.from({ length: 10 }, () => Array.from({ length: 20 }, () => r(he(20))));
        this.b2 = new Array(10).fill(0);
        this.w3 = Array.from({ length: 2 }, () => Array.from({ length: 10 }, () => r(he(10))));
        this.b3 = new Array(2).fill(0);
    }

    private relu(x: number) {
        return x > 0 ? x : 0;
    }
    private sig(x: number) {
        return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, x))));
    }
    private mv(W: number[][], x: number[], b: number[]) {
        return W.map((row, i) => b[i] + row.reduce((s, w, j) => s + w * x[j], 0));
    }

    predict(features: number[]): [number, number] {
        const h1 = this.mv(this.w1, features, this.b1).map(z => this.relu(z));
        const h2 = this.mv(this.w2, h1, this.b2).map(z => this.relu(z));
        const out = this.mv(this.w3, h2, this.b3).map(z => this.sig(z));
        return [out[0], out[1]];
    }

    train(features: number[], targets: [number, number]): void {
        // ── Forward pass ─────────────────────────────────────────────────────
        const pre1 = this.mv(this.w1, features, this.b1);
        const h1 = pre1.map(z => this.relu(z));
        const pre2 = this.mv(this.w2, h1, this.b2);
        const h2 = pre2.map(z => this.relu(z));
        const pre3 = this.mv(this.w3, h2, this.b3);
        const out = pre3.map(z => this.sig(z));

        // Track rolling accuracy on even/odd
        const correct = out[0] >= 0.5 === targets[0] >= 0.5;
        this.accWindow.push(correct);
        if (correct) this.accCorrect++;
        if (this.accWindow.length > this.accSize) {
            if (this.accWindow.shift()!) this.accCorrect--;
        }

        // ── Backprop (BCE loss → gradient = out − target for sigmoid) ────────
        const dOut = out.map((o, i) => o - targets[i]);

        const dPre2 = h2.map((_, j) => {
            const g = this.w3.reduce((s, row, i) => s + dOut[i] * row[j], 0);
            return g * (pre2[j] > 0 ? 1 : 0);
        });
        const dPre1 = h1.map((_, j) => {
            const g = this.w2.reduce((s, row, i) => s + dPre2[i] * row[j], 0);
            return g * (pre1[j] > 0 ? 1 : 0);
        });

        this.w3.forEach((row, i) => {
            row.forEach((_, j) => {
                row[j] -= this.lr * dOut[i] * h2[j];
            });
            this.b3[i] -= this.lr * dOut[i];
        });
        this.w2.forEach((row, i) => {
            row.forEach((_, j) => {
                row[j] -= this.lr * dPre2[i] * h1[j];
            });
            this.b2[i] -= this.lr * dPre2[i];
        });
        this.w1.forEach((row, i) => {
            features.forEach((_, j) => {
                row[j] -= this.lr * dPre1[i] * features[j];
            });
            this.b1[i] -= this.lr * dPre1[i];
        });

        this.trainingTicks++;
    }

    getAccuracy(): number {
        return this.accWindow.length >= 20 ? this.accCorrect / this.accWindow.length : 0.5;
    }
}

// ─── Ensemble Voter ───────────────────────────────────────────────────────────

/**
 * Tracks rolling prediction accuracy for each formula over the last N outcomes.
 * Weight = max(0, (accuracy − 0.5) × 4)
 *   → 0 weight when formula is random (50% accurate)
 *   → 1 weight at 75% accuracy
 *   → 2 weight at 100% accuracy
 */
export class EnsembleVoter {
    private records = new Map<string, { w: boolean[]; c: number }>();
    private readonly size: number;

    constructor(size = 150) {
        this.size = size;
    }

    record(key: string, correct: boolean) {
        if (!this.records.has(key)) this.records.set(key, { w: [], c: 0 });
        const r = this.records.get(key)!;
        r.w.push(correct);
        if (correct) r.c++;
        if (r.w.length > this.size) {
            if (r.w.shift()!) r.c--;
        }
    }

    getAccuracy(key: string): number {
        const r = this.records.get(key);
        if (!r || r.w.length < 20) return 0.5;
        return r.c / r.w.length;
    }

    getWeight(key: string): number {
        return Math.max(0, (this.getAccuracy(key) - 0.5) * 4);
    }

    allAccuracies(keys: readonly string[]): Record<string, number> {
        return Object.fromEntries(keys.map(k => [k, this.getAccuracy(k)]));
    }

    allWeights(keys: readonly string[]): Record<string, number> {
        return Object.fromEntries(keys.map(k => [k, this.getWeight(k)]));
    }
}

// ─── Feature extraction ───────────────────────────────────────────────────────

/**
 * Converts a price buffer into a 12-element feature vector for the NN.
 * Returns null when there are fewer than 15 prices (not enough history).
 *
 * Features:
 *   0-9  : last 10 digits normalised to [0, 1] by dividing by 9
 *   10   : even-digit ratio of the last 15 ticks [0, 1]
 *   11   : current even/odd streak length, capped and normalised [0, 1]
 */
export function extractMLFeatures(prices: number[]): number[] | null {
    if (prices.length < 15) return null;
    const recent = prices.slice(-15);
    const digits = recent.map(p => parseInt(p.toString().replace('.', '').slice(-1)));

    const digitFeats = digits.slice(-10).map(d => d / 9);
    const evenRatio = digits.filter(d => d % 2 === 0).length / digits.length;

    const lastEven = digits[digits.length - 1] % 2 === 0;
    let streak = 1;
    for (let i = digits.length - 2; i >= 0 && (digits[i] % 2 === 0) === lastEven; i--) streak++;

    return [...digitFeats, evenRatio, Math.min(streak / 8, 1)];
}
