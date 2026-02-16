# ADR-008: Rule-Based Expression Analyzer Over ML Classifier

- **Status**: Accepted
- **Date**: 2024-06-01
- **Deciders**: Core team

## Context

ToneAnalyzer's face-api.js model outputs 7 base emotion probabilities (neutral, happy, sad, angry, fearful, disgusted, surprised). However, real-world behavioral analysis requires far more nuanced classifications — compound emotions (e.g., "duping delight"), temporal patterns (e.g., "expression freeze"), and dimensional models (valence-arousal-dominance). We needed to decide how to bridge this gap.

### Options Considered

1. **Train a custom ML model** — Multi-label classifier trained on compound emotion datasets
2. **Rule-based engine** — Expert-authored rules combining base emotions with thresholds and temporal logic
3. **Large Language Model** — Send emotion timeseries to an LLM for behavioral interpretation
4. **Action Unit (AU) detection** — Detect FACS Action Units and map to compound emotions

## Decision

**Chosen: Rule-based `ExpressionAnalyzer`** with 50+ expert-authored rules operating on the 7 base emotion probabilities and temporal history. Rules are organized into three categories: compound emotions (single-frame), temporal indicators (history-based), and dimensional mapping (VAD).

## Rationale

### Transparency & Explainability
- In behavioral analysis contexts (law enforcement, HR, clinical), **operators must understand why a label was assigned**. A rule like "Duping Delight: happy > 0.3 AND (fearful > 0.15 OR disgusted > 0.1) AND surprised < 0.2" is fully interpretable. An ML classifier's decision boundary is opaque.
- Each rule has a confidence score derived from the input probabilities, giving operators a calibrated sense of certainty.

### No Training Data Required
- Compound emotion datasets are scarce, expensive to label, and biased toward WEIRD (Western, Educated, Industrialized, Rich, Democratic) populations. Our rules encode behavioral science knowledge (Ekman, Russell, Plutchik) without requiring labeled training data.
- Rules can be tuned by adjusting thresholds — no retraining pipeline needed.

### Client-Side Feasibility
- Running a second ML model for compound classification would double GPU inference time per frame, directly conflicting with our round-robin latency budget (ADR-007). Rules execute in <7ms on typed arrays — negligible compared to the ~70ms ML inference step.

### Temporal Analysis
- Rules can incorporate **temporal context** (emotion history over 3-12 seconds):
  - "Expression Freeze": dominant emotion unchanged for >4 seconds with low variance
  - "Emotional Volatility": >3 dominant emotion changes in 5 seconds
  - "Squelched Expression": high-intensity emotion dropping to neutral in <500ms
- An ML classifier would need sequence modeling (LSTM/Transformer) which is impractical in-browser on top of the existing face detection model.

### Extensibility
- New rules can be added by a behavioral scientist without ML expertise. Each rule is a pure function: `(currentEmotions, history?) → { label, confidence, category }`.
- Rules are organized by domain (deception, stress, social, positive) for easy navigation and testing.

## Trade-offs Accepted

| Benefit | Trade-off |
|---------|-----------|
| Fully explainable decisions | Rules are simplifications of complex behavioral phenomena |
| Zero training data needed | Cannot discover patterns that experts haven't encoded |
| <7ms execution (vs. ~70ms for ML) | Binary threshold logic may miss gradient transitions |
| Easy to add/modify rules | Rule explosion risk as the system grows (50+ and counting) |
| Temporal pattern detection | History window (3-12s) is a heuristic; optimal windows vary by context |
| Works with any base emotion model | Accuracy is ceiling'd by the base model's 7-emotion probabilities |

## Rule Architecture

### Layer 1: Compound Emotions (Single-Frame)
Combine multiple base emotion probabilities to identify complex emotional states.

```
Example — "Duping Delight":
  IF happy > 0.3
  AND (fearful > 0.15 OR disgusted > 0.1)
  AND surprised < 0.2
  THEN label = "Duping Delight"
       confidence = min(happy, max(fearful, disgusted))
       category = "deception"
```

### Layer 2: Temporal Indicators (History-Based)
Analyze emotion patterns over sliding time windows.

```
Example — "Expression Freeze":
  IF dominantEmotion unchanged for >4 seconds
  AND emotion variance < 0.05 across window
  THEN label = "Expression Freeze"
       confidence = 1.0 - variance
       category = "deception"
```

### Layer 3: Dimensional Mapping (VAD)
Convert base emotions to Valence-Arousal-Dominance coordinates.

```
Mapping (per Russell's Circumplex + Mehrabian):
  happy    → V: +0.8, A: +0.5, D: +0.6
  sad      → V: -0.7, A: -0.3, D: -0.5
  angry    → V: -0.6, A: +0.8, D: +0.7
  fearful  → V: -0.6, A: +0.7, D: -0.6
  disgusted→ V: -0.5, A: +0.3, D: +0.3
  surprised→ V: +0.1, A: +0.8, D: -0.1
  neutral  → V:  0.0, A:  0.0, D:  0.0
```

### Layer 4: Prime Emotion (Aggregate)
60-second rolling window, recalculated every 15 seconds, identifying the dominant emotional state over time.

## Consequences

- The `ExpressionAnalyzer` is the system's highest-value differentiator — it transforms commodity base emotions into actionable behavioral intelligence.
- Rules must be validated against behavioral science literature and field feedback. Incorrect rules could produce misleading labels in high-stakes contexts.
- The rule engine's pure-function architecture makes it straightforward to unit test with synthetic emotion timeseries data.
- If future requirements demand ML-based compound detection, the `ExpressionAnalyzer` interface can wrap an ML model while keeping the rule engine as a fallback/explainability layer.
