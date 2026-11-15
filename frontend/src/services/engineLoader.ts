export async function initializeEngine(
  importModule?: () => Promise<unknown>,
): Promise<(request: string) => string> {
  if (!importModule)
    throw new Error(
      "The reviewed WASM build is not available. Data exploration still works; analysis requires the engine build.",
    );
  const module = await importModule();
  if (
    !module ||
    typeof module !== "object" ||
    !("default" in module) ||
    typeof module.default !== "function" ||
    !("analyze_json" in module) ||
    typeof module.analyze_json !== "function"
  ) {
    throw new Error(
      "The engine module is incompatible with the version 1 JSON interface.",
    );
  }
  await module.default();
  const analyze = module.analyze_json;
  return (request) => {
    const result: unknown = analyze(request);
    if (typeof result !== "string")
      throw new Error("The engine must return a JSON string.");
    return result;
  };
}
