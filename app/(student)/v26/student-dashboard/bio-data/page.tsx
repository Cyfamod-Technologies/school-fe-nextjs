"use client";

import Link from "next/link";
import { useStudentAuth } from "@/contexts/StudentAuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { updateStudentProfile } from "@/lib/studentAuth";
import { upsertStudentParent } from "@/lib/studentParents";
import { listCountries, listStates, listLgas, listBloodGroups } from "@/lib/locations";
import type { Country, State, Lga, BloodGroup } from "@/lib/locations";

const styles = `
.bio-data-container {
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  min-height: 100vh;
  padding-top: 2rem;
}

.bio-data-card {
  border: none;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-bottom: 2rem;
}

.bio-data-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.bio-data-header h3 {
  font-size: 1.5rem;
  margin: 0;
}

.bio-data-body {
  padding: 1.5rem;
}

.form-section {
  margin-bottom: 2rem;
}

.form-section-title {
  color: #667eea;
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #667eea;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  color: #2d3748;
  font-weight: 600;
  margin-bottom: 0.5rem;
  display: block;
}

.form-group.required label::after {
  content: " *";
  color: #e53e3e;
}

.form-group input,
.form-group select,
.form-group textarea {
  border: 2px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.75rem;
  width: 100%;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-group input[readonly] {
  background-color: #f7fafc;
  cursor: not-allowed;
}

.form-group input[readonly] {
  background-color: #f7fafc;
  cursor: not-allowed;
}

.form-group textarea {
  resize: vertical;
  min-height: 100px;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
}

.form-hint {
  color: #718096;
  font-size: 0.85rem;
  margin-top: 0.25rem;
}

.passport-upload-section {
  border: 2px dashed #e2e8f0;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  background: #f7fafc;
  cursor: pointer;
  transition: all 0.3s ease;
}

.passport-upload-section:hover {
  border-color: #667eea;
  background: #f0f4ff;
}

.passport-upload-section.has-image {
  border-style: solid;
  padding: 1rem;
}

.passport-preview {
  max-width: 150px;
  max-height: 150px;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.passport-upload-label {
  color: #667eea;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.passport-upload-hint {
  color: #718096;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

#passport-input {
  display: none;
}

.form-actions {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid #e2e8f0;
}

.btn-submit {
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
  font-size: 1rem;
}

.btn-submit-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-submit-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(102, 126, 234, 0.4);
}

.btn-submit-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-cancel {
  background: #f7fafc;
  color: #667eea;
  border: 2px solid #667eea;
}

.btn-cancel:hover {
  background: #667eea;
  color: white;
}

.alert {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.alert-success {
  background: #c6f6d5;
  color: #22543d;
  border: 1px solid #9ae6b4;
}

.alert-error {
  background: #fed7d7;
  color: #742a2a;
  border: 1px solid #fc8181;
}

.alert-info {
  background: #bee3f8;
  color: #2c5282;
  border: 1px solid #90cdf4;
}

.breadcrumbs-area {
  margin-bottom: 2rem;
  color: #0f172a;
}

.breadcrumbs-area h3 {
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.breadcrumbs-area ul {
  background: transparent;
  padding: 0;
}

.parent-type-selector {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.parent-type-btn {
  padding: 0.6rem 1.2rem;
  border: 2px solid #e2e8f0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.3s ease;
}

.parent-type-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .bio-data-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .form-actions {
    flex-direction: column;
  }

  .btn-submit,
  .btn-cancel {
    width: 100%;
    text-align: center;
  }
}
`;

interface PersonalData {
  first_name: string;
  middle_name?: string;
  last_name: string;
  gender?: string;
  date_of_birth?: string;
  nationality?: string;
  state_of_origin?: string;
  lga_of_origin?: string;
  blood_group_id?: string;
  house?: string;
  club?: string;
  address?: string;
  medical_information?: string;
}

interface ParentData {
  relationship?: string;
  first_name: string;
  middle_name?: string;
  last_name: string;
  phone: string;
  email?: string;
  occupation?: string;
  address?: string;
}

export default function StudentBioDataPage() {
  const { student, loading, refresh } = useStudentAuth();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const [personalData, setPersonalData] = useState<PersonalData>({
    first_name: "",
    middle_name: "",
    last_name: "",
    gender: "",
    date_of_birth: "",
    nationality: "",
    state_of_origin: "",
    lga_of_origin: "",
    house: "",
    club: "",
    address: "",
    medical_information: "",
  });

  const [parentData, setParentData] = useState<ParentData>({
    relationship: "mother",
    first_name: "",
    middle_name: "",
    last_name: "",
    phone: "",
    email: "",
    occupation: "",
    address: "",
  });

  // Dropdown data states
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [lgas, setLgas] = useState<Lga[]>([]);
  const [bloodGroups, setBloodGroups] = useState<BloodGroup[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");

  // Passport file states
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState<string>("");

  useEffect(() => {
    if (!loading && !student) {
      router.push("/student-login");
    }
  }, [loading, student, router]);

  // Load countries and blood groups on mount
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const data = await listCountries({ authScope: "student" });
        setCountries(data);
      } catch (error) {
        console.error("Failed to load countries:", error);
      }
    };
    const loadBloodGroups = async () => {
      try {
        const data = await listBloodGroups({ authScope: "student" });
        setBloodGroups(data);
      } catch (error) {
        console.error("Failed to load blood groups:", error);
      }
    };
    void loadCountries();
    void loadBloodGroups();
  }, [student]);

  useEffect(() => {
    if (!student?.nationality || !countries.length || selectedCountry) {
      return;
    }

    const normalizedNationality = student.nationality.trim().toLowerCase();
    if (!normalizedNationality) {
      return;
    }

    const match = countries.find((country) => {
      const name = String(country.name ?? "").trim().toLowerCase();
      if (!name) return false;
      if (name === normalizedNationality) return true;
      if (normalizedNationality === `${name}n`) return true;
      if (normalizedNationality.endsWith("n") && normalizedNationality.slice(0, -1) === name) {
        return true;
      }
      return normalizedNationality.includes(name) || name.includes(normalizedNationality);
    });

    if (match) {
      setSelectedCountry(String(match.id));
    }
  }, [student?.nationality, countries, selectedCountry]);

  // Load states when country changes
  useEffect(() => {
    const loadStates = async () => {
      if (!selectedCountry) return;
      try {
        const data = await listStates(selectedCountry, { authScope: "student" });
        setStates(data);
        setLgas([]);
        setSelectedState("");
        
        // Pre-select state if student has one
        if (student?.state_of_origin) {
          const state = data.find(s => s.name === student.state_of_origin);
          if (state) {
            setSelectedState(String(state.id));
          }
        }
      } catch (error) {
        console.error("Failed to load states:", error);
      }
    };
    void loadStates();
  }, [selectedCountry, student?.state_of_origin]);

  // Load LGAs when state changes
  useEffect(() => {
    const loadLgas = async () => {
      if (!selectedState) return;
      try {
        const data = await listLgas(selectedState, { authScope: "student" });
        setLgas(data);
        
        // Pre-select LGA if student has one
        if (student?.lga_of_origin) {
          const lga = data.find(l => l.name === student.lga_of_origin);
          if (lga) {
            setPersonalData(prev => ({ ...prev, lga_of_origin: lga.name }));
          }
        }
      } catch (error) {
        console.error("Failed to load LGAs:", error);
      }
    };
    void loadLgas();
  }, [selectedState, student?.lga_of_origin]);

  useEffect(() => {
    if (student) {
      // Normalize gender to lowercase full word for dropdown matching
      const rawGender = (student.gender ?? "").trim().toLowerCase();
      let normalizedGender = "";
      if (rawGender === "m" || rawGender === "male") normalizedGender = "male";
      else if (rawGender === "f" || rawGender === "female") normalizedGender = "female";
      else if (rawGender === "o" || rawGender === "other" || rawGender === "others") normalizedGender = "other";

      setPersonalData({
        first_name: student.first_name ?? "",
        middle_name: student.middle_name ?? "",
        last_name: student.last_name ?? "",
        gender: normalizedGender,
        date_of_birth: student.date_of_birth ?? "",
        nationality: student.nationality ?? "",
        state_of_origin: student.state_of_origin ?? "",
        lga_of_origin: student.lga_of_origin ?? "",
        blood_group_id: student.blood_group?.id ?? "",
        house: student.house ?? "",
        club: student.club ?? "",
        address: student.address ?? "",
        medical_information: student.medical_information ?? "",
      });

      // Show passport preview if student has one
      if (student.photo_url) {
        setPassportPreview(student.photo_url);
      }

      if (student.parent) {
        setParentData((prev) => ({
          ...prev,
          relationship: "mother",
          first_name: student.parent?.first_name ?? "",
          middle_name: student.parent?.middle_name ?? "",
          last_name: student.parent?.last_name ?? "",
          phone: student.parent?.phone ?? "",
          email: student.parent?.email ?? "",
        }));
      }
    }
  }, [student]);

  if (loading || !student) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-muted mb-0">Loading bio-data…</p>
        </div>
      </div>
    );
  }

  const handlePersonalDataChange = (
    field: keyof PersonalData,
    value: string,
  ) => {
    setPersonalData((prev) => ({ ...prev, [field]: value }));
  };

  const handleParentDataChange = (field: keyof ParentData, value: string) => {
    setParentData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePassportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/") && !file.type.includes("pdf")) {
        setMessage({
          type: "error",
          text: "Please upload an image or PDF file",
        });
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({
          type: "error",
          text: "File size must be less than 5MB",
        });
        return;
      }

      setPassportFile(file);

      // Create preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPassportPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPassportPreview("📄 PDF File");
      }

      setMessage(null);
    }
  };

  const handleRemovePassport = () => {
    setPassportFile(null);
    setPassportPreview("");
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Update personal data
      const formData = new FormData();

      // Map dropdown selections back to names for nationality & state_of_origin
      const dataToSave = { ...personalData };
      if (selectedCountry) {
        const country = countries.find((c) => String(c.id) === selectedCountry);
        if (country) dataToSave.nationality = country.name;
      }
      if (selectedState) {
        const state = states.find((s) => String(s.id) === selectedState);
        if (state) dataToSave.state_of_origin = state.name;
      }

      Object.entries(dataToSave).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      // Add passport file if selected
      if (passportFile) {
        formData.append("photo_url", passportFile);
      }

      await updateStudentProfile(formData);

      // Update or create parent data if provided
      if (parentData.first_name && parentData.last_name && parentData.phone) {
        await upsertStudentParent(student.id, {
          first_name: parentData.first_name,
          middle_name: parentData.middle_name,
          last_name: parentData.last_name,
          phone: parentData.phone,
          email: parentData.email,
          relationship: parentData.relationship,
          occupation: parentData.occupation,
          address: parentData.address,
        });
      }

      // Refresh student context
      await refresh();

      setMessage({
        type: "success",
        text: "Bio-data updated successfully!",
      });
      setEditing(false);

      // Auto-dismiss success message
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error("Failed to save bio-data:", error);
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save bio-data. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="bio-data-container">
        <div className="container-fluid">
          <div className="breadcrumbs-area">
            <h3>Bio-data Management</h3>
            <ul>
              <li>
                <Link href="/v26/student-dashboard">Dashboard</Link>
              </li>
              <li>Bio-data</li>
            </ul>
          </div>

          {message && (
            <div className={`alert alert-${message.type}`}>
              {message.text}
            </div>
          )}

          {/* Personal Data Section */}
          <div className="bio-data-card">
            <div className="bio-data-header">
              <h3>Personal Information</h3>
              {!editing && (
                <button
                  className="btn-submit btn-submit-primary"
                  onClick={() => setEditing(true)}
                  style={{ margin: 0 }}
                >
                  ✎ Edit
                </button>
              )}
            </div>
            <div className="bio-data-body">
              <div className="form-section">
                <div className="form-row">
                  <div className="form-group">
                    <label>Admission No</label>
                    <input
                      type="text"
                      value={student.admission_no}
                      readOnly
                      title="Admission number cannot be changed"
                    />
                  </div>
                  <div className="form-group required">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={personalData.first_name}
                      onChange={(e) =>
                        handlePersonalDataChange("first_name", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input
                      type="text"
                      value={personalData.middle_name}
                      onChange={(e) =>
                        handlePersonalDataChange("middle_name", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group required">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={personalData.last_name}
                      onChange={(e) =>
                        handlePersonalDataChange("last_name", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select
                      value={personalData.gender}
                      onChange={(e) =>
                        handlePersonalDataChange("gender", e.target.value)
                      }
                      disabled={!editing}
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Others</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={personalData.date_of_birth}
                      onChange={(e) =>
                        handlePersonalDataChange("date_of_birth", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Blood Group</label>
                    <select
                      value={personalData.blood_group_id}
                      onChange={(e) =>
                        handlePersonalDataChange("blood_group_id", e.target.value)
                      }
                      disabled={!editing}
                    >
                      <option value="">Select Blood Group</option>
                      {bloodGroups.map((bg) => (
                        <option key={bg.id} value={bg.id}>
                          {bg.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nationality</label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      disabled={!editing}
                    >
                      <option value="">Select Country</option>
                      {countries.map((country) => (
                        <option key={country.id} value={country.id}>
                          {country.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>State of Origin</label>
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      disabled={!editing || !selectedCountry}
                    >
                      <option value="">
                        {selectedCountry ? "Select State" : "Select Country First"}
                      </option>
                      {states.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>LGA of Origin</label>
                    <select
                      value={personalData.lga_of_origin}
                      onChange={(e) =>
                        handlePersonalDataChange("lga_of_origin", e.target.value)
                      }
                      disabled={!editing || !selectedState}
                    >
                      <option value="">
                        {selectedState ? "Select LGA" : "Select State First"}
                      </option>
                      {lgas.map((lga) => (
                        <option key={lga.id || lga.name} value={lga.name}>
                          {lga.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Passport/Photo</label>
                    <div
                      className={`passport-upload-section ${passportPreview ? "has-image" : ""}`}
                      onClick={() => {
                        if (editing) {
                          document.getElementById("passport-input")?.click();
                        }
                      }}
                      style={{ cursor: editing ? "pointer" : "default" }}
                    >
                      <input
                        id="passport-input"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handlePassportChange}
                        disabled={!editing}
                      />
                      {passportPreview && typeof passportPreview === "string" && (passportPreview.startsWith("data:") || passportPreview.startsWith("http://") || passportPreview.startsWith("https://") || passportPreview.startsWith("/")) ? (
                        <>
                          <img
                            src={passportPreview}
                            alt="Passport preview"
                            className="passport-preview"
                          />
                          <div>
                            <p className="passport-upload-label">
                              {passportFile?.name ?? "Current Photo"}
                            </p>
                            {editing && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePassport();
                                }}
                                className="btn-submit btn-cancel"
                                style={{ marginRight: "0.5rem", marginTop: "0.5rem" }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </>
                      ) : passportPreview === "📄 PDF File" ? (
                        <>
                          <p style={{ fontSize: "3rem", margin: "0 0 1rem 0" }}>
                            📄
                          </p>
                          <p className="passport-upload-label">
                            {passportFile?.name}
                          </p>
                          {editing && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePassport();
                              }}
                              className="btn-submit btn-cancel"
                              style={{ marginRight: "0.5rem", marginTop: "0.5rem" }}
                            >
                              Remove
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <p style={{ fontSize: "2rem", margin: "0 0 1rem 0" }}>
                            📸
                          </p>
                          <p className="passport-upload-label">
                            Click to upload passport or photo
                          </p>
                          <p className="passport-upload-hint">
                            PNG, JPG, GIF or PDF (Max. 5MB)
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>House</label>
                    <input
                      type="text"
                      value={personalData.house}
                      onChange={(e) =>
                        handlePersonalDataChange("house", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                  <div className="form-group">
                    <label>Club</label>
                    <input
                      type="text"
                      value={personalData.club}
                      onChange={(e) =>
                        handlePersonalDataChange("club", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Address</label>
                    <textarea
                      value={personalData.address}
                      onChange={(e) =>
                        handlePersonalDataChange("address", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Medical Information</label>
                    <textarea
                      value={personalData.medical_information}
                      onChange={(e) =>
                        handlePersonalDataChange(
                          "medical_information",
                          e.target.value,
                        )
                      }
                      disabled={!editing}
                    />
                    <p className="form-hint">
                      Any allergies, medications, or health conditions we should know about
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Parent/Guardian Section */}
          <div className="bio-data-card">
            <div className="bio-data-header">
              <h3>Parent/Guardian Information</h3>
              {!editing && student.parent && (
                <button
                  className="btn-submit btn-submit-primary"
                  onClick={() => setEditing(true)}
                  style={{ margin: 0 }}
                >
                  ✎ Edit
                </button>
              )}
            </div>
            <div className="bio-data-body">
              <div className="form-section">
                <p style={{ color: "#718096", marginBottom: "1rem" }}>
                  📝 Parent/Guardian information is optional. You can add details here for one or both parents (mother and father). This information will be stored and accessible to school administrators.
                </p>

                <div className="form-row">
                  <div className="form-group">
                    <label>Relationship</label>
                    <select
                      value={parentData.relationship}
                      onChange={(e) =>
                        handleParentDataChange("relationship", e.target.value)
                      }
                      disabled={!editing}
                    >
                      <option value="mother">Mother</option>
                      <option value="father">Father</option>
                      <option value="guardian">Guardian</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={parentData.first_name}
                      onChange={(e) =>
                        handleParentDataChange("first_name", e.target.value)
                      }
                      disabled={!editing}
                      placeholder="Leave blank if no parent assigned yet"
                    />
                  </div>
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input
                      type="text"
                      value={parentData.middle_name}
                      onChange={(e) =>
                        handleParentDataChange("middle_name", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={parentData.last_name}
                      onChange={(e) =>
                        handleParentDataChange("last_name", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      value={parentData.phone}
                      onChange={(e) =>
                        handleParentDataChange("phone", e.target.value)
                      }
                      disabled={!editing}
                      placeholder="+234XXXXXXXXXX"
                    />
                  </div>
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      value={parentData.email}
                      onChange={(e) =>
                        handleParentDataChange("email", e.target.value)
                      }
                      disabled={!editing}
                      placeholder="parent@example.com"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Occupation</label>
                    <input
                      type="text"
                      value={parentData.occupation}
                      onChange={(e) =>
                        handleParentDataChange("occupation", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                  <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                    <label>Address</label>
                    <textarea
                      value={parentData.address}
                      onChange={(e) =>
                        handleParentDataChange("address", e.target.value)
                      }
                      disabled={!editing}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          {editing && (
            <div style={{ marginBottom: "2rem" }}>
              <div className="form-actions">
                <button
                  className="btn-submit btn-submit-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving && <span className="spinner"></span>}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  className="btn-submit btn-cancel"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="footer-wrap-layout1" style={{ marginTop: "3rem" }}>
        <div className="copyright">
          © Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights
          reserved.
        </div>
      </footer>
    </>
  );
}
