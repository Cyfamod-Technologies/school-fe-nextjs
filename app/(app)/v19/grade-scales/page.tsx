"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  listGradeScales,
  updateGradeScaleRanges,
  type GradeRange,
  type GradeScale,
  type GradeRangePayload,
  type CommentRange,
  type CommentRangePayload,
  updateCommentRanges,
  type PositionRange,
  type PositionRangePayload,
  updatePositionRanges,
} from "@/lib/gradeScales";
import {
  fetchResultPageSettings,
  updateResultPageSettings,
  type ResultPageSettings,
} from "@/lib/resultPageSettings";

interface EditableRange {
  key: string;
  id: number | string | null;
  grade_label: string;
  min_score: string;
  max_score: string;
  description: string;
  grade_point: string;
  locked?: boolean;
}

interface EditablePositionRange {
  key: string;
  id: number | string | null;
  min_score: string;
  max_score: string;
  position: string;
  locked?: boolean;
}

interface EditableCommentRange {
  key: string;
  id: number | string | null;
  teacher_comment: string;
  principal_comment: string;
  locked?: boolean;
}

function generateTempKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tmp-${Math.random().toString(36).slice(2, 11)}`;
}

function toEditable(range: GradeRange, index: number): EditableRange {
  return {
    key: `existing-${range.id ?? index}`,
    id: range.id ?? null,
    grade_label: range.grade_label ?? "",
    min_score:
      range.min_score === null || range.min_score === undefined
        ? ""
        : `${range.min_score}`,
    max_score:
      range.max_score === null || range.max_score === undefined
        ? ""
        : `${range.max_score}`,
    description: range.description ?? "",
    grade_point:
      range.grade_point === null || range.grade_point === undefined
        ? ""
        : `${range.grade_point}`,
    locked: range.locked,
  };
}

function toEditablePositionRange(
  range: PositionRange,
  index: number,
): EditablePositionRange {
  return {
    key: `position-${range.id ?? index}`,
    id: range.id ?? null,
    min_score:
      range.min_score === null || range.min_score === undefined
        ? ""
        : `${range.min_score}`,
    max_score:
      range.max_score === null || range.max_score === undefined
        ? ""
        : `${range.max_score}`,
    position:
      range.position === null || range.position === undefined
        ? ""
        : `${range.position}`,
    locked: range.locked,
  };
}

function toEditableCommentRange(
  range: CommentRange,
  index: number,
): EditableCommentRange {
  return {
    key: `comment-${range.id ?? index}`,
    id: range.id ?? null,
    teacher_comment: range.teacher_comment ?? "",
    principal_comment: range.principal_comment ?? "",
    locked: range.locked,
  };
}

function createEmptyRange(): EditableRange {
  return {
    key: `new-${generateTempKey()}`,
    id: null,
    grade_label: "",
    min_score: "",
    max_score: "",
    description: "",
    grade_point: "",
  };
}

function createEmptyPositionRange(): EditablePositionRange {
  return {
    key: `position-new-${generateTempKey()}`,
    id: null,
    min_score: "",
    max_score: "",
    position: "",
  };
}

function createEmptyCommentRange(): EditableCommentRange {
  return {
    key: `comment-new-${generateTempKey()}`,
    id: null,
    teacher_comment: "",
    principal_comment: "",
  };
}

interface ValidationResult {
  payload: GradeRangePayload[];
  error: string | null;
  invalidKeys: Set<string>;
}

interface PositionValidationResult {
  payload: PositionRangePayload[];
  error: string | null;
  invalidKeys: Set<string>;
}

interface CommentValidationResult {
  payload: CommentRangePayload[];
  error: string | null;
  invalidKeys: Set<string>;
}

function validateRanges(ranges: EditableRange[]): ValidationResult {
  const invalidKeys = new Set<string>();
  const payload: GradeRangePayload[] = [];

  ranges.forEach((range, index) => {
    const label = range.grade_label.trim();
    const minRaw = range.min_score.trim();
    const maxRaw = range.max_score.trim();
    const gradePointRaw = range.grade_point.trim();
    const description = range.description.trim();

    const min = Number(minRaw);
    const max = Number(maxRaw);
    const hasGradePoint = gradePointRaw !== "";
    const gradePointParsed = hasGradePoint
      ? Number.parseFloat(gradePointRaw)
      : Number.NaN;

    const isInvalid =
      !label ||
      minRaw === "" ||
      maxRaw === "" ||
      Number.isNaN(min) ||
      Number.isNaN(max) ||
      min < 0 ||
      max < 0 ||
      min > 100 ||
      max > 100 ||
      min > max ||
      (hasGradePoint &&
        (Number.isNaN(gradePointParsed) ||
          gradePointParsed < 0 ||
          gradePointParsed > 10));

    if (isInvalid) {
      invalidKeys.add(range.key);
      return;
    }

    payload.push({
      id: range.id,
      grade_label: label,
      min_score: min,
      max_score: max,
      description: description || null,
      grade_point: hasGradePoint ? gradePointParsed : null,
      order_index: index,
    });
  });

  if (!ranges.length) {
    return {
      payload: [],
      invalidKeys,
      error: "Define at least one grade range before saving.",
    };
  }

  if (invalidKeys.size > 0) {
    return {
      payload: [],
      invalidKeys,
      error: "Fix the highlighted rows before saving.",
    };
  }

  return {
    payload,
    invalidKeys,
    error: null,
  };
}

function validatePositionRanges(
  ranges: EditablePositionRange[],
): PositionValidationResult {
  const invalidKeys = new Set<string>();
  const payload: PositionRangePayload[] = [];

  if (!ranges.length) {
    return {
      payload: [],
      invalidKeys,
      error: null,
    };
  }

  const seenPositions = new Set<number>();

  ranges.forEach((range) => {
    const minRaw = range.min_score.trim();
    const maxRaw = range.max_score.trim();
    const positionRaw = range.position.trim();

    const min = Number(minRaw);
    const max = Number(maxRaw);
    const position = Number(positionRaw);

    const isInvalid =
      minRaw === "" ||
      maxRaw === "" ||
      positionRaw === "" ||
      Number.isNaN(min) ||
      Number.isNaN(max) ||
      Number.isNaN(position) ||
      min < 0 ||
      max < 0 ||
      min > 100 ||
      max > 100 ||
      min > max ||
      !Number.isInteger(position) ||
      position < 1 ||
      seenPositions.has(position);

    if (isInvalid) {
      invalidKeys.add(range.key);
      return;
    }

    seenPositions.add(position);

    payload.push({
      id: range.id,
      min_score: min,
      max_score: max,
      position,
    });
  });

  if (invalidKeys.size > 0) {
    return {
      payload: [],
      invalidKeys,
      error: "Fix the highlighted rows before saving.",
    };
  }

  return {
    payload,
    invalidKeys,
    error: null,
  };
}

function validateCommentRanges(
  ranges: EditableCommentRange[],
): CommentValidationResult {
  const invalidKeys = new Set<string>();
  const payload: CommentRangePayload[] = [];

  if (!ranges.length) {
    return {
      payload: [],
      invalidKeys,
      error: null,
    };
  }

  ranges.forEach((range) => {
    const teacher = range.teacher_comment.trim();
    const principal = range.principal_comment.trim();

    const isInvalid =
      teacher.length === 0 ||
      principal.length === 0;

    if (isInvalid) {
      invalidKeys.add(range.key);
      return;
    }

    payload.push({
      id: range.id,
      teacher_comment: teacher,
      principal_comment: principal,
    });
  });

  if (invalidKeys.size > 0) {
    return {
      payload: [],
      invalidKeys,
      error: "Fix the highlighted rows before saving.",
    };
  }

  return {
    payload,
    invalidKeys,
    error: null,
  };
}

const defaultResultSettings: ResultPageSettings = {
  show_grade: true,
  show_position: true,
  show_class_average: true,
  show_lowest: true,
  show_highest: true,
  show_remarks: true,
  comment_mode: "manual",
};

export default function GradeScalesPage() {
  const [loading, setLoading] = useState(true);
  const [scales, setScales] = useState<GradeScale[]>([]);
  const [selectedScaleId, setSelectedScaleId] = useState<string>("");
  const [ranges, setRanges] = useState<EditableRange[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [invalidKeys, setInvalidKeys] = useState<Set<string>>(new Set());
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [positionRanges, setPositionRanges] = useState<EditablePositionRange[]>([]);
  const [positionDeletedIds, setPositionDeletedIds] = useState<Set<string>>(
    new Set(),
  );
  const [positionInvalidKeys, setPositionInvalidKeys] = useState<Set<string>>(
    new Set(),
  );
  const [positionInfoMessage, setPositionInfoMessage] = useState<string | null>(
    null,
  );
  const [positionErrorMessage, setPositionErrorMessage] = useState<string | null>(
    null,
  );
  const [positionSaving, setPositionSaving] = useState(false);
  const [commentRanges, setCommentRanges] = useState<EditableCommentRange[]>([]);
  const [commentDeletedIds, setCommentDeletedIds] = useState<Set<string>>(
    new Set(),
  );
  const [commentInvalidKeys, setCommentInvalidKeys] = useState<Set<string>>(
    new Set(),
  );
  const [commentInfoMessage, setCommentInfoMessage] = useState<string | null>(
    null,
  );
  const [commentErrorMessage, setCommentErrorMessage] = useState<string | null>(
    null,
  );
  const [commentSaving, setCommentSaving] = useState(false);
  const [resultSettings, setResultSettings] = useState<ResultPageSettings>(
    defaultResultSettings,
  );
  const [resultSettingsLoading, setResultSettingsLoading] = useState(true);
  const [resultSettingsSaving, setResultSettingsSaving] = useState(false);
  const [resultSettingsInfo, setResultSettingsInfo] = useState<string | null>(
    null,
  );
  const [resultSettingsError, setResultSettingsError] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    listGradeScales()
      .then((data) => {
        if (!active) return;
        setScales(data);
        if (data.length) {
          setSelectedScaleId((current) =>
            current ? current : String(data[0].id),
          );
        }
      })
      .catch((error) => {
        console.error("Unable to load grading scales", error);
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load grading scales.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchResultPageSettings()
      .then((data) => {
        if (!active) return;
        setResultSettings({
          ...data,
          comment_mode: "manual",
        });
      })
      .catch((error) => {
        console.error("Unable to load result page settings", error);
        if (active) {
          setResultSettingsError(
            error instanceof Error
              ? error.message
              : "Unable to load result page settings.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setResultSettingsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedScale = useMemo(() => {
    if (!selectedScaleId) {
      return null;
    }
    return (
      scales.find((scale) => String(scale.id) === selectedScaleId) ?? null
    );
  }, [selectedScaleId, scales]);

  useEffect(() => {
    if (!selectedScale) {
      setRanges([]);
      setDeletedIds(new Set());
      setInvalidKeys(new Set());
      setPositionRanges([]);
      setPositionDeletedIds(new Set());
      setPositionInvalidKeys(new Set());
      setCommentRanges([]);
      setCommentDeletedIds(new Set());
      setCommentInvalidKeys(new Set());
      return;
    }

    const sorted = [...(selectedScale.grade_ranges ?? [])].sort(
      (a, b) => (a.min_score ?? 0) - (b.min_score ?? 0),
    );
    setRanges(sorted.map(toEditable));
    setDeletedIds(new Set());
    setInvalidKeys(new Set());
    setInfoMessage(null);
    setErrorMessage(null);

    const positionSorted = [...(selectedScale.position_ranges ?? [])].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    setPositionRanges(positionSorted.map(toEditablePositionRange));
    setPositionDeletedIds(new Set());
    setPositionInvalidKeys(new Set());
    setPositionInfoMessage(null);
    setPositionErrorMessage(null);

    setCommentRanges((selectedScale.comment_ranges ?? []).map(toEditableCommentRange));
    setCommentDeletedIds(new Set());
    setCommentInvalidKeys(new Set());
    setCommentInfoMessage(null);
    setCommentErrorMessage(null);
  }, [selectedScale]);

  const resultSettingOptions = useMemo(
    () => [
      {
        key: "show_grade" as const,
        label: "Grade",
        hint: "Show subject grades and the final grade summary.",
      },
      {
        key: "show_position" as const,
        label: "Position",
        hint: "Show subject positions and overall class position.",
      },
      {
        key: "show_class_average" as const,
        label: "Class Average",
        hint: "Show class average in the table and summary.",
      },
      {
        key: "show_lowest" as const,
        label: "Lowest",
        hint: "Show the lowest score per subject.",
      },
      {
        key: "show_highest" as const,
        label: "Highest",
        hint: "Show the highest score per subject.",
      },
      {
        key: "show_remarks" as const,
        label: "Remarks",
        hint: "Show remarks derived from the grading scale.",
      },
    ],
    [],
  );

  const handleAddRange = () => {
    setRanges((prev) => [...prev, createEmptyRange()]);
  };

  const handleAddPositionRange = () => {
    setPositionRanges((prev) => [...prev, createEmptyPositionRange()]);
  };

  const handleAddCommentRange = () => {
    setCommentRanges((prev) => [...prev, createEmptyCommentRange()]);
  };

  const handleRangeChange = (
    index: number,
    field: keyof EditableRange,
    value: string,
  ) => {
    const targetKey = ranges[index]?.key;
    setRanges((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
    setInvalidKeys((prev) => {
      if (!prev.size) {
        return prev;
      }
      if (!targetKey || !prev.has(targetKey)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(targetKey);
      return next;
    });
  };

  const handleDeleteRange = (index: number) => {
    const target = ranges[index];
    if (!target) {
      return;
    }

    if (target.id) {
      setDeletedIds((existing) => {
        const next = new Set(existing);
        next.add(String(target.id));
        return next;
      });
    }

    setRanges((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

    setInvalidKeys((prev) => {
      if (!prev.size || !target.key || !prev.has(target.key)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(target.key);
      return next;
    });
  };

  const handlePositionRangeChange = (
    index: number,
    field: keyof EditablePositionRange,
    value: string,
  ) => {
    const targetKey = positionRanges[index]?.key;
    setPositionRanges((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
    setPositionInvalidKeys((prev) => {
      if (!prev.size) {
        return prev;
      }
      if (!targetKey || !prev.has(targetKey)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(targetKey);
      return next;
    });
  };

  const handleDeletePositionRange = (index: number) => {
    const target = positionRanges[index];
    if (!target) {
      return;
    }

    if (target.id) {
      setPositionDeletedIds((existing) => {
        const next = new Set(existing);
        next.add(String(target.id));
        return next;
      });
    }

    setPositionRanges((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index),
    );

    setPositionInvalidKeys((prev) => {
      if (!prev.size || !target.key || !prev.has(target.key)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(target.key);
      return next;
    });
  };

  const handleCommentRangeChange = (
    index: number,
    field: keyof EditableCommentRange,
    value: string,
  ) => {
    const targetKey = commentRanges[index]?.key;
    setCommentRanges((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        [field]: value,
      };
      return next;
    });
    setCommentInvalidKeys((prev) => {
      if (!prev.size) {
        return prev;
      }
      if (!targetKey || !prev.has(targetKey)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(targetKey);
      return next;
    });
  };

  const handleDeleteCommentRange = (index: number) => {
    const target = commentRanges[index];
    if (!target) {
      return;
    }

    if (target.id) {
      setCommentDeletedIds((existing) => {
        const next = new Set(existing);
        next.add(String(target.id));
        return next;
      });
    }

    setCommentRanges((prev) =>
      prev.filter((_, itemIndex) => itemIndex !== index),
    );

    setCommentInvalidKeys((prev) => {
      if (!prev.size || !target.key || !prev.has(target.key)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(target.key);
      return next;
    });
  };

  const handleScaleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedScaleId(event.target.value);
  };

  const handleResultSettingToggle = (
    key: Exclude<keyof ResultPageSettings, "comment_mode">,
  ) => {
    setResultSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleResultSettingsSave = async () => {
    setResultSettingsError(null);
    setResultSettingsInfo(null);

    try {
      setResultSettingsSaving(true);
      const saved = await updateResultPageSettings({
        ...resultSettings,
        comment_mode: "manual",
      });
      setResultSettings({
        ...saved,
        comment_mode: "manual",
      });
      setResultSettingsInfo("Result page settings updated successfully.");
    } catch (error) {
      console.error("Unable to save result page settings", error);
      setResultSettingsError(
        error instanceof Error
          ? error.message
          : "Unable to save result page settings.",
      );
    } finally {
      setResultSettingsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedScaleId) {
      setErrorMessage("Select a grading scale before saving.");
      return;
    }
    setInfoMessage(null);
    setErrorMessage(null);

    const validation = validateRanges(ranges);
    setInvalidKeys(validation.invalidKeys);

    if (validation.error) {
      setErrorMessage(validation.error);
      return;
    }

    try {
      setSaving(true);
      const { scale, message } = await updateGradeScaleRanges(
        selectedScaleId,
        {
          ranges: validation.payload,
          deleted_ids: Array.from(deletedIds),
        },
      );
      setScales((prev) =>
        prev.map((item) => (String(item.id) === String(scale.id) ? scale : item)),
      );
      setInfoMessage(message ?? "Grading scale updated successfully.");
      setDeletedIds(new Set());
    } catch (error) {
      console.error("Unable to save grading scale", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save grading scale.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePositionSave = async () => {
    if (!selectedScaleId) {
      setPositionErrorMessage("Select a grading scale before saving.");
      return;
    }
    setPositionInfoMessage(null);
    setPositionErrorMessage(null);

    const validation = validatePositionRanges(positionRanges);
    setPositionInvalidKeys(validation.invalidKeys);

    if (validation.error) {
      setPositionErrorMessage(validation.error);
      return;
    }

    try {
      setPositionSaving(true);
      const { scale, message } = await updatePositionRanges(selectedScaleId, {
        ranges: validation.payload,
        deleted_ids: Array.from(positionDeletedIds),
      });
      setScales((prev) =>
        prev.map((item) => (String(item.id) === String(scale.id) ? scale : item)),
      );
      setPositionInfoMessage(
        message ?? "Position ranges updated successfully.",
      );
      setPositionDeletedIds(new Set());
    } catch (error) {
      console.error("Unable to save position ranges", error);
      setPositionErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save position ranges.",
      );
    } finally {
      setPositionSaving(false);
    }
  };

  const handleCommentSave = async () => {
    if (!selectedScaleId) {
      setCommentErrorMessage("Select a grading scale before saving.");
      return;
    }
    setCommentInfoMessage(null);
    setCommentErrorMessage(null);

    const validation = validateCommentRanges(commentRanges);
    setCommentInvalidKeys(validation.invalidKeys);

    if (validation.error) {
      setCommentErrorMessage(validation.error);
      return;
    }

    try {
      setCommentSaving(true);
      const { scale, message } = await updateCommentRanges(selectedScaleId, {
        ranges: validation.payload,
        deleted_ids: Array.from(commentDeletedIds),
      });
      setScales((prev) =>
        prev.map((item) => (String(item.id) === String(scale.id) ? scale : item)),
      );
      setCommentInfoMessage(
        message ?? "Comment templates updated successfully.",
      );
      setCommentDeletedIds(new Set());
    } catch (error) {
      console.error("Unable to save comment templates", error);
      setCommentErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save comment templates.",
      );
    } finally {
      setCommentSaving(false);
    }
  };

  const renderTableBody = () => {
    if (!selectedScaleId) {
      return (
        <tr>
          <td colSpan={6} className="text-center text-muted">
            Select a grading scale to view ranges.
          </td>
        </tr>
      );
    }

    if (!ranges.length) {
      return (
        <tr>
          <td colSpan={6} className="text-center text-muted">
            No grade ranges defined.
          </td>
        </tr>
      );
    }

    return ranges.map((range, index) => {
      const rowInvalid = invalidKeys.has(range.key);
      return (
        <tr key={range.key} className={rowInvalid ? "table-danger" : undefined}>
          <td>
            <input
              type="text"
              className="form-control"
              value={range.grade_label}
              maxLength={50}
              onChange={(event) =>
                handleRangeChange(index, "grade_label", event.target.value)
              }
              required
            />
          </td>
          <td>
            <input
              type="number"
              className="form-control"
              min={0}
              max={100}
              step={1}
              value={range.min_score}
              onChange={(event) =>
                handleRangeChange(index, "min_score", event.target.value)
              }
              required
            />
          </td>
          <td>
            <input
              type="number"
              className="form-control"
              min={0}
              max={100}
              step={1}
              value={range.max_score}
              onChange={(event) =>
                handleRangeChange(index, "max_score", event.target.value)
              }
              required
            />
          </td>
          <td>
            <textarea
              className="form-control"
              value={range.description}
              maxLength={255}
              onChange={(event) =>
                handleRangeChange(index, "description", event.target.value)
              }
            />
          </td>
          <td>
            <input
              type="number"
              className="form-control"
              min={0}
              max={10}
              step={0.01}
              value={range.grade_point}
              onChange={(event) =>
                handleRangeChange(index, "grade_point", event.target.value)
              }
            />
          </td>
          <td className="text-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => handleDeleteRange(index)}
              disabled={range.locked}
            >
              <i className="fas fa-trash" />
            </button>
          </td>
        </tr>
      );
    });
  };

  const renderPositionTableBody = () => {
    if (!selectedScaleId) {
      return (
        <tr>
          <td colSpan={4} className="text-center text-muted">
            Select a grading scale to view position ranges.
          </td>
        </tr>
      );
    }

    if (!positionRanges.length) {
      return (
        <tr>
          <td colSpan={4} className="text-center text-muted">
            No position ranges defined.
          </td>
        </tr>
      );
    }

    return positionRanges.map((range, index) => {
      const rowInvalid = positionInvalidKeys.has(range.key);
      return (
        <tr key={range.key} className={rowInvalid ? "table-danger" : undefined}>
          <td>
            <input
              type="number"
              className="form-control"
              min={1}
              step={1}
              value={range.position}
              onChange={(event) =>
                handlePositionRangeChange(index, "position", event.target.value)
              }
              required
            />
          </td>
          <td>
            <input
              type="number"
              className="form-control"
              min={0}
              max={100}
              step={1}
              value={range.min_score}
              onChange={(event) =>
                handlePositionRangeChange(index, "min_score", event.target.value)
              }
              required
            />
          </td>
          <td>
            <input
              type="number"
              className="form-control"
              min={0}
              max={100}
              step={1}
              value={range.max_score}
              onChange={(event) =>
                handlePositionRangeChange(index, "max_score", event.target.value)
              }
              required
            />
          </td>
          <td className="text-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => handleDeletePositionRange(index)}
              disabled={range.locked}
            >
              <i className="fas fa-trash" />
            </button>
          </td>
        </tr>
      );
    });
  };

  const renderCommentTableBody = () => {
    if (!selectedScaleId) {
      return (
        <tr>
          <td colSpan={3} className="text-center text-muted">
            Select a grading scale to view comment templates.
          </td>
        </tr>
      );
    }

    if (!commentRanges.length) {
      return (
        <tr>
          <td colSpan={3} className="text-center text-muted">
            No comment templates defined.
          </td>
        </tr>
      );
    }

    return commentRanges.map((range, index) => {
      const rowInvalid = commentInvalidKeys.has(range.key);
      return (
        <tr key={range.key} className={rowInvalid ? "table-danger" : undefined}>
          <td>
            <textarea
              className="form-control"
              value={range.teacher_comment}
              maxLength={2000}
              onChange={(event) =>
                handleCommentRangeChange(
                  index,
                  "teacher_comment",
                  event.target.value,
                )
              }
            />
          </td>
          <td>
            <textarea
              className="form-control"
              value={range.principal_comment}
              maxLength={2000}
              onChange={(event) =>
                handleCommentRangeChange(
                  index,
                  "principal_comment",
                  event.target.value,
                )
              }
            />
          </td>
          <td className="text-center">
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => handleDeleteCommentRange(index)}
              disabled={range.locked}
            >
              <i className="fas fa-trash" />
            </button>
          </td>
        </tr>
      );
    });
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Grading Scales</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Grading Scales</li>
        </ul>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Active Scale</h3>
            </div>
            <div className="item-title">
              <select
                id="grade-scale-select"
                className="form-control"
                value={selectedScaleId}
                onChange={handleScaleChange}
                disabled={loading || !scales.length}
              >
                {loading ? (
                  <option value="">Loading...</option>
                ) : scales.length ? (
                  scales.map((scale) => (
                    <option key={scale.id} value={String(scale.id)}>
                      {scale.name}
                    </option>
                  ))
                ) : (
                  <option value="">No grading scale available</option>
                )}
              </select>
            </div>
          </div>
          <p className="text-muted mb-0">
            Adjust the ranges below to update the grading system used when
            calculating results.
          </p>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Visibility Controls</h3>
            </div>
            <button
              type="button"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              onClick={handleResultSettingsSave}
              disabled={resultSettingsLoading || resultSettingsSaving}
            >
              {resultSettingsSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
          <p className="text-muted mb-3">
            Toggle what appears on the printed result page for this school.
          </p>
          {resultSettingsInfo ? (
            <div className="alert alert-info">{resultSettingsInfo}</div>
          ) : null}
          {resultSettingsError ? (
            <div className="alert alert-danger">{resultSettingsError}</div>
          ) : null}
          {resultSettingsLoading ? (
            <div className="alert alert-info">Loading settings...</div>
          ) : null}
          <div className="row gutters-20">
            {resultSettingOptions.map((option) => (
              <div key={option.key} className="col-md-6 col-12 form-group">
                <div className="form-check">
                  <input
                    id={option.key}
                    type="checkbox"
                    className="form-check-input"
                    checked={resultSettings[option.key]}
                    onChange={() => handleResultSettingToggle(option.key)}
                    disabled={resultSettingsLoading || resultSettingsSaving}
                  />
                  <label className="form-check-label" htmlFor={option.key}>
                    {option.label}
                  </label>
                </div>
                <small className="form-text text-muted">{option.hint}</small>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Grade Ranges</h3>
            </div>
            <div className="d-flex align-items-center">
              <button
                type="button"
                id="add-grade-row"
                className="btn btn-sm btn-outline-primary mr-2"
                onClick={handleAddRange}
                disabled={!selectedScaleId || saving}
              >
                <i className="fas fa-plus" /> Add Grade
              </button>
              <button
                type="button"
                id="save-grade-scale"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={handleSave}
                disabled={saving || !selectedScaleId}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
          {infoMessage ? (
            <div className="alert alert-info" id="grade-scale-info">
              {infoMessage}
            </div>
          ) : null}
          {errorMessage ? (
            <div className="alert alert-danger" id="grade-scale-error">
              {errorMessage}
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table table-bordered table-striped grade-scale-table">
              <thead>
                <tr>
                  <th>Grade Label</th>
                  <th>Minimum Score</th>
                  <th>Maximum Score</th>
                  <th>Remarks</th>
                  <th>Grade Point</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody id="grade-range-table">{renderTableBody()}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card height-auto mt-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Position Ranges (Optional)</h3>
            </div>
            <div className="d-flex align-items-center">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary mr-2"
                onClick={handleAddPositionRange}
                disabled={!selectedScaleId || positionSaving}
              >
                <i className="fas fa-plus" /> Add Position
              </button>
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={handlePositionSave}
                disabled={positionSaving || !selectedScaleId}
              >
                {positionSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
          <p className="text-muted mb-3">
            Define score bands that receive fixed positions (subject and overall).
            Scores outside these ranges are ranked below the highest configured
            position.
          </p>
          {positionInfoMessage ? (
            <div className="alert alert-info">{positionInfoMessage}</div>
          ) : null}
          {positionErrorMessage ? (
            <div className="alert alert-danger">{positionErrorMessage}</div>
          ) : null}
          <div className="table-responsive">
            <table className="table table-bordered table-striped">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Minimum Score</th>
                  <th>Maximum Score</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>{renderPositionTableBody()}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card height-auto mt-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Result Comment Templates (Optional)</h3>
            </div>
            <div className="d-flex align-items-center">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary mr-2"
                onClick={handleAddCommentRange}
                disabled={!selectedScaleId || commentSaving}
              >
                <i className="fas fa-plus" /> Add Comment
              </button>
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={handleCommentSave}
                disabled={commentSaving || !selectedScaleId}
              >
                {commentSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
          <p className="text-muted mb-3">
            Add reusable teacher and principal comments that staff can pick and
            still edit as custom text when needed.
          </p>
          {commentInfoMessage ? (
            <div className="alert alert-info">{commentInfoMessage}</div>
          ) : null}
          {commentErrorMessage ? (
            <div className="alert alert-danger">{commentErrorMessage}</div>
          ) : null}
          <div className="table-responsive">
            <table className="table table-bordered table-striped">
              <thead>
                <tr>
                  <th>Teacher Comment</th>
                  <th>Principal Comment</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>{renderCommentTableBody()}</tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
