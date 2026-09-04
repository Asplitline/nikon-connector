export function createSingleFlight<T>(operation: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (inFlight) {
      return inFlight;
    }

    const promise = operation().finally(() => {
      if (inFlight === promise) {
        inFlight = null;
      }
    });
    inFlight = promise;
    return promise;
  };
}
