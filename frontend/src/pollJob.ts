// Schedule the next request only after the previous response has been handled.
export function pollJob<T extends { state: string }>(
  url: string,
  onStatus: (status: T) => void,
  onError: (message: string) => void,
): () => void {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  async function poll() {
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (!response.ok) {
        onError(response.status === 404
          ? "解析ジョブが見つかりません。Go を押して再実行してください"
          : "進捗を取得できませんでした。Go を押して再実行してください");
        return;
      }
      const status = (await response.json()) as T;
      if (controller.signal.aborted) return;
      onStatus(status);
      if (status.state !== "completed" && status.state !== "failed") {
        timeoutId = setTimeout(poll, 1200);
      }
    } catch {
      if (controller.signal.aborted) return;
      onError("通信に失敗しました。接続を確認して Go を押してください");
    }
  }

  void poll();
  return () => {
    controller.abort();
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  };
}
