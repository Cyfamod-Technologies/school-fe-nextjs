const resultsState = {
    sessions: [],
    termsBySession: new Map(),
    classes: [],
    armsByClass: new Map(),
    sectionsByArm: new Map(),
    subjects: [],
    components: [],
    students: [],
    resultsByStudent: new Map(),
};

const resultsFilters = {
    session_id: '',
    term_id: '',
    class_id: '',
    arm_id: '',
    section_id: '',
    subject_id: '',
    assessment_component_id: '',
};

const resultsEls = {};

document.addEventListener('DOMContentLoaded', async () => {
    cacheElements();
    bindEvents();
    await loadInitialData();
});

function cacheElements() {
    resultsEls.sessionSelect = document.getElementById('filter-session');
    resultsEls.termSelect = document.getElementById('filter-term');
    resultsEls.classSelect = document.getElementById('filter-class');
    resultsEls.armSelect = document.getElementById('filter-arm');
    resultsEls.sectionSelect = document.getElementById('filter-section');
    resultsEls.subjectSelect = document.getElementById('filter-subject');
    resultsEls.componentSelect = document.getElementById('filter-component');
    resultsEls.loadButton = document.getElementById('load-results');
    resultsEls.saveButton = document.getElementById('save-results');
    resultsEls.status = document.getElementById('results-status');
    resultsEls.info = document.getElementById('results-info');
    resultsEls.error = document.getElementById('results-error');
    resultsEls.tableBody = document.getElementById('results-table');
}

function bindEvents() {
    if (resultsEls.sessionSelect) {
        resultsEls.sessionSelect.addEventListener('change', async () => {
            resultsFilters.session_id = resultsEls.sessionSelect.value;
            await ensureTermsLoaded(resultsFilters.session_id);
            populateTermOptions(resultsFilters.session_id);
            await refreshComponents();
        });
    }

    if (resultsEls.termSelect) {
        resultsEls.termSelect.addEventListener('change', async () => {
            resultsFilters.term_id = resultsEls.termSelect.value;
            await refreshComponents();
        });
    }

    if (resultsEls.classSelect) {
        resultsEls.classSelect.addEventListener('change', async () => {
            resultsFilters.class_id = resultsEls.classSelect.value;
            resultsFilters.arm_id = '';
            resultsFilters.section_id = '';
            await ensureArmsLoaded(resultsFilters.class_id);
            populateArmOptions(resultsFilters.class_id);
            populateSectionOptions(resultsFilters.class_id, '');
        });
    }

    if (resultsEls.armSelect) {
        resultsEls.armSelect.addEventListener('change', async () => {
            resultsFilters.arm_id = resultsEls.armSelect.value;
            resultsFilters.section_id = '';
            await ensureSectionsLoaded(resultsFilters.class_id, resultsFilters.arm_id);
            populateSectionOptions(resultsFilters.class_id, resultsFilters.arm_id);
        });
    }

    if (resultsEls.sectionSelect) {
        resultsEls.sectionSelect.addEventListener('change', () => {
            resultsFilters.section_id = resultsEls.sectionSelect.value;
        });
    }

    if (resultsEls.subjectSelect) {
        resultsEls.subjectSelect.addEventListener('change', async () => {
            resultsFilters.subject_id = resultsEls.subjectSelect.value;
            await refreshComponents();
        });
    }

    if (resultsEls.componentSelect) {
        resultsEls.componentSelect.addEventListener('change', () => {
            resultsFilters.assessment_component_id = resultsEls.componentSelect.value;
        });
    }

    if (resultsEls.loadButton) {
        resultsEls.loadButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await loadStudentsAndResults();
        });
    }

    if (resultsEls.saveButton) {
        resultsEls.saveButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await saveResults();
        });
    }
}

async function loadInitialData() {
    showInfo('Loading context...');
    await Promise.all([loadSessions(), loadClasses(), loadSubjects()]);
    populateSessionOptions();
    populateClassOptions();
    populateSubjectOptions();

    try {
        const context = await (window.getSchoolContext ? window.getSchoolContext() : Promise.resolve(null));
        if (context) {
            if (context.current_session_id && resultsEls.sessionSelect) {
                resultsEls.sessionSelect.value = context.current_session_id;
                resultsFilters.session_id = context.current_session_id;
                await ensureTermsLoaded(context.current_session_id);
                populateTermOptions(context.current_session_id, context.current_term_id || '');
            }
            if (context.current_term_id && resultsEls.termSelect) {
                resultsEls.termSelect.value = context.current_term_id;
                resultsFilters.term_id = context.current_term_id;
            }
        }
        await refreshComponents();
        clearInfo();
    } catch (error) {
        console.error(error);
        showError('Unable to load initial context.');
    }
}

async function loadSessions() {
    try {
        const response = await fetch(`${backend_url}/api/v1/sessions?per_page=200`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to load sessions.');
        const payload = await response.json();
        resultsState.sessions = unpackCollection(payload);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function ensureTermsLoaded(sessionId) {
    if (!sessionId || resultsState.termsBySession.has(sessionId)) {
        return;
    }
    try {
        const response = await fetch(`${backend_url}/api/v1/sessions/${sessionId}/terms`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to load terms.');
        const payload = await response.json();
        resultsState.termsBySession.set(sessionId, unpackCollection(payload));
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function loadClasses() {
    try {
        const response = await fetch(`${backend_url}/api/v1/classes?per_page=200`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to load classes.');
        const payload = await response.json();
        resultsState.classes = unpackCollection(payload);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function ensureArmsLoaded(classId) {
    if (!classId || resultsState.armsByClass.has(classId)) {
        return;
    }
    try {
        const response = await fetch(`${backend_url}/api/v1/classes/${classId}/arms`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to load class arms.');
        const payload = await response.json();
        const arms = Array.isArray(payload) ? payload : payload.data || [];
        resultsState.armsByClass.set(classId, arms);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function ensureSectionsLoaded(classId, armId) {
    if (!classId || !armId) {
        return;
    }
    const cacheKey = `${classId}:${armId}`;
    if (resultsState.sectionsByArm.has(cacheKey)) {
        return;
    }
    try {
        const response = await fetch(`${backend_url}/api/v1/classes/${classId}/arms/${armId}/sections`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to load class sections.');
        const payload = await response.json();
        const sections = Array.isArray(payload) ? payload : payload.data || [];
        resultsState.sectionsByArm.set(cacheKey, sections);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function loadSubjects() {
    try {
        const response = await fetch(`${backend_url}/api/v1/settings/subjects?per_page=200`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to load subjects.');
        const payload = await response.json();
        resultsState.subjects = unpackCollection(payload);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

async function refreshComponents() {
    if (!resultsEls.componentSelect) return;

    const sessionId = resultsEls.sessionSelect.value;
    const termId = resultsEls.termSelect.value;
    const subjectId = resultsEls.subjectSelect.value;

    if (!sessionId || !termId || !subjectId) {
        populateComponentOptions([]);
        return;
    }

    try {
        const params = new URLSearchParams({
            per_page: 200,
            session_id: sessionId,
            term_id: termId,
            subject_id: subjectId,
        });
        const response = await fetch(`${backend_url}/api/v1/settings/assessment-components?${params.toString()}`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Failed to load assessment components.');
        const payload = await response.json();
        resultsState.components = unpackCollection(payload);
        populateComponentOptions(resultsState.components);
    } catch (error) {
        console.error(error);
        showError(error.message);
    }
}

function populateSessionOptions() {
    if (!resultsEls.sessionSelect) return;
    const options = ['<option value="">Select session</option>']
        .concat(resultsState.sessions.map((session) => `<option value="${session.id}">${session.name}</option>`));
    resultsEls.sessionSelect.innerHTML = options.join('');
}

function populateTermOptions(sessionId, selectedId = '') {
    if (!resultsEls.termSelect) return;
    const terms = sessionId ? (resultsState.termsBySession.get(sessionId) ?? []) : [];
    const options = ['<option value="">Select term</option>']
        .concat(terms.map((term) => `<option value="${term.id}">${term.name}</option>`));
    resultsEls.termSelect.innerHTML = options.join('');
    if (selectedId) {
        resultsEls.termSelect.value = selectedId;
        resultsFilters.term_id = selectedId;
    }
}

function populateClassOptions() {
    if (!resultsEls.classSelect) return;
    const options = ['<option value="">Select class</option>']
        .concat(resultsState.classes.map((schoolClass) => `<option value="${schoolClass.id}">${schoolClass.name}</option>`));
    resultsEls.classSelect.innerHTML = options.join('');
}

function populateArmOptions(classId, selectedId = '') {
    if (!resultsEls.armSelect) return;
    const arms = classId ? (resultsState.armsByClass.get(classId) ?? []) : [];
    const options = ['<option value="">None</option>']
        .concat(arms.map((arm) => `<option value="${arm.id}">${arm.name}</option>`));
    resultsEls.armSelect.innerHTML = options.join('');
    if (selectedId) {
        resultsEls.armSelect.value = selectedId;
        resultsFilters.arm_id = selectedId;
    }
}

function populateSectionOptions(classId, armId, selectedId = '') {
    if (!resultsEls.sectionSelect) return;
    let sections = [];
    if (classId && armId) {
        const cacheKey = `${classId}:${armId}`;
        sections = resultsState.sectionsByArm.get(cacheKey) ?? [];
    }
    const options = ['<option value="">All sections</option>']
        .concat(sections.map((section) => `<option value="${section.id}">${section.name}</option>`));
    resultsEls.sectionSelect.innerHTML = options.join('');
    if (selectedId) {
        resultsEls.sectionSelect.value = selectedId;
        resultsFilters.section_id = selectedId;
    }
}

function populateSubjectOptions() {
    if (!resultsEls.subjectSelect) return;
    const options = ['<option value="">Select subject</option>']
        .concat(resultsState.subjects.map((subject) => {
            const label = subject.code ? `${subject.name} (${subject.code})` : subject.name;
            return `<option value="${subject.id}">${label}</option>`;
        }));
    resultsEls.subjectSelect.innerHTML = options.join('');
}

function populateComponentOptions(components) {
    if (!resultsEls.componentSelect) return;
    const options = ['<option value="">Overall (no component)</option>']
        .concat(components.map((component) => {
            const label = component.label
                ? `${component.name} (${component.label})`
                : component.name;
            return `<option value="${component.id}">${label}</option>`;
        }));
    resultsEls.componentSelect.innerHTML = options.join('');
    if (resultsFilters.assessment_component_id) {
        const exists = components.some((component) => component.id === resultsFilters.assessment_component_id);
        if (exists) {
            resultsEls.componentSelect.value = resultsFilters.assessment_component_id;
        } else {
            resultsFilters.assessment_component_id = '';
        }
    }
}

async function loadStudentsAndResults() {
    clearMessages();
    updateStatus('Loading students...');

    resultsFilters.session_id = resultsEls.sessionSelect ? resultsEls.sessionSelect.value : '';
    resultsFilters.term_id = resultsEls.termSelect ? resultsEls.termSelect.value : '';
    resultsFilters.class_id = resultsEls.classSelect ? resultsEls.classSelect.value : '';
    resultsFilters.arm_id = resultsEls.armSelect ? resultsEls.armSelect.value : '';
    resultsFilters.section_id = resultsEls.sectionSelect ? resultsEls.sectionSelect.value : '';
    resultsFilters.subject_id = resultsEls.subjectSelect ? resultsEls.subjectSelect.value : '';
    resultsFilters.assessment_component_id = resultsEls.componentSelect ? resultsEls.componentSelect.value : '';

    const missing = [];
    if (!resultsFilters.session_id) missing.push('session');
    if (!resultsFilters.term_id) missing.push('term');
    if (!resultsFilters.class_id) missing.push('class');
    if (!resultsFilters.subject_id) missing.push('subject');

    if (missing.length) {
        showError(`Please select ${missing.join(', ')} before loading students.`);
        resetTablePlaceholder('Select filters and click “Load Students” to begin.');
        updateStatus('');
        return;
    }

    try {
        const [studentsPayload, resultsPayload] = await Promise.all([
            fetchStudents(),
            fetchResults(),
        ]);

        resultsState.students = unpackCollection(studentsPayload);
        const resultsCollection = unpackCollection(resultsPayload);
        resultsState.resultsByStudent = mapResultsByStudent(resultsCollection);

        renderResultsTable();
        updateStatus(`${resultsState.students.length} students loaded.`);
    } catch (error) {
        console.error(error);
        showError(error.message);
        resetTablePlaceholder('Unable to load students. Please adjust filters and try again.');
        updateStatus('');
    }
}

async function fetchStudents() {
    const params = new URLSearchParams({
        per_page: 500,
        school_class_id: resultsFilters.class_id,
    });

    if (resultsFilters.arm_id) params.append('class_arm_id', resultsFilters.arm_id);
    if (resultsFilters.section_id) params.append('class_section_id', resultsFilters.section_id);
    params.append('current_session_id', resultsFilters.session_id);
    params.append('current_term_id', resultsFilters.term_id);
    params.append('sortBy', 'first_name');

    const response = await fetch(`${backend_url}/api/v1/students?${params.toString()}`, {
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to load students for the selected class.');
    }

    return response.json();
}

async function fetchResults() {
    const params = new URLSearchParams({
        per_page: 500,
        session_id: resultsFilters.session_id,
        term_id: resultsFilters.term_id,
        subject_id: resultsFilters.subject_id,
        school_class_id: resultsFilters.class_id,
    });

    if (resultsFilters.arm_id) params.append('class_arm_id', resultsFilters.arm_id);
    if (resultsFilters.section_id) params.append('class_section_id', resultsFilters.section_id);
    if (resultsFilters.assessment_component_id) {
        params.append('assessment_component_id', resultsFilters.assessment_component_id);
    } else {
        params.append('assessment_component_id', 'none');
    }

    const response = await fetch(`${backend_url}/api/v1/results?${params.toString()}`, {
        headers: authHeaders(),
    });

    if (!response.ok) {
        throw new Error('Failed to load existing results for the selected context.');
    }

    return response.json();
}

function mapResultsByStudent(resultsArray) {
    const map = new Map();
    resultsArray.forEach((result) => {
        map.set(result.student_id, result);
    });
    return map;
}

function renderResultsTable() {
    if (!resultsEls.tableBody) return;

    if (!resultsState.students.length) {
        resetTablePlaceholder('No students were found for the selected class.');
        return;
    }

    const rows = resultsState.students.map((student, index) => {
        const result = resultsState.resultsByStudent.get(student.id);
        const className = student.school_class?.name || '—';
        const armName = student.class_arm?.name || '';
        const sectionName = student.class_section?.name || '';
        const classLabel = [className, armName, sectionName].filter(Boolean).join(' / ') || '—';
        const score = result ? Number(result.total_score).toFixed(2) : '';
        const remark = result?.remarks || '';
        const statusClass = result ? 'saved' : 'none';
        const statusLabel = result ? 'Saved' : 'Not recorded';

        return `
            <tr data-student-id="${student.id}" data-original-score="${score}" data-original-remark="${escapeHtml(remark)}" data-has-result="${result ? 'true' : 'false'}">
                <td>${index + 1}</td>
                <td>${escapeHtml(fullName(student))}</td>
                <td>${escapeHtml(student.admission_no || '')}</td>
                <td>${escapeHtml(classLabel)}</td>
                <td>
                    <input type="number" step="0.01" min="0" max="100" class="form-control score-input" value="${score}" aria-label="Score for ${escapeHtml(fullName(student))}">
                </td>
                <td>
                    <textarea class="form-control remark-input" maxlength="500" aria-label="Remark for ${escapeHtml(fullName(student))}">${escapeHtml(remark)}</textarea>
                </td>
                <td>
                    <span class="status-pill ${statusClass}">${statusLabel}</span>
                </td>
            </tr>
        `;
    });

    resultsEls.tableBody.innerHTML = rows.join('');
    attachRowListeners();
}

function attachRowListeners() {
    if (!resultsEls.tableBody) return;
    resultsEls.tableBody.querySelectorAll('tr').forEach((row) => {
        const scoreInput = row.querySelector('.score-input');
        const remarkInput = row.querySelector('.remark-input');
        const status = row.querySelector('.status-pill');

        if (scoreInput) {
            scoreInput.addEventListener('input', () => handleRowChange(row, status));
        }
        if (remarkInput) {
            remarkInput.addEventListener('input', () => handleRowChange(row, status));
        }
    });
}

function handleRowChange(row, statusPill) {
    if (!row) return;
    const originalScore = row.dataset.originalScore ?? '';
    const originalRemark = row.dataset.originalRemark ?? '';
    const scoreInput = row.querySelector('.score-input');
    const remarkInput = row.querySelector('.remark-input');

    const currentScore = (scoreInput?.value ?? '').trim();
    const currentRemark = (remarkInput?.value ?? '').trim();

    const normalizedOriginalRemark = originalRemark.trim();
    const normalizedCurrentRemark = currentRemark.trim();

    const changed = currentScore !== originalScore || normalizedCurrentRemark !== normalizedOriginalRemark;

    if (statusPill) {
        statusPill.textContent = changed ? 'Pending' : (row.dataset.hasResult === 'true' ? 'Saved' : 'Not recorded');
        statusPill.classList.toggle('pending', changed);
        statusPill.classList.toggle('saved', !changed && row.dataset.hasResult === 'true');
        statusPill.classList.toggle('none', !changed && row.dataset.hasResult !== 'true');
    }
}

async function saveResults() {
    clearMessages();
    if (!resultsState.students.length) {
        showInfo('Load students before attempting to save.');
        return;
    }

    const entries = collectEntries();
    if (!entries.length) {
        showInfo('No changes to save.');
        return;
    }

    const payload = {
        session_id: resultsFilters.session_id,
        term_id: resultsFilters.term_id,
        assessment_component_id: resultsFilters.assessment_component_id || null,
        entries,
    };

    updateStatus('Saving scores...');
    setSaving(true);

    try {
        const response = await fetch(`${backend_url}/api/v1/results/batch`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = data.message || 'Unable to save scores.';
            throw new Error(message);
        }

        showInfo(data.message || 'Scores saved successfully.');

        const updatedResults = Array.isArray(data.data) ? data.data : [];
        updatedResults.forEach((result) => {
            resultsState.resultsByStudent.set(result.student_id, result);
        });

        refreshTableAfterSave(updatedResults);
        updateStatus(`Saved ${data.meta?.total ?? updatedResults.length} entries.`);
    } catch (error) {
        console.error(error);
        showError(error.message);
        updateStatus('');
    } finally {
        setSaving(false);
    }
}

function collectEntries() {
    if (!resultsEls.tableBody) return [];
    const entries = [];
    let hasErrors = false;

    resultsEls.tableBody.querySelectorAll('tr').forEach((row) => {
        const scoreInput = row.querySelector('.score-input');
        const remarkInput = row.querySelector('.remark-input');
        const studentId = row.dataset.studentId;
        if (!studentId || !scoreInput || !remarkInput) return;

        const scoreRaw = scoreInput.value.trim();
        const remarkRaw = remarkInput.value.trim();

        const originalScore = row.dataset.originalScore ?? '';
        const originalRemark = row.dataset.originalRemark ?? '';
        const hasResult = row.dataset.hasResult === 'true';

        const normalizedRemark = remarkRaw || null;

        if (!scoreRaw) {
            if (hasResult || remarkRaw) {
                addRowError(row, 'Score is required when remark is provided or when editing an existing result.');
                hasErrors = true;
            }
            return;
        }

        const scoreValue = Number(scoreRaw);
        if (Number.isNaN(scoreValue) || scoreValue < 0 || scoreValue > 100) {
            addRowError(row, 'Score must be between 0 and 100.');
            hasErrors = true;
            return;
        }

        const changedScore = scoreRaw !== originalScore;
        const changedRemark = (normalizedRemark || '') !== (originalRemark || '');

        if (!changedScore && !changedRemark) {
            return;
        }

        clearRowError(row);

        entries.push({
            student_id: studentId,
            subject_id: resultsFilters.subject_id,
            score: scoreValue,
            remarks: remarkRaw === '' ? null : remarkRaw,
        });
    });

    if (hasErrors) {
        showError('Please fix the highlighted rows before saving.');
        return [];
    }

    return entries;
}

function refreshTableAfterSave(updatedResults) {
    if (!resultsEls.tableBody) return;
    const updatedMap = mapResultsByStudent(updatedResults);

    resultsEls.tableBody.querySelectorAll('tr').forEach((row) => {
        const studentId = row.dataset.studentId;
        const scoreInput = row.querySelector('.score-input');
        const remarkInput = row.querySelector('.remark-input');
        const statusPill = row.querySelector('.status-pill');

        const result = updatedMap.get(studentId) || resultsState.resultsByStudent.get(studentId);
        if (!result || !scoreInput || !remarkInput) return;

        const scoreValue = Number(result.total_score).toFixed(2);
        const remarkValue = result.remarks || '';

        row.dataset.originalScore = scoreValue;
        row.dataset.originalRemark = remarkValue;
        row.dataset.hasResult = 'true';

        scoreInput.value = scoreValue;
        remarkInput.value = remarkValue;

        if (statusPill) {
            statusPill.textContent = 'Saved';
            statusPill.classList.remove('pending', 'none');
            statusPill.classList.add('saved');
        }

        clearRowError(row);
    });
}

function resetTablePlaceholder(message) {
    if (!resultsEls.tableBody) return;
    resultsEls.tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${message}</td></tr>`;
}

function updateStatus(message) {
    if (resultsEls.status) {
        resultsEls.status.textContent = message;
    }
}

function setSaving(isSaving) {
    if (resultsEls.saveButton) {
        resultsEls.saveButton.disabled = isSaving;
    }
    if (resultsEls.loadButton) {
        resultsEls.loadButton.disabled = isSaving;
    }
}

function showInfo(message) {
    if (!resultsEls.info) return;
    resultsEls.info.textContent = message;
    resultsEls.info.classList.remove('d-none');
}

function clearInfo() {
    if (!resultsEls.info) return;
    resultsEls.info.textContent = '';
    resultsEls.info.classList.add('d-none');
}

function showError(message) {
    if (!resultsEls.error) return;
    resultsEls.error.textContent = message;
    resultsEls.error.classList.remove('d-none');
}

function clearError() {
    if (!resultsEls.error) return;
    resultsEls.error.textContent = '';
    resultsEls.error.classList.add('d-none');
}

function clearMessages() {
    clearInfo();
    clearError();
}

function addRowError(row, message) {
    row.classList.add('table-danger');
    row.dataset.rowError = message;
}

function clearRowError(row) {
    row.classList.remove('table-danger');
    delete row.dataset.rowError;
}

function fullName(student) {
    return [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(' ');
}

function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function authHeaders(extra = {}) {
    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${getCookie('token')}`,
    };
    return Object.assign(headers, extra);
}

function unpackCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && payload.data && Array.isArray(payload.data.data)) return payload.data.data;
    return [];
}
