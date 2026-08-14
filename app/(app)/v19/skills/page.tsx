"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses, type SchoolClass } from "@/lib/classes";
import {
  assignSkillTypesToClass,
  copySkillTypesToClass,
  createSkillCategory,
  createSkillTypesBulk,
  deleteSkillCategory,
  deleteSkillType,
  listSkillCategories,
  listSkillTypes,
  updateSkillCategory,
  updateSkillType,
  type SkillCategory,
  type SkillType,
} from "@/lib/skills";

type FeedbackKind = "success" | "danger" | "warning" | "info";

interface FeedbackState {
  type: FeedbackKind;
  message: string;
}

interface CategoryFormState {
  id: string;
  name: string;
  description: string;
  school_class_id: string;
}

interface SkillFormState {
  id: string;
  skill_category_id: string;
  name: string;
  names: string[];
  weight: string;
  description: string;
  school_class_id: string;
}

const emptyCategoryForm: CategoryFormState = {
  id: "",
  name: "",
  description: "",
  school_class_id: "",
};

const emptySkillForm: SkillFormState = {
  id: "",
  skill_category_id: "",
  name: "",
  names: [""],
  weight: "",
  description: "",
  school_class_id: "",
};

export default function SkillsPage() {
  const { schoolContext } = useAuth();
  const categorySeparatedByClass = Boolean(
    schoolContext.school?.skill_categories_separate_by_class,
  );
  const skillSeparatedByClass = Boolean(
    schoolContext.school?.skill_types_separate_by_class,
  );
  const usesClassScopedSkills =
    categorySeparatedByClass || skillSeparatedByClass;

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [skillTypes, setSkillTypes] = useState<SkillType[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [categoryForm, setCategoryForm] =
    useState<CategoryFormState>(emptyCategoryForm);
  const [skillForm, setSkillForm] =
    useState<SkillFormState>(emptySkillForm);

  const [categoryFeedback, setCategoryFeedback] =
    useState<FeedbackState | null>(null);
  const [skillFeedback, setSkillFeedback] =
    useState<FeedbackState | null>(null);

  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [skillSubmitting, setSkillSubmitting] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [skillCategoryFilter, setSkillCategoryFilter] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [scopeClassFilter, setScopeClassFilter] = useState("");
  const [bulkAssignClassId, setBulkAssignClassId] = useState("");

  const refreshCategories = useCallback(async () => {
    setLoadingCategories(true);
    try {
      const data = await listSkillCategories({
        schoolClassId:
          categorySeparatedByClass && scopeClassFilter
            ? scopeClassFilter
            : undefined,
      });
      setCategories(data);
    } catch (error) {
      console.error("Unable to load categories", error);
      setCategoryFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load skill categories.",
      });
    } finally {
      setLoadingCategories(false);
    }
  }, [categorySeparatedByClass, scopeClassFilter]);

  const refreshSkillTypes = useCallback(async () => {
    setLoadingSkills(true);
    try {
      const data = await listSkillTypes({
        skillCategoryId: skillCategoryFilter || undefined,
        schoolClassId:
          usesClassScopedSkills && scopeClassFilter ? scopeClassFilter : undefined,
      });
      setSkillTypes(data);
    } catch (error) {
      console.error("Unable to load skill types", error);
      setSkillFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load skills.",
      });
    } finally {
      setLoadingSkills(false);
    }
  }, [skillCategoryFilter, scopeClassFilter, usesClassScopedSkills]);

  const refreshClasses = useCallback(async () => {
    if (!usesClassScopedSkills) {
      setClasses([]);
      return;
    }
    setLoadingClasses(true);
    try {
      setClasses(await listClasses());
    } catch (error) {
      console.error("Unable to load classes", error);
      setCategoryFeedback({
        type: "danger",
        message:
          error instanceof Error ? error.message : "Unable to load classes.",
      });
    } finally {
      setLoadingClasses(false);
    }
  }, [usesClassScopedSkills]);

  useEffect(() => {
    refreshCategories().catch((error) =>
      console.error("Unable to load skill categories", error),
    );
  }, [refreshCategories]);

  useEffect(() => {
    refreshSkillTypes().catch((error) =>
      console.error("Unable to load skill settings", error),
    );
  }, [refreshSkillTypes]);

  useEffect(() => {
    refreshClasses().catch((error) =>
      console.error("Unable to load classes", error),
    );
  }, [refreshClasses]);

  useEffect(() => {
    setCategoryForm((prev) => ({
      ...prev,
      school_class_id:
        prev.id !== "" ? prev.school_class_id : categorySeparatedByClass ? scopeClassFilter : "",
    }));
    setSkillForm((prev) => ({
      ...prev,
      school_class_id:
        prev.id !== "" ? prev.school_class_id : skillSeparatedByClass ? scopeClassFilter : "",
    }));
  }, [categorySeparatedByClass, skillSeparatedByClass, scopeClassFilter]);

  useEffect(() => {
    const visibleSkillIds = new Set(skillTypes.map((skill) => String(skill.id)));
    setSelectedSkillIds((previous) =>
      previous.filter((skillId) => visibleSkillIds.has(skillId)),
    );
  }, [skillTypes]);

  useEffect(() => {
    if (!skillCategoryFilter) {
      return;
    }
    const exists = categories.some(
      (category) => String(category.id) === String(skillCategoryFilter),
    );
    if (!exists) {
      setSkillCategoryFilter("");
    }
  }, [categories, skillCategoryFilter]);

  const categoryCountById = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((category) => {
      map.set(
        String(category.id),
        Array.isArray(category.skill_types)
          ? category.skill_types.length
          : 0,
      );
    });
    return map;
  }, [categories]);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => {
      map.set(String(category.id), category.name);
    });
    return map;
  }, [categories]);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    classes.forEach((schoolClass) => {
      map.set(String(schoolClass.id), schoolClass.name);
    });
    return map;
  }, [classes]);

  const scopeLabel = useCallback(
    (classId?: string | null) => {
      if (!usesClassScopedSkills) {
        return "All classes";
      }
      if (!classId) {
        return "All classes";
      }
      return classNameById.get(String(classId)) ?? "Selected class";
    },
    [classNameById, usesClassScopedSkills],
  );

  const handleCategorySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategoryFeedback(null);

    const name = categoryForm.name.trim();
    if (!name) {
      setCategoryFeedback({
        type: "warning",
        message: "Category name is required.",
      });
      return;
    }

    const payload = {
      name,
      description: categoryForm.description.trim() || null,
      school_class_id:
        categorySeparatedByClass && categoryForm.school_class_id
          ? categoryForm.school_class_id
          : null,
    };

    try {
      setCategorySubmitting(true);
      if (categoryForm.id) {
        await updateSkillCategory(categoryForm.id, payload);
        setCategoryFeedback({
          type: "success",
          message: "Category updated successfully.",
        });
      } else {
        await createSkillCategory(payload);
        setCategoryFeedback({
          type: "success",
          message: "Category created successfully.",
        });
      }
      setCategoryForm({
        ...emptyCategoryForm,
        school_class_id: categorySeparatedByClass ? scopeClassFilter : "",
      });
      await refreshCategories();
      await refreshSkillTypes();
    } catch (error) {
      console.error("Unable to save category", error);
      setCategoryFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save category.",
      });
    } finally {
      setCategorySubmitting(false);
    }
  };

  const beginCategoryEdit = (category: SkillCategory) => {
    setCategoryForm({
      id: String(category.id),
      name: category.name ?? "",
      description: category.description ?? "",
      school_class_id: category.school_class_id ? String(category.school_class_id) : "",
    });
    setCategoryFeedback(null);
  };

  const cancelCategoryEdit = () => {
    setCategoryForm({
      ...emptyCategoryForm,
      school_class_id: categorySeparatedByClass ? scopeClassFilter : "",
    });
    setCategoryFeedback(null);
  };

  const handleDeleteCategory = async (category: SkillCategory) => {
    if (
      !window.confirm(
        "Delete this skill category? Skills inside the category will also be removed.",
      )
    ) {
      return;
    }
    try {
      await deleteSkillCategory(category.id);
      setCategoryFeedback({
        type: "success",
        message: "Category deleted successfully.",
      });
      if (categoryForm.id === String(category.id)) {
        setCategoryForm({
          ...emptyCategoryForm,
          school_class_id: categorySeparatedByClass ? scopeClassFilter : "",
        });
      }
      if (skillCategoryFilter === String(category.id)) {
        setSkillCategoryFilter("");
      }
      await refreshCategories();
      await refreshSkillTypes();
    } catch (error) {
      console.error("Unable to delete category", error);
      setCategoryFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to delete category.",
      });
    }
  };

  const handleSkillSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSkillFeedback(null);

    if (!skillForm.skill_category_id) {
      setSkillFeedback({
        type: "warning",
        message: "Select a category for the skill.",
      });
      return;
    }

    const weightRaw = skillForm.weight.trim();
    let weightValue: number | null = null;
    if (weightRaw !== "") {
      const parsed = Number.parseFloat(weightRaw);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 999.99) {
        setSkillFeedback({
          type: "warning",
          message: "Weight must be between 0 and 999.99.",
        });
        return;
      }
      weightValue = parsed;
    }

    const sharedPayload = {
      skill_category_id: skillForm.skill_category_id,
      weight: weightValue,
      description: skillForm.description.trim() || null,
      school_class_id:
        skillSeparatedByClass && skillForm.school_class_id
          ? skillForm.school_class_id
          : null,
    };

    try {
      setSkillSubmitting(true);
      if (skillForm.id) {
        const name = skillForm.name.trim();
        if (!name) {
          setSkillFeedback({
            type: "warning",
            message: "Skill name is required.",
          });
          return;
        }

        await updateSkillType(skillForm.id, {
          ...sharedPayload,
          name,
        });
        setSkillFeedback({
          type: "success",
          message: "Skill updated successfully.",
        });
      } else {
        const names = skillForm.names.map((entry) => entry.trim()).filter(Boolean);

        if (!names.length) {
          setSkillFeedback({
            type: "warning",
            message: "Add at least one skill name to save.",
          });
          return;
        }

        const duplicateCount =
          names.length - new Set(names.map((entry) => entry.toLowerCase())).size;
        if (duplicateCount > 0) {
          setSkillFeedback({
            type: "warning",
            message: "Each skill name must be unique in the list.",
          });
          return;
        }

        const tooLongName = names.find((entry) => entry.length > 500);
        if (tooLongName) {
          setSkillFeedback({
            type: "warning",
            message: "Each skill name must be 500 characters or less.",
          });
          return;
        }

        const createdSkills = await createSkillTypesBulk({
          ...sharedPayload,
          names,
        });
        setSkillFeedback({
          type: "success",
          message: `${createdSkills.length} skill${
            createdSkills.length === 1 ? "" : "s"
          } created successfully.`,
        });
      }
      setSkillForm({
        ...emptySkillForm,
        school_class_id: skillSeparatedByClass ? scopeClassFilter : "",
      });
      await refreshSkillTypes();
      await refreshCategories();
    } catch (error) {
      console.error("Unable to save skill", error);
      setSkillFeedback({
        type: "danger",
        message:
          error instanceof Error ? error.message : "Unable to save skill.",
      });
    } finally {
      setSkillSubmitting(false);
    }
  };

  const beginSkillEdit = (skill: SkillType) => {
    setSkillForm({
      id: String(skill.id),
      skill_category_id: String(skill.skill_category_id ?? ""),
      name: skill.name ?? "",
      weight:
        skill.weight === null || skill.weight === undefined
          ? ""
          : `${Number(skill.weight).toFixed(2)}`,
      names: [""],
      description: skill.description ?? "",
      school_class_id: skill.school_class_id ? String(skill.school_class_id) : "",
    });
    setSkillFeedback(null);
  };

  const cancelSkillEdit = () => {
    setSkillForm({
      ...emptySkillForm,
      school_class_id: skillSeparatedByClass ? scopeClassFilter : "",
    });
    setSkillFeedback(null);
  };

  const handleAddSkillNameField = () => {
    setSkillForm((prev) => ({
      ...prev,
      names: [...prev.names, ""],
    }));
  };

  const handleSkillNameFieldChange = (index: number, value: string) => {
    setSkillForm((prev) => ({
      ...prev,
      names: prev.names.map((entry, entryIndex) =>
        entryIndex === index ? value : entry,
      ),
    }));
  };

  const handleRemoveSkillNameField = (index: number) => {
    setSkillForm((prev) => {
      if (prev.names.length <= 1) {
        return {
          ...prev,
          names: [""],
        };
      }

      return {
        ...prev,
        names: prev.names.filter((_, entryIndex) => entryIndex !== index),
      };
    });
  };

  const handleDeleteSkill = async (skill: SkillType) => {
    if (!window.confirm("Delete this skill?")) {
      return;
    }
    try {
      await deleteSkillType(skill.id);
      setSkillFeedback({
        type: "success",
        message: "Skill deleted successfully.",
      });
      if (skillForm.id === String(skill.id)) {
        setSkillForm({
          ...emptySkillForm,
          school_class_id: skillSeparatedByClass ? scopeClassFilter : "",
        });
      }
      setSelectedSkillIds((previous) =>
        previous.filter((skillId) => skillId !== String(skill.id)),
      );
      await refreshSkillTypes();
      await refreshCategories();
    } catch (error) {
      console.error("Unable to delete skill", error);
      setSkillFeedback({
        type: "danger",
        message:
          error instanceof Error ? error.message : "Unable to delete skill.",
      });
    }
  };

  const toggleSkillSelection = (skillId: string) => {
    setSelectedSkillIds((previous) =>
      previous.includes(skillId)
        ? previous.filter((id) => id !== skillId)
        : [...previous, skillId],
    );
  };

  const allVisibleSelected =
    skillTypes.length > 0 &&
    skillTypes.every((skill) => selectedSkillIds.includes(String(skill.id)));

  const toggleSelectAllVisibleSkills = () => {
    const visibleIds = skillTypes.map((skill) => String(skill.id));
    if (!visibleIds.length) {
      return;
    }

    if (allVisibleSelected) {
      setSelectedSkillIds((previous) =>
        previous.filter((skillId) => !visibleIds.includes(skillId)),
      );
      return;
    }

    setSelectedSkillIds((previous) => {
      const merged = new Set([...previous, ...visibleIds]);
      return Array.from(merged);
    });
  };

  const handleDeleteSelectedSkills = async () => {
    if (!selectedSkillIds.length) {
      setSkillFeedback({
        type: "warning",
        message: "Select at least one skill to delete.",
      });
      return;
    }

    if (
      !window.confirm(
        `Delete ${selectedSkillIds.length} selected skill${
          selectedSkillIds.length === 1 ? "" : "s"
        }?`,
      )
    ) {
      return;
    }

    try {
      setSkillSubmitting(true);
      const selectedIds = [...selectedSkillIds];
      const results = await Promise.allSettled(
        selectedIds.map((skillId) => deleteSkillType(skillId)),
      );

      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;
      const deletedCount = results.length - failedCount;

      if (selectedIds.includes(skillForm.id)) {
        setSkillForm({
          ...emptySkillForm,
          school_class_id: skillSeparatedByClass ? scopeClassFilter : "",
        });
      }

      setSelectedSkillIds([]);
      await refreshSkillTypes();
      await refreshCategories();

      if (failedCount > 0) {
        setSkillFeedback({
          type: "warning",
          message: `${deletedCount} deleted, ${failedCount} failed. Try again for the remaining skills.`,
        });
        return;
      }

      setSkillFeedback({
        type: "success",
        message: `${deletedCount} skill${
          deletedCount === 1 ? "" : "s"
        } deleted successfully.`,
      });
    } catch (error) {
      console.error("Unable to delete selected skills", error);
      setSkillFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to delete selected skills.",
      });
    } finally {
      setSkillSubmitting(false);
    }
  };

  const handleAssignSelectedSkills = async () => {
    if (!selectedSkillIds.length) {
      setSkillFeedback({
        type: "warning",
        message: "Select at least one skill to move.",
      });
      return;
    }

    try {
      setSkillSubmitting(true);
      const updated = await assignSkillTypesToClass(
        selectedSkillIds,
        bulkAssignClassId || null,
      );

      setSelectedSkillIds([]);
      await refreshSkillTypes();
      await refreshCategories();

      const targetLabel = bulkAssignClassId
        ? scopeLabel(bulkAssignClassId)
        : "All classes";

      setSkillFeedback({
        type: "success",
        message: `${updated.length} skill${
          updated.length === 1 ? "" : "s"
        } moved to ${targetLabel}.`,
      });
    } catch (error) {
      console.error("Unable to move selected skills", error);
      setSkillFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to move selected skills.",
      });
    } finally {
      setSkillSubmitting(false);
    }
  };

  const handleCopySelectedSkills = async () => {
    if (!selectedSkillIds.length) {
      setSkillFeedback({
        type: "warning",
        message: "Select at least one skill to copy.",
      });
      return;
    }

    try {
      setSkillSubmitting(true);
      const response = await copySkillTypesToClass(
        selectedSkillIds,
        bulkAssignClassId || null,
      );

      await refreshSkillTypes();
      await refreshCategories();

      setSkillFeedback({
        type: response.skipped?.length ? "warning" : "success",
        message:
          response.message ??
          `${response.data?.length ?? 0} skill${
            response.data?.length === 1 ? "" : "s"
          } copied successfully.`,
      });
    } catch (error) {
      console.error("Unable to copy selected skills", error);
      setSkillFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to copy selected skills.",
      });
    } finally {
      setSkillSubmitting(false);
    }
  };

  const renderCategoryTable = () => {
    const columnCount = categorySeparatedByClass ? 4 : 3;

    if (loadingCategories) {
      return (
        <tr>
          <td colSpan={columnCount}>Loading categories...</td>
        </tr>
      );
    }

    if (!categories.length) {
      return (
        <tr>
          <td colSpan={columnCount}>No categories found.</td>
        </tr>
      );
    }

    return categories.map((category) => {
      const count = categoryCountById.get(String(category.id)) ?? 0;
      return (
        <tr key={category.id}>
          <td>{category.name}</td>
          {categorySeparatedByClass ? <td>{scopeLabel(category.school_class_id)}</td> : null}
          <td>{count}</td>
          <td>
            <button
              type="button"
              className="btn btn-link p-0 mr-3"
              onClick={() => beginCategoryEdit(category)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-link text-danger p-0"
              onClick={() => handleDeleteCategory(category)}
            >
              Delete
            </button>
          </td>
        </tr>
      );
    });
  };

  const renderSkillTable = () => {
    const columnCount = usesClassScopedSkills ? 7 : 6;

    if (loadingSkills) {
      return (
        <tr>
          <td colSpan={columnCount}>Loading skills...</td>
        </tr>
      );
    }

    if (!skillTypes.length) {
      return (
        <tr>
          <td colSpan={columnCount}>
            {skillCategoryFilter
              ? "No skills found in the selected category."
              : "No skills found."}
          </td>
        </tr>
      );
    }

    return skillTypes.map((skill) => {
      const categoryName =
        skill.category ??
        categoryNameById.get(String(skill.skill_category_id)) ??
        "—";
      const weightText =
        skill.weight === null || skill.weight === undefined
          ? "—"
          : Number(skill.weight).toFixed(2);
      const effectiveScopeId =
        skill.school_class_id ?? skill.category_school_class_id ?? null;
      return (
        <tr key={skill.id}>
          <td>
            <input
              type="checkbox"
              checked={selectedSkillIds.includes(String(skill.id))}
              onChange={() => toggleSkillSelection(String(skill.id))}
            />
          </td>
          <td>{skill.name}</td>
          <td>{categoryName}</td>
          {usesClassScopedSkills ? <td>{scopeLabel(effectiveScopeId)}</td> : null}
          <td>{weightText}</td>
          <td>{skill.description || "—"}</td>
          <td>
            <button
              type="button"
              className="btn btn-link p-0 mr-3"
              onClick={() => beginSkillEdit(skill)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-link text-danger p-0"
              onClick={() => handleDeleteSkill(skill)}
            >
              Delete
            </button>
          </td>
        </tr>
      );
    });
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Skills &amp; Behaviour</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Skills</li>
        </ul>
      </div>

      <div className="row">
        <div className="col-lg-5">
          <div className="card height-auto mb-4">
            <div className="card-body">
              <div className="heading-layout1 mb-3">
                <div className="item-title">
                  <h3>Skill Categories</h3>
                </div>
                <div className="dropdown">
                  <button
                    className="dropdown-toggle"
                    type="button"
                    data-toggle="dropdown"
                  >
                    ...
                  </button>
                  <div className="dropdown-menu dropdown-menu-right">
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={refreshCategories}
                    >
                      <i className="fas fa-redo-alt text-orange-peel" /> Refresh
                    </button>
                  </div>
                </div>
              </div>

              {categorySeparatedByClass ? (
                <div className="form-group">
                  <label className="text-dark-medium">Category Class Scope</label>
                  <select
                    className="form-control"
                    value={scopeClassFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setScopeClassFilter(value);
                      setCategoryForm((prev) => ({
                        ...prev,
                        school_class_id: value,
                      }));
                    }}
                    disabled={loadingClasses}
                  >
                    <option value="">All classes</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={String(schoolClass.id)}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <form onSubmit={handleCategorySubmit} className="mb-3">
                <input type="hidden" value={categoryForm.id} />
                <div className="form-group">
                  <label className="text-dark-medium">Category Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={categoryForm.name}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        name: event.target.value,
                      }))
                    }
                    maxLength={100}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="text-dark-medium">Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    value={categoryForm.description}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    maxLength={255}
                  />
                </div>
                {categorySeparatedByClass ? (
                  <div className="form-group">
                    <label className="text-dark-medium">Scope</label>
                    <select
                      className="form-control"
                      value={categoryForm.school_class_id}
                      onChange={(event) =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          school_class_id: event.target.value,
                        }))
                      }
                      disabled={loadingClasses}
                    >
                      <option value="">All classes</option>
                      {classes.map((schoolClass) => (
                        <option key={schoolClass.id} value={String(schoolClass.id)}>
                          {schoolClass.name}
                        </option>
                      ))}
                    </select>
                    <small className="form-text text-muted">
                      Leave this on All classes to share the category across the school.
                    </small>
                  </div>
                ) : null}
                <div className="d-flex align-items-center">
                  <button
                    type="submit"
                    className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                    disabled={categorySubmitting}
                  >
                    {categoryForm.id ? "Update Category" : "Save Category"}
                  </button>
                  <button
                    type="button"
                    className={`btn-fill-lg btn-light ml-3 ${
                      categoryForm.id ? "" : "d-none"
                    }`}
                    onClick={cancelCategoryEdit}
                    disabled={categorySubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>

              {categoryFeedback ? (
                <div
                  className={`alert alert-${categoryFeedback.type}`}
                  role="alert"
                >
                  {categoryFeedback.message}
                </div>
              ) : null}

              <div className="table-responsive">
                <table className="table display text-nowrap">
                  <thead>
                    <tr>
                      <th>Name</th>
                      {categorySeparatedByClass ? <th>Scope</th> : null}
                      <th>Skills</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>{renderCategoryTable()}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card height-auto mb-4">
            <div className="card-body">
              <div className="heading-layout1 mb-3">
                <div className="item-title">
                  <h3>Skills</h3>
                </div>
                <div className="dropdown">
                  <button
                    className="dropdown-toggle"
                    type="button"
                    data-toggle="dropdown"
                  >
                    ...
                  </button>
                  <div className="dropdown-menu dropdown-menu-right">
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={refreshSkillTypes}
                    >
                      <i className="fas fa-redo-alt text-orange-peel" /> Refresh
                    </button>
                  </div>
                </div>
              </div>

              {usesClassScopedSkills ? (
                <div className="form-group">
                  <label className="text-dark-medium">Skill Class Scope</label>
                  <select
                    className="form-control"
                    value={scopeClassFilter}
                    onChange={(event) => {
                      const value = event.target.value;
                      setScopeClassFilter(value);
                      setSkillForm((prev) => ({
                        ...prev,
                        school_class_id: value,
                      }));
                    }}
                    disabled={loadingClasses}
                  >
                    <option value="">All classes</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={String(schoolClass.id)}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                  <small className="form-text text-muted">
                    Global skills still appear for every class. Class-specific skills only appear in their selected class.
                  </small>
                </div>
              ) : null}

              <form onSubmit={handleSkillSubmit} className="mb-3">
                <input type="hidden" value={skillForm.id} />
                <div className="form-row">
                  <div className={`form-group ${skillForm.id || skillSeparatedByClass ? "col-md-4" : "col-md-6"}`}>
                    <label className="text-dark-medium">Category</label>
                    <select
                      className="form-control"
                      required
                      value={skillForm.skill_category_id}
                      onChange={(event) =>
                        setSkillForm((prev) => ({
                          ...prev,
                          skill_category_id: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={String(category.id)}>
                          {categorySeparatedByClass
                            ? `${category.name} (${scopeLabel(category.school_class_id)})`
                            : category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {skillSeparatedByClass ? (
                    <div className="form-group col-md-4">
                      <label className="text-dark-medium">Scope</label>
                      <select
                        className="form-control"
                        value={skillForm.school_class_id}
                        onChange={(event) =>
                          setSkillForm((prev) => ({
                            ...prev,
                            school_class_id: event.target.value,
                          }))
                        }
                        disabled={loadingClasses}
                      >
                        <option value="">All classes</option>
                        {classes.map((schoolClass) => (
                          <option key={schoolClass.id} value={String(schoolClass.id)}>
                            {schoolClass.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {skillForm.id ? (
                    <div className={`form-group ${skillSeparatedByClass ? "col-md-4" : "col-md-6"}`}>
                      <label className="text-dark-medium">Skill Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={skillForm.name}
                        onChange={(event) =>
                          setSkillForm((prev) => ({
                            ...prev,
                            name: event.target.value,
                          }))
                        }
                        placeholder="e.g. Punctuality"
                        maxLength={500}
                        required
                      />
                    </div>
                  ) : null}
                </div>

                {!skillForm.id ? (
                  <div className="form-group">
                    <label className="text-dark-medium">Skill Names</label>
                    {skillForm.names.map((entry, index) => (
                      <div key={`skill-name-${index}`} className="d-flex align-items-start mb-2">
                        <textarea
                          className="form-control"
                          rows={2}
                          value={entry}
                          onChange={(event) =>
                            handleSkillNameFieldChange(index, event.target.value)
                          }
                          placeholder="e.g. Explores objects by linking together different approaches..."
                          maxLength={500}
                        />
                        <button
                          type="button"
                          className="btn btn-link text-danger ml-2 p-0"
                          onClick={() => handleRemoveSkillNameField(index)}
                          disabled={skillSubmitting}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                      onClick={handleAddSkillNameField}
                      disabled={skillSubmitting}
                    >
                      Add another skill
                    </button>
                    <small className="form-text text-muted">
                      Each box is one skill name. Long names and commas are allowed.
                    </small>
                  </div>
                ) : null}

                <div className="form-row">
                  <div className="form-group col-md-4">
                    <label className="text-dark-medium">Weight</label>
                    <input
                      type="number"
                      className="form-control"
                      step={0.01}
                      min={0}
                      max={999.99}
                      value={skillForm.weight}
                      onChange={(event) =>
                        setSkillForm((prev) => ({
                          ...prev,
                          weight: event.target.value,
                        }))
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div className="form-group col-md-8">
                    <label className="text-dark-medium">Description</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={skillForm.description}
                      onChange={(event) =>
                        setSkillForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                      maxLength={500}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="d-flex align-items-center">
                  <button
                    type="submit"
                    className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                    disabled={skillSubmitting}
                  >
                    {skillForm.id ? "Update Skill" : "Save Skills"}
                  </button>
                  <button
                    type="button"
                    className={`btn-fill-lg btn-light ml-3 ${
                      skillForm.id ? "" : "d-none"
                    }`}
                    onClick={cancelSkillEdit}
                    disabled={skillSubmitting}
                  >
                    Cancel
                  </button>
                </div>
              </form>

              {skillFeedback ? (
                <div
                  className={`alert alert-${skillFeedback.type}`}
                  role="alert"
                >
                  {skillFeedback.message}
                </div>
              ) : null}

              <div className="form-group mb-3">
                <label className="text-dark-medium">Filter by Category</label>
                <select
                  className="form-control"
                  value={skillCategoryFilter}
                  onChange={(event) =>
                    setSkillCategoryFilter(event.target.value)
                  }
                >
                  <option value="">All categories</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {categorySeparatedByClass
                        ? `${category.name} (${scopeLabel(category.school_class_id)})`
                        : category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex align-items-center mb-3 flex-wrap">
                <button
                  type="button"
                  className="btn btn-light mr-2"
                  onClick={toggleSelectAllVisibleSkills}
                  disabled={!skillTypes.length || skillSubmitting}
                >
                  {allVisibleSelected ? "Unselect all" : "Select all visible"}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteSelectedSkills}
                  disabled={!selectedSkillIds.length || skillSubmitting}
                >
                  Delete selected ({selectedSkillIds.length})
                </button>
                {skillSeparatedByClass ? (
                  <>
                    <select
                      className="form-control ml-2 mr-2"
                      style={{ width: 220 }}
                      value={bulkAssignClassId}
                      onChange={(event) => setBulkAssignClassId(event.target.value)}
                      disabled={skillSubmitting}
                    >
                      <option value="">All classes</option>
                      {classes.map((schoolClass) => (
                        <option key={schoolClass.id} value={String(schoolClass.id)}>
                          {schoolClass.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleAssignSelectedSkills}
                      disabled={!selectedSkillIds.length || skillSubmitting}
                    >
                      Move selected
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary ml-2"
                      onClick={handleCopySelectedSkills}
                      disabled={!selectedSkillIds.length || skillSubmitting}
                    >
                      Copy selected
                    </button>
                  </>
                ) : null}
              </div>

              <div className="table-responsive">
                <table className="table display text-nowrap">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Skill</th>
                      <th>Category</th>
                      {usesClassScopedSkills ? <th>Scope</th> : null}
                      <th>Weight</th>
                      <th>Description</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>{renderSkillTable()}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
