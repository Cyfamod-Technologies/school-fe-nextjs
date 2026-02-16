(function () {
    const token = getCookie('token');
    if (!token) {
        window.location.href = '../v10/login.html';
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    const sessionSelect = document.getElementById('promotion-session');
    const termSelect = document.getElementById('promotion-term');
    const classSelect = document.getElementById('promotion-class');
    const classArmSelect = document.getElementById('promotion-class-arm');
    const sectionSelect = document.getElementById('promotion-section');
    const targetSessionSelect = document.getElementById('target-session');
    const targetClassSelect = document.getElementById('target-class');
    const targetClassArmSelect = document.getElementById('target-class-arm');
    const targetSectionSelect = document.getElementById('target-section');
    const retainSubjectsCheckbox = document.getElementById('retain-subjects');
    const loadStudentsButton = document.getElementById('load-students');
    const selectAllCheckbox = document.getElementById('select-all');
    const promotionFeedback = document.getElementById('promotion-feedback');
    const promotionTableBody = document.getElementById('promotion-students-body');
    const promotionSelectionSummary = document.getElementById('promotion-selection-summary');
    const promotionPreviewButton = document.getElementById('promotion-preview');
    const promotionExecuteButton = document.getElementById('promotion-execute');
    const promotionPreviewCard = document.getElementById('promotion-preview-card');
    const promotionPreviewBody = document.getElementById('promotion-preview-body');
    const refreshButton = document.getElementById('promotion-refresh');

    const selectedStudentIds = new Set();
    let cachedStudents = [];

    document.addEventListener('DOMContentLoaded', async () => {
        await Promise.all([
            loadSessions(),
            loadClasses(),
        ]);

        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                await reloadAll();
            });
        }

        if (sessionSelect) {
            sessionSelect.addEventListener('change', async () => {
                await loadTerms(sessionSelect.value);
                await loadSections(sessionSelect.value);
                await loadStudents();
            });
        }

        if (classSelect) {
            classSelect.addEventListener('change', async () => {
                await loadClassArms(classSelect.value);
                await loadStudents();
            });
        }

        if (classArmSelect) {
            classArmSelect.addEventListener('change', loadStudents);
        }

        if (sectionSelect) {
            sectionSelect.addEventListener('change', loadStudents);
        }

        if (targetSessionSelect) {
            targetSessionSelect.addEventListener('change', async () => {
                await loadClasses(targetClassSelect, targetSectionSelect, targetSessionSelect.value);
            });
        }

        if (targetClassSelect) {
            targetClassSelect.addEventListener('change', async () => {
                await loadClassArms(targetClassSelect.value, targetClassArmSelect);
            });
        }

        if (loadStudentsButton) {
            loadStudentsButton.addEventListener('click', loadStudents);
        }

        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', handleSelectAll);
        }

        if (promotionPreviewButton) {
            promotionPreviewButton.addEventListener('click', handlePreviewPromotion);
        }

        if (promotionExecuteButton) {
            promotionExecuteButton.addEventListener('click', handleExecutePromotion);
        }
    });

    async function reloadAll() {
        resetFeedback();
        await Promise.all([
            loadSessions(),
            loadClasses(),
            loadTerms(sessionSelect?.value),
            loadSections(sessionSelect?.value),
        ]);
        await loadStudents();
    }

    function getCookie(name) {
        const nameEQ = `${name}=`;
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length);
        }
        return null;
    }

    async function loadSessions() {
        if (!sessionSelect || !targetSessionSelect) return;

        clearSelect(sessionSelect);
        clearSelect(targetSessionSelect);
        sessionSelect.innerHTML = '<option value="">Select session</option>';
        targetSessionSelect.innerHTML = '<option value="">Select session</option>';

        try {
            const response = await fetch(`${backend_url}/api/v1/sessions`, { headers });
            if (!response.ok) throw new Error('Failed to load sessions');
            const sessions = await response.json();

            sessions.forEach((session) => {
                const optionCurrent = document.createElement('option');
                optionCurrent.value = session.id;
                optionCurrent.textContent = session.name;
                sessionSelect.appendChild(optionCurrent);

                const optionTarget = document.createElement('option');
                optionTarget.value = session.id;
                optionTarget.textContent = session.name;
                targetSessionSelect.appendChild(optionTarget);
            });
        } catch (error) {
            showFeedback(error.message, 'danger');
        }
    }

    async function loadTerms(sessionId) {
        if (!termSelect) return;
        clearSelect(termSelect);
        termSelect.innerHTML = '<option value="">All terms</option>';

        if (!sessionId) {
            return;
        }

        try {
            const response = await fetch(`${backend_url}/api/v1/sessions/${sessionId}/terms`, { headers });
            if (!response.ok) throw new Error('Failed to load terms');
            const terms = await response.json();

            terms.forEach((term) => {
                const option = document.createElement('option');
                option.value = term.id;
                option.textContent = term.name;
                termSelect.appendChild(option);
            });
        } catch (error) {
            showFeedback(error.message, 'danger');
        }
    }

    async function loadClasses(selectElement = classSelect, sectionSelectElement = sectionSelect, sessionId = null) {
        if (!selectElement) return;

        clearSelect(selectElement);
        const defaultLabel = selectElement === targetClassSelect ? 'Select class' : 'All classes';
        selectElement.innerHTML = `<option value="">${defaultLabel}</option>`;

        try {
            const response = await fetch(`${backend_url}/api/v1/classes`, { headers });
            if (!response.ok) throw new Error('Failed to load classes');
            const payload = await response.json();
            const classes = payload?.data ?? payload;

            classes.forEach((item) => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.name;
                selectElement.appendChild(option);
            });
        } catch (error) {
            showFeedback(error.message, 'danger');
        }

        if (sectionSelectElement) {
            await loadSections(sessionSelect?.value, sectionSelectElement);
        }
    }

    async function loadClassArms(classId, selectElement = classArmSelect) {
        if (!selectElement) return;
        clearSelect(selectElement);
        const defaultLabel = selectElement === targetClassArmSelect ? 'Optional' : 'None';
        selectElement.innerHTML = `<option value="">${defaultLabel}</option>`;

        if (!classId) {
            return;
        }

        try {
            const response = await fetch(`${backend_url}/api/v1/classes/${classId}/arms`, { headers });
            if (!response.ok) throw new Error('Failed to load class arms');
            const payload = await response.json();
            const arms = payload?.data ?? payload;

            arms.forEach((arm) => {
                const option = document.createElement('option');
                option.value = arm.id;
                option.textContent = arm.name;
                selectElement.appendChild(option);
            });
        } catch (error) {
            showFeedback(error.message, 'danger');
        }
    }

    async function loadSections(sessionId, selectElement = sectionSelect) {
        if (!selectElement) return;
        clearSelect(selectElement);
        const defaultLabel = selectElement === targetSectionSelect ? 'Optional' : 'All sections';
        selectElement.innerHTML = `<option value="">${defaultLabel}</option>`;

        if (!sessionId) {
            return;
        }

        try {
            const response = await fetch(`${backend_url}/api/v1/sessions/${sessionId}/terms`, { headers });
            if (response.ok) {
                // Placeholder: if sections are related to terms, we might need separate endpoint.
            }
        } catch (error) {
            // Sections optional; swallow errors for now.
        }
    }

    async function loadStudents() {
        resetFeedback();
        promotionPreviewCard.style.display = 'none';
        promotionPreviewBody.innerHTML = '<tr><td colspan="4">No preview available.</td></tr>';
        selectedStudentIds.clear();
        updateSelectionSummary();

        if (!sessionSelect || !classSelect) {
            return;
        }

        const sessionId = sessionSelect.value;
        if (!sessionId) {
            promotionTableBody.innerHTML = '<tr><td colspan="6">Select session and class to load students.</td></tr>';
            return;
        }

        promotionTableBody.innerHTML = '<tr><td colspan="6">Loading students...</td></tr>';

        try {
            const params = new URLSearchParams();
            params.set('session_id', sessionId);
            params.set('per_page', '200');

            if (classSelect.value) params.set('school_class_id', classSelect.value);
            if (classArmSelect && classArmSelect.value) params.set('class_arm_id', classArmSelect.value);
            if (termSelect && termSelect.value) params.set('term_id', termSelect.value);
            if (sectionSelect && sectionSelect.value) params.set('class_section_id', sectionSelect.value);

            const response = await fetch(`${backend_url}/api/v1/students?${params.toString()}`, { headers });
            if (!response.ok) throw new Error('Failed to load students');
            const payload = await response.json();
            const students = Array.isArray(payload.data) ? payload.data : payload.data?.data ?? payload;

            cachedStudents = students;
            renderStudents(students);
        } catch (error) {
            console.error('Error loading students:', error);
            showFeedback(error.message || 'Unable to load students.', 'danger');
            promotionTableBody.innerHTML = '<tr><td colspan="6">Unable to load students.</td></tr>';
        }
    }

    function renderStudents(students) {
        if (!promotionTableBody) {
            return;
        }

        if (!Array.isArray(students) || students.length === 0) {
            promotionTableBody.innerHTML = '<tr><td colspan="6">No students found for the selected filters.</td></tr>';
            return;
        }

        promotionTableBody.innerHTML = '';

        students.forEach((student) => {
            const row = document.createElement('tr');
            const studentId = student.id;
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
            const className = student.school_class?.name || student.class_name || '';
            const armName = student.class_arm?.name || student.class_arm_name || '';
            const sessionName = student.session?.name || '';

            row.innerHTML = `
                <td><input type="checkbox" class="promotion-select" data-id="${studentId}"></td>
                <td>${escapeHtml(fullName || 'Student')}</td>
                <td>${escapeHtml(student.admission_no || '')}</td>
                <td>${escapeHtml(className)}</td>
                <td>${escapeHtml(armName)}</td>
                <td>${escapeHtml(sessionName)}</td>
            `;

            promotionTableBody.appendChild(row);
        });

        promotionTableBody.querySelectorAll('.promotion-select').forEach((checkbox) => {
            checkbox.addEventListener('change', (event) => {
                const id = event.currentTarget.getAttribute('data-id');
                if (!id) return;
                if (event.currentTarget.checked) {
                    selectedStudentIds.add(id);
                } else {
                    selectedStudentIds.delete(id);
                }
                updateSelectionSummary();
            });
        });
    }

    function handleSelectAll(event) {
        const checked = event.currentTarget.checked;
        promotionTableBody.querySelectorAll('.promotion-select').forEach((checkbox) => {
            checkbox.checked = checked;
            const id = checkbox.getAttribute('data-id');
            if (!id) return;
            if (checked) {
                selectedStudentIds.add(id);
            } else {
                selectedStudentIds.delete(id);
            }
        });
        updateSelectionSummary();
    }

    function updateSelectionSummary() {
        if (!promotionSelectionSummary) {
            return;
        }
        promotionSelectionSummary.textContent = `${selectedStudentIds.size} student(s) selected`;
    }

    function handlePreviewPromotion() {
        if (selectedStudentIds.size === 0) {
            showFeedback('Select at least one student to preview promotion.', 'warning');
            return;
        }

        const sessionId = targetSessionSelect?.value;
        const classId = targetClassSelect?.value;
        if (!sessionId || !classId) {
            showFeedback('Select target session and class before previewing promotion.', 'warning');
            return;
        }

        const selectedStudents = cachedStudents.filter((student) => selectedStudentIds.has(student.id));
        if (selectedStudents.length === 0) {
            showFeedback('No students selected for preview.', 'warning');
            return;
        }

        promotionPreviewBody.innerHTML = '';
        selectedStudents.forEach((student) => {
            const row = document.createElement('tr');
            const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
            const currentClass = student.school_class?.name || student.class_name || '';

            row.innerHTML = `
                <td>${escapeHtml(fullName)}</td>
                <td>${escapeHtml(currentClass)}</td>
                <td>${escapeHtml(targetClassSelect.options[targetClassSelect.selectedIndex]?.text || '')}</td>
                <td>${retainSubjectsCheckbox?.checked ? 'Subjects retained' : 'Subjects will be reassigned'}</td>
            `;

            promotionPreviewBody.appendChild(row);
        });

        promotionPreviewCard.style.display = 'block';
        showFeedback('Preview generated. Please review before executing.', 'info');
    }

    async function handleExecutePromotion() {
        if (selectedStudentIds.size === 0) {
            showFeedback('Select at least one student before promoting.', 'warning');
            return;
        }

        const payload = buildPromotionPayload();
        if (!payload) {
            return;
        }

        if (!confirm(`Promote ${selectedStudentIds.size} student(s) to the selected class? This action cannot be undone.`)) {
            return;
        }

        showFeedback('Processing promotion...', 'info');

        try {
            const response = await fetch(`${backend_url}/api/v1/promotions/bulk`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.message || 'Failed to promote students.');
            }

            await response.json();
            showFeedback('Students promoted successfully.', 'success');
            await loadStudents();
        } catch (error) {
            console.error('Error promoting students:', error);
            showFeedback(error.message || 'Failed to promote students.', 'danger');
        }
    }

    function buildPromotionPayload() {
        const currentSessionId = sessionSelect?.value;
        const targetSessionId = targetSessionSelect?.value;
        const targetClassId = targetClassSelect?.value;

        if (!currentSessionId || !targetSessionId || !targetClassId) {
            showFeedback('Current session, target session, and target class are required.', 'warning');
            return null;
        }

        return {
            current_session_id: currentSessionId,
            current_term_id: termSelect?.value || null,
            current_class_id: classSelect?.value || null,
            current_class_arm_id: classArmSelect?.value || null,
            current_section_id: sectionSelect?.value || null,
            target_session_id: targetSessionId,
            target_class_id: targetClassId,
            target_class_arm_id: targetClassArmSelect?.value || null,
            target_section_id: targetSectionSelect?.value || null,
            retain_subjects: retainSubjectsCheckbox?.checked || false,
            student_ids: Array.from(selectedStudentIds),
        };
    }

    function showFeedback(message, type = 'success') {
        if (!promotionFeedback || !message) {
            return;
        }
        promotionFeedback.textContent = message;
        promotionFeedback.className = `alert alert-${type}`;
        promotionFeedback.style.display = 'block';
    }

    function resetFeedback() {
        if (!promotionFeedback) {
            return;
        }
        promotionFeedback.textContent = '';
        promotionFeedback.className = 'alert';
        promotionFeedback.style.display = 'none';
    }

    function clearSelect(select) {
        if (select) {
            select.innerHTML = '';
        }
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();
