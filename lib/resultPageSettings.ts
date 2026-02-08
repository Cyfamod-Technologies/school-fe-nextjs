import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface ResultPageSettings {
  show_grade: boolean;
  show_position: boolean;
  show_class_average: boolean;
  show_lowest: boolean;
  show_highest: boolean;
  show_remarks: boolean;
  comment_mode: "manual" | "range";
}

const defaultSettings: ResultPageSettings = {
  show_grade: true,
  show_position: true,
  show_class_average: true,
  show_lowest: true,
  show_highest: true,
  show_remarks: true,
  comment_mode: "manual",
};

type ResultPageSettingsResponse =
  | ResultPageSettings
  | {
      data?: ResultPageSettings;
      [key: string]: unknown;
    };

const parseBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return fallback;
};

function normalizeSettings(payload: ResultPageSettingsResponse): ResultPageSettings {
  const raw =
    payload && typeof payload === "object" && "data" in payload
      ? (payload as { data?: ResultPageSettings }).data
      : (payload as ResultPageSettings);

  if (!raw || typeof raw !== "object") {
    return { ...defaultSettings };
  }

  const settings = raw as Partial<ResultPageSettings>;
  const commentMode =
    settings.comment_mode === "range" || settings.comment_mode === "manual"
      ? settings.comment_mode
      : defaultSettings.comment_mode;

  return {
    show_grade: parseBoolean(settings.show_grade, defaultSettings.show_grade),
    show_position: parseBoolean(
      settings.show_position,
      defaultSettings.show_position,
    ),
    show_class_average: parseBoolean(
      settings.show_class_average,
      defaultSettings.show_class_average,
    ),
    show_lowest: parseBoolean(
      settings.show_lowest,
      defaultSettings.show_lowest,
    ),
    show_highest: parseBoolean(
      settings.show_highest,
      defaultSettings.show_highest,
    ),
    show_remarks: parseBoolean(
      settings.show_remarks,
      defaultSettings.show_remarks,
    ),
    comment_mode: commentMode,
  };
}

export async function fetchResultPageSettings(): Promise<ResultPageSettings> {
  const payload = await apiFetch<ResultPageSettingsResponse>(
    API_ROUTES.resultPageSettings,
  );
  return normalizeSettings(payload);
}

export async function updateResultPageSettings(
  payload: Partial<ResultPageSettings>,
): Promise<ResultPageSettings> {
  const response = await apiFetch<ResultPageSettingsResponse>(
    API_ROUTES.resultPageSettings,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return normalizeSettings(response);
}
