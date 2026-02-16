"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listParents, type Parent } from "@/lib/parents";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import {
  listClassArmSections,
  type ClassArmSection,
} from "@/lib/classArmSections";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import {
  listCountries,
  listStates,
  listLgas,
  listBloodGroups,
  type Country,
  type State,
  type Lga,
  type BloodGroup,
} from "@/lib/locations";
import {
  getStudent,
  updateStudent as updateStudentRequest,
  type StudentDetail,
} from "@/lib/students";

interface StudentFormState {
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  admission_date: string;
  admission_no: string;
  house: string;
  club: string;
  current_session_id: string;
  current_term_id: string;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
  parent_id: string;
  status: string;
  address: string;
  medical_information: string;
  blood_group_id: string;
}

const initialForm: StudentFormState = {
  first_name: "",
  middle_name: "",
  last_name: "",
  gender: "",
  date_of_birth: "",
  admission_date: "",
  admission_no: "",
  house: "",
  club: "",
  current_session_id: "",
  current_term_id: "",
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
  parent_id: "",
  status: "",
  address: "",
  medical_information: "",
  blood_group_id: "",
};

const studentStatuses = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "graduated", label: "Graduated" },
];

const genders = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const normalizeGenderValue = (value?: string | null): string => {
  if (!value) {
    return "";
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized === "m") {
    return "male";
  }
  if (normalized === "female" || normalized === "f") {
    return "female";
  }
  return normalized;
};

const dateToInputValue = (value?: string | null): string => {
  if (!value) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};

const toIsoDate = (value: string): string => {
  if (!value) {
    return "";
  }
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const parts = raw.split(/[\/\-.]/).map((segment) => segment.trim()).filter(Boolean);
  if (parts.length === 3) {
    const [first, second, third] = parts;
    let year = "";
    let month = "";
    let day = "";

    if (/^\d{4}$/.test(first)) {
      year = first;
      month = second;
      day = third;
    } else {
      day = first;
      month = second;
      year = third.length === 2 ? `20${third}` : third;
    }

    const pad = (segment: string, size: number) =>
      String(segment ?? "").padStart(size, "0");

    const candidate = `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return candidate;
    }
  }
  return raw;
};

export default function EditStudentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id");
  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    const search = searchParams.get("search");
    const currentSessionId = searchParams.get("current_session_id");
    const schoolClassId = searchParams.get("school_class_id");
    const classArmId = searchParams.get("class_arm_id");
    const classSectionId = searchParams.get("class_section_id");
    const page = searchParams.get("page");
    const perPage = searchParams.get("per_page");
    const sortBy = searchParams.get("sortBy");
    const sortDirection = searchParams.get("sortDirection");

    if (search) {
      params.set("search", search);
    }
    if (currentSessionId) {
      params.set("current_session_id", currentSessionId);
    }
    if (schoolClassId) {
      params.set("school_class_id", schoolClassId);
    }
    if (classArmId) {
      params.set("class_arm_id", classArmId);
    }
    if (classSectionId) {
      params.set("class_section_id", classSectionId);
    }
    if (page) {
      params.set("page", page);
    }
    if (perPage) {
      params.set("per_page", perPage);
    }
    if (sortBy) {
      params.set("sortBy", sortBy);
    }
    if (sortDirection) {
      params.set("sortDirection", sortDirection);
    }

    return params.toString();
  }, [searchParams]);

  const allStudentsHref = useMemo(() => {
    return filterQuery ? `/v14/all-students?${filterQuery}` : "/v14/all-students";
  }, [filterQuery]);

  const [form, setForm] = useState<StudentFormState>(initialForm);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [classSections, setClassSections] = useState<ClassArmSection[]>([]);
  void classSections;
  const [parents, setParents] = useState<Parent[]>([]);

  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [lgas, setLgas] = useState<Lga[]>([]);
  const [bloodGroups, setBloodGroups] = useState<BloodGroup[]>([]);

  const [countryId, setCountryId] = useState("");
  const [stateId, setStateId] = useState("");
  const [lgaValue, setLgaValue] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => console.error("Unable to load sessions", err));
    listClasses()
      .then(setClasses)
      .catch((err) => console.error("Unable to load classes", err));
    listParents()
      .then(setParents)
      .catch((err) => console.error("Unable to load parents", err));
    listCountries()
      .then(setCountries)
      .catch((err) => console.error("Unable to load countries", err));
    listBloodGroups()
      .then(setBloodGroups)
      .catch((err) => console.error("Unable to load blood groups", err));
  }, []);

  useEffect(() => {
    if (!studentId) {
      router.replace(allStudentsHref);
      return;
    }

    const normalizedStudentId = String(studentId);

    async function hydrate() {
      try {
        const detail = await getStudent(normalizedStudentId);
        if (!detail) {
          throw new Error("Student not found.");
        }
        setStudent(detail);
        setForm({
          first_name: detail.first_name ?? "",
          middle_name: detail.middle_name ?? "",
          last_name: detail.last_name ?? "",
          gender: normalizeGenderValue(detail.gender),
          date_of_birth: dateToInputValue(detail.date_of_birth),
          admission_date: dateToInputValue(detail.admission_date),
          admission_no: detail.admission_no ?? "",
          house: `${detail.house ?? ""}`,
          club: `${detail.club ?? ""}`,
          current_session_id: `${detail.current_session_id ?? detail.session?.id ?? ""}`,
          current_term_id: `${detail.current_term_id ?? (detail.term as { id?: string | number })?.id ?? ""}`,
          school_class_id: `${detail.school_class_id ?? detail.school_class?.id ?? ""}`,
          class_arm_id: `${detail.class_arm_id ?? detail.class_arm?.id ?? detail.school_class?.class_arm?.id ?? ""}`,
          class_section_id: `${detail.class_section_id ?? detail.class_section?.id ?? ""}`,
          parent_id: `${detail.parent_id ?? detail.parent?.id ?? ""}`,
          status: detail.status ?? "",
          address: detail.address ?? "",
          medical_information: detail.medical_information ?? "",
          blood_group_id: `${detail.blood_group_id ?? detail.blood_group?.id ?? ""}`,
        });

        if (detail.nationality) {
          setCountryId(detail.nationality);
        }
        if (detail.state_of_origin) {
          setStateId(detail.state_of_origin);
        }
        if (detail.lga_of_origin) {
          setLgaValue(detail.lga_of_origin);
        }

        setError(null);
      } catch (err) {
        console.error("Unable to load student detail", err);
        setError(
          err instanceof Error ? err.message : "Unable to load student.",
        );
      } finally {
        setLoading(false);
      }
    }

    hydrate().catch((err) => console.error(err));
  }, [studentId, router, allStudentsHref]);

  useEffect(() => {
    if (!form.current_session_id) {
      setTerms([]);
      setForm((prev) => ({
        ...prev,
        current_term_id: "",
      }));
      return;
    }

    listTermsBySession(form.current_session_id)
      .then((data) => {
        setTerms(data);
        if (!data.find((term) => `${term.id}` === form.current_term_id)) {
          setForm((prev) => ({
            ...prev,
            current_term_id: "",
          }));
        }
      })
      .catch((err) =>
        console.error("Unable to load terms for session", err),
      );
  }, [form.current_session_id, form.current_term_id]);

  useEffect(() => {
    if (!form.school_class_id) {
      setClassArms([]);
      setClassSections([]);
      setForm((prev) => ({
        ...prev,
        class_arm_id: "",
        class_section_id: "",
      }));
      return;
    }

    listClassArms(form.school_class_id)
      .then((data) => {
        setClassArms(data);
        if (!data.find((arm) => `${arm.id}` === form.class_arm_id)) {
          setForm((prev) => ({
            ...prev,
            class_arm_id: "",
            class_section_id: "",
          }));
          setClassSections([]);
        }
      })
      .catch((err) =>
        console.error("Unable to load class arms for class", err),
      );
  }, [form.school_class_id, form.class_arm_id, form.class_section_id]);

  useEffect(() => {
    if (!form.school_class_id || !form.class_arm_id) {
      setClassSections([]);
      setForm((prev) => ({
        ...prev,
        class_section_id: "",
      }));
      return;
    }

    listClassArmSections(form.school_class_id, form.class_arm_id)
      .then((data) => {
        setClassSections(data);
        if (
          !data.find((section) => `${section.id}` === form.class_section_id)
        ) {
          setForm((prev) => ({
            ...prev,
            class_section_id: "",
          }));
        }
      })
      .catch((err) =>
        console.error("Unable to load class sections for class", err),
      );
  }, [form.school_class_id, form.class_arm_id, form.class_section_id]);

  useEffect(() => {
    if (!countryId) {
      setStates([]);
      setStateId("");
      setLgas([]);
      setLgaValue("");
      return;
    }

    const matchedCountry =
      countries.find(
        (country) =>
          `${country.id}` === countryId ||
          (country.name ?? "").toLowerCase() === countryId.toLowerCase(),
      ) ?? null;

    const effectiveCountryId = matchedCountry
      ? `${matchedCountry.id}`
      : countryId;

    listStates(effectiveCountryId)
      .then((data) => {
        setStates(data);
        if (!stateId) {
          return;
        }
        const match = data.find((state) => {
          const id = `${state.id}`;
          const name = (state.name ?? "").toLowerCase();
          const target = stateId.toLowerCase();
          return id === stateId || name === target;
        });
        if (match) {
          const normalizedId = `${match.id}`;
          if (normalizedId !== stateId) {
            setStateId(normalizedId);
          }
          return;
        }
        setStateId("");
        setLgas([]);
        setLgaValue("");
      })
      .catch((err) => console.error("Unable to load states", err));
  }, [countryId, countries, stateId]);

  useEffect(() => {
    if (!stateId) {
      setLgas([]);
      setLgaValue("");
      return;
    }

    const matchedState =
      states.find(
        (state) =>
          `${state.id}` === stateId ||
          (state.name ?? "").toLowerCase() === stateId.toLowerCase(),
      ) ?? null;

    // Only load LGAs once we can resolve the state to a known ID.
    if (!matchedState) {
      return;
    }
    const effectiveStateId = `${matchedState.id}`;

    listLgas(effectiveStateId)
      .then((data) => {
        setLgas(data);
        if (!lgaValue) {
          return;
        }
        const target = lgaValue.toLowerCase();
        const match = data.find((lga) => {
          const id = lga.id != null ? `${lga.id}` : null;
          const name = (lga.name ?? "").toLowerCase();
          return id === lgaValue || name === target;
        });
        if (match) {
          const normalizedValue =
            match.id != null
              ? `${match.id}`
              : (match.name ?? "").trim();
          if (normalizedValue && normalizedValue !== lgaValue) {
            setLgaValue(normalizedValue);
          }
          return;
        }
        setLgaValue("");
      })
      .catch((err) => console.error("Unable to load LGAs", err));
  }, [stateId, states, lgaValue]);

  useEffect(() => {
    if (student) {
      const countryMatch =
        countries.find(
          (country) =>
            `${country.id}` === student.nationality ||
            country.name?.toLowerCase() ===
              student.nationality?.toLowerCase(),
        ) ?? null;
      if (countryMatch) {
        setCountryId(`${countryMatch.id}`);
      } else if (student.nationality) {
        setCountryId(student.nationality);
      }

      if (student.state_of_origin) {
        setStateId(student.state_of_origin);
      }
      if (student.lga_of_origin) {
        setLgaValue(student.lga_of_origin);
      }
    }
  }, [student, countries]);

  const nationalityName = useMemo(() => {
    const match =
      countries.find(
        (country) =>
          `${country.id}` === countryId ||
          (country.name ?? "").toLowerCase() === countryId.toLowerCase(),
      ) ?? null;
    return match?.name ?? countryId ?? "";
  }, [countries, countryId]);

  const stateName = useMemo(() => {
    const match =
      states.find(
        (state) =>
          `${state.id}` === stateId ||
          (state.name ?? "").toLowerCase() === stateId.toLowerCase(),
      ) ?? null;
    return match?.name ?? stateId ?? "";
  }, [states, stateId]);

  const lgaName = useMemo(() => {
    if (!lgaValue) {
      return "";
    }
    const match =
      lgas.find(
        (lga) =>
          `${lga.id}` === lgaValue ||
          (lga.name ?? "").toLowerCase() === lgaValue.toLowerCase(),
      ) ?? null;
    return match?.name ?? lgaValue;
  }, [lgas, lgaValue]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentId) {
      return;
    }
    setError(null);

    const requiredFields: Array<[keyof StudentFormState, string]> = [
      ["first_name", "First name"],
      ["last_name", "Last name"],
      ["gender", "Gender"],
      ["date_of_birth", "Date of birth"],
      ["admission_date", "Admission date"],
      ["current_session_id", "Academic session"],
      ["current_term_id", "Term"],
      ["school_class_id", "Class"],
      ["status", "Status"],
    ];

    const missing = requiredFields.find(
      ([key]) => !form[key] || !form[key].trim?.(),
    );
    if (missing) {
      setError(`${missing[1]} is required.`);
      return;
    }

    const payload = new FormData();
    payload.append("first_name", form.first_name.trim());
    payload.append("middle_name", form.middle_name.trim());
    payload.append("last_name", form.last_name.trim());
    payload.append("gender", form.gender);
    payload.append("date_of_birth", toIsoDate(form.date_of_birth));
    payload.append("admission_date", toIsoDate(form.admission_date));
    if (form.admission_no) {
      payload.append("admission_no", form.admission_no.trim());
    }
    payload.append("house", form.house.trim());
    payload.append("club", form.club.trim());
    payload.append("current_session_id", form.current_session_id);
    payload.append("current_term_id", form.current_term_id);
    payload.append("school_class_id", form.school_class_id);
    if (form.class_arm_id) {
      payload.append("class_arm_id", form.class_arm_id);
    }
    if (form.parent_id) {
      payload.append("parent_id", form.parent_id);
    }
    payload.append("status", form.status);
    payload.append("address", form.address.trim());
    payload.append("medical_information", form.medical_information.trim());
    if (form.blood_group_id) {
      payload.append("blood_group_id", form.blood_group_id);
    }

    if (nationalityName) {
      payload.append("nationality", nationalityName);
    }
    if (stateName) {
      payload.append("state_of_origin", stateName);
    }
    if (lgaName) {
      payload.append("lga_of_origin", lgaName);
    }

    if (photoFile) {
      payload.append("photo", photoFile);
    }

    setSubmitting(true);
    try {
      await updateStudentRequest(studentId, payload);
      router.push(
        filterQuery
          ? `/v14/student-details?id=${studentId}&${filterQuery}`
          : `/v14/student-details?id=${studentId}`,
      );
    } catch (err) {
      console.error("Unable to update student", err);
      setError(
        err instanceof Error ? err.message : "Unable to update student.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (key: keyof StudentFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  if (!studentId) {
    return null;
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href={allStudentsHref}>All Students</Link>
          </li>
          <li>Edit Student</li>
        </ul>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Edit Student</h3>
            </div>
          </div>

          <form id="edit-student-form" className="new-added-form" onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Admission Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.admission_no}
                  onChange={(event) =>
                    setField("admission_no", event.target.value)
                  }
                />
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>First Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.first_name}
                  onChange={(event) => setField("first_name", event.target.value)}
                  required
                />
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Middle Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.middle_name}
                  onChange={(event) =>
                    setField("middle_name", event.target.value)
                  }
                />
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Last Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.last_name}
                  onChange={(event) => setField("last_name", event.target.value)}
                  required
                />
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Gender *</label>
                <select
                  className="form-control"
                  value={form.gender}
                  onChange={(event) => setField("gender", event.target.value)}
                  required
                >
                  <option value="">Select Gender *</option>
                  {genders.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Date of Birth *</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.date_of_birth}
                  onChange={(event) => setField("date_of_birth", event.target.value)}
                  required
                />
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Country *</label>
                <select
                  id="country-id"
                  className="form-control"
                  value={countryId}
                  onChange={(event) => {
                    setCountryId(event.target.value);
                    setStateId("");
                    setLgaValue("");
                  }}
                  required
                >
                  <option value="">Please Select Country *</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>State of Origin *</label>
                <select
                  id="state-of-origin"
                  className="form-control"
                  value={stateId}
                  onChange={(event) => {
                    setStateId(event.target.value);
                    setLgaValue("");
                  }}
                  disabled={!countryId}
                  required
                >
                  <option value="">Please Select State *</option>
                  {states.map((state) => (
                    <option key={state.id} value={state.id}>
                      {state.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>LGA of Origin *</label>
                <select
                  id="lga-of-origin"
                  className="form-control"
                  value={lgaValue}
                  onChange={(event) => setLgaValue(event.target.value)}
                  disabled={!stateId}
                  required
                >
                  <option value="">Please Select LGA *</option>
                  {lgas.map((lga) => (
                    <option
                      key={`${lga.id ?? lga.name}`}
                      value={lga.id != null ? `${lga.id}` : lga.name ?? ""}
                    >
                      {lga.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Blood Group</label>
                <select
                  id="blood-group"
                  className="form-control"
                  value={form.blood_group_id}
                  onChange={(event) =>
                    setField("blood_group_id", event.target.value)
                  }
                >
                  <option value="">Please Select Blood Group</option>
                  {bloodGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Admission Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={form.admission_date}
                  onChange={(event) =>
                    setField("admission_date", event.target.value)
                  }
                  required
                />
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>House (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.house}
                  onChange={(event) => setField("house", event.target.value)}
                />
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Club (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.club}
                  onChange={(event) => setField("club", event.target.value)}
                />
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Academic Session *</label>
                <select
                  id="session-id"
                  className="form-control"
                  value={form.current_session_id}
                  onChange={(event) =>
                    setField("current_session_id", event.target.value)
                  }
                  required
                >
                  <option value="">Please Select Session *</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Term *</label>
                <select
                  id="term-id"
                  className="form-control"
                  value={form.current_term_id}
                  onChange={(event) =>
                    setField("current_term_id", event.target.value)
                  }
                  disabled={!form.current_session_id}
                  required
                >
                  <option value="">Please Select Term *</option>
                  {terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Assigned Class *</label>
                <select
                  id="class-id"
                  className="form-control"
                  value={form.school_class_id}
                  onChange={(event) =>
                    setField("school_class_id", event.target.value)
                  }
                  required
                >
                  <option value="">Please Select Class *</option>
                  {classes.map((_class) => (
                    <option key={_class.id} value={_class.id}>
                      {_class.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Assigned Class Arm</label>
                <select
                  id="class-arm-id"
                  className="form-control"
                  value={form.class_arm_id}
                  onChange={(event) =>
                    setField("class_arm_id", event.target.value)
                  }
                  disabled={!form.school_class_id}
                >
                  <option value="">None</option>
                  {classArms.map((arm) => (
                    <option key={arm.id} value={arm.id}>
                      {arm.name}
                    </option>
                  ))}
                </select>
              </div>
              {/*
                Class section selection hidden per request
                <div className="col-xl-3 col-lg-6 col-12 form-group">
                  <label>Assigned Class Section</label>
                  <select
                    id="class-section-id"
                    className="form-control"
                    value={form.class_section_id}
                    onChange={(event) =>
                      setField("class_section_id", event.target.value)
                    }
                    disabled={!form.class_arm_id}
                  >
                    <option value="">Please Select Section</option>
                    {classSections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>
              */}
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Assigned Parent</label>
                <select
                  id="parent-id"
                  className="form-control"
                  value={form.parent_id}
                  onChange={(event) =>
                    setField("parent_id", event.target.value)
                  }
                >
                  <option value="">Please Select Parent</option>
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {`${parent.first_name ?? ""} ${parent.last_name ?? ""}`.trim() ||
                        parent.phone ||
                        parent.email ||
                        `Parent #${parent.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Status *</label>
                <select
                  id="status"
                  className="form-control"
                  value={form.status}
                  onChange={(event) => setField("status", event.target.value)}
                  required
                >
                  <option value="">Please Select Status *</option>
                  {studentStatuses.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-3 col-12 form-group">
                <label className="text-dark-medium">
                  Upload Student Photo (150px x 150px)
                </label>
                <input
                  type="file"
                  className="form-control-file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setPhotoFile(file);
                  }}
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label>Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.address}
                  onChange={(event) => setField("address", event.target.value)}
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label>Medical Information</label>
                <textarea
                  id="medical-info"
                  className="textarea form-control"
                  rows={3}
                  value={form.medical_information}
                  onChange={(event) =>
                    setField("medical_information", event.target.value)
                  }
                />
              </div>
              <div className="col-12 form-group mg-t-8">
                <button
                  type="submit"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save Changes"}
                </button>
                <Link
                  href={
                    filterQuery
                      ? `/v14/student-details?id=${studentId}&${filterQuery}`
                      : `/v14/student-details?id=${studentId}`
                  }
                  className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
