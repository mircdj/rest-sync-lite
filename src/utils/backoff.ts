/**
 * Calculates delay using exponential backoff with jitter.
 * Formula: min(maxDelay, baseDelay * 2^attempt + jitter)
 *
 * @param attempt - The current retry attempt (0-indexed or 1-indexed, depending on usage).
 * @param baseDelay - The initial delay in ms.
 * @param maxDelay - The maximum allowed delay in ms.
 * @returns The calculated delay in ms.
 */
export function calculateBackoff(
    attempt: number,
    baseDelay: number = 1000,
    maxDelay: number = 30000
): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const cappedDelay = Math.min(exponentialDelay, maxDelay);

    // Add random jitter (between 0 and 20% of the calculated delay) to avoid Thundering Herd
    // Using a simpler jitter strategy: slightly randomize the delay.
    // Actually, a common jitter strategy is: delay = delay / 2 + random(delay / 2)
    // Let's stick to the prompt's suggestion: base * 2^retries + random

    const jitter = Math.random() * 100; // Small random jitter up to 100ms

    // Ensure we don't exceed maxDelay even with jitter? 
    // Usually jitter is applied before capping or it's fine if it slightly exceeds.
    // Let's optimize:

    return Math.min(cappedDelay + jitter, maxDelay + 100);
}
