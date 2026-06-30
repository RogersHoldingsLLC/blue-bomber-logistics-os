export type BlueBomberApiResponse<T> = {
  success: boolean;
  result?: T;
  message?: string;
  error?: string;
};

export type BlueBomberSearchAllResult = {
  companies?: unknown[];
  tasks?: unknown[];
  activity?: unknown[];
};

async function callBlueBomberApi<T>(
  action: string,
  data: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch("/api/blue-bomber", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data })
  });

  const payload = (await response.json()) as BlueBomberApiResponse<T>;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || payload.error || "Blue Bomber API request failed.");
  }

  return payload.result as T;
}

export function searchBlueBomberAll(searchText = "") {
  return callBlueBomberApi<BlueBomberSearchAllResult>("SEARCH_ALL", {
    searchText
  });
}