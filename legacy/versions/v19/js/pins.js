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

    const sessionSelect = document.getElementById('pin-session');
    const termSelect = document.getElementById('pin-term');
    const classSelect = document.getElementById('pin-class');
    const classArmSelect = document.getElementById('pin-class-arm');
    const studentSelect = document.getElementById('pin-student');
    const expiryInput = document.getElementById('pin-expiry');
    const regenerateCheckbox = document.getElementById('pin-regenerate');
    const pinTableBody = document.getElementById('pin-table-body');
    const feedbackAlert = document.getElementById('pin-feedback');
    const refreshButton = document.getElementById('pins-refresh');
    const generateSingleButton = document.getElementById('pin-generate-single');
    const generateBulkButton = document.getElementById('pin-generate-bulk');

    document.addEventListener('DOMContentLoaded', async () => {
        await Promise.all([
            loadSessions(),
            loadClasses(),
        ]);

        if (refreshButton) {
            refreshButton.addEventListener('click', async () => {
                await loadPins();
            });
        }

        if (generateBulkButton) {
            generateBulkButton.addEventListener('click', handleBulkGenerate);
        }

        if (generateSingleButton) {
            generateSingleButton.addEventListener('click', handleSingleGenerate);
        }

        if (sessionSelect) {
            sessionSelect.addEventListener('change', async () => {
            clearSelect(termSelect);
            await loadTerms(sessionSelect.value);
            await loadPins();
            await loadStudents();
        });
    }

    if (termSelect) {
        termSelect.addEventListener('change', loadPins);
        }

        if (classSelect) {
            classSelect.addEventListener('change', async () => {
                await loadClassArms(classSelect.value);
                await loadStudents();
                await loadPins();
            });
        }

        if (classArmSelect) {
            classArmSelect.addEventListener('change', loadPins);
        }

        if (classArmSelect) {
            classArmSelect.addEventListener('change', loadStudents);
        }

        if (studentSelect) {
            studentSelect.addEventListener('change', loadPins);
        }
    });

    function getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    async function loadSessions() {
        if (!sessionSelect) return;
        clearSelect(sessionSelect);
        sessionSelect.innerHTML = '<option value="">Select session</option>';

        try {
            const response = await fetch(`${backend_url}/api/v1/sessions`, { headers });
            if (!response.ok) throw new Error('Failed to load sessions');
            const sessions = await response.json();

            let firstSessionId = '';

            sessions.forEach((session) => {
                const option = document.createElement('option');
                option.value = session.id;
                option.textContent = session.name;
                sessionSelect.appendChild(option);
                if (!firstSessionId) {
                    firstSessionId = session.id;
                }
            });

            if (!sessionSelect.value && firstSessionId) {
                sessionSelect.value = firstSessionId;
                await loadTerms(firstSessionId, true);
            }
        } catch (error) {
            showFeedback(error.message, 'danger');
        }
    }

    async function loadTerms(sessionId, autoLoadPins = false) {
        if (!termSelect) return;
        clearSelect(termSelect);
        termSelect.innerHTML = '<option value="">Select term</option>';

        if (!sessionId) {
            return;
        }

        try {
            const response = await fetch(`${backend_url}/api/v1/sessions/${sessionId}/terms`, { headers });
            if (!response.ok) throw new Error('Failed to load terms');
            const terms = await response.json();

            let firstTermId = '';

            terms.forEach((term) => {
                const option = document.createElement('option');
                option.value = term.id;
                option.textContent = term.name;
                termSelect.appendChild(option);
                if (!firstTermId) {
                    firstTermId = term.id;
                }
            });

            if (!termSelect.value && firstTermId) {
                termSelect.value = firstTermId;
                if (autoLoadPins) {
                    await loadPins();
                    await loadStudents();
                }
            } else if (autoLoadPins) {
                await loadPins();
                await loadStudents();
            }
        } catch (error) {
            showFeedback(error.message, 'danger');
        }
    }

    async function loadClasses() {
        if (!classSelect) return;
        clearSelect(classSelect);
        classSelect.innerHTML = '<option value="">All classes</option>';

        try {
            const response = await fetch(`${backend_url}/api/v1/classes`, { headers });
            if (!response.ok) throw new Error('Failed to load classes');
            const payload = await response.json();
            const classes = payload?.data ?? payload;

            classes.forEach((item) => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.name;
                classSelect.appendChild(option);
            });
        } catch (error) {
            showFeedback(error.message, 'danger');
        }
    }

    async function loadClassArms(classId) {
        if (!classArmSelect) return;
        clearSelect(classArmSelect);
        classArmSelect.innerHTML = '<option value="">None</option>';

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
                classArmSelect.appendChild(option);
            });
        } catch (error) {
            showFeedback(error.message, 'danger');
        }
    }

    async function loadStudents() {
        if (!studentSelect) {
            return;
        }

        clearSelect(studentSelect);
        studentSelect.innerHTML = '<option value="">Select student</option>';

        const sessionId = sessionSelect?.value;
        const termId = termSelect?.value;
        const classId = classSelect?.value;

        if (!sessionId || !termId || !classId) {
            return;
        }

        try {
            const params = new URLSearchParams();
            params.set('per_page', '200');
            params.set('school_class_id', classId);
            if (classArmSelect && classArmSelect.value) {
                params.set('class_arm_id', classArmSelect.value);
            }
            params.set('session_id', sessionId);

            const response = await fetch(`${backend_url}/api/v1/students?${params.toString()}`, { headers });
            if (!response.ok) throw new Error('Failed to load students for selected class.');

            const payload = await response.json();
            const students = Array.isArray(payload.data) ? payload.data : (payload.data?.data ?? payload);

            if (!Array.isArray(students) || students.length === 0) {
                studentSelect.innerHTML = '<option value="">No students in this class</option>';
                return;
            }

            students.forEach((student) => {
                const option = document.createElement('option');
                option.value = student.id;
                const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
                option.textContent = `${student.admission_no || ''} - ${fullName}`;
                studentSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading students:', error);
            showFeedback(error.message || 'Unable to load students for the selected class.', 'danger');
        }
    }

    async function loadPins() {
        if (!sessionSelect || !termSelect || !pinTableBody) {
            return;
        }

        const sessionId = sessionSelect.value;
        const termId = termSelect.value;

        if (!sessionId || !termId) {
            pinTableBody.innerHTML = '<tr><td colspan="8">Select a session and term to view PINs.</td></tr>';
            return;
        }

        resetFeedback();
        pinTableBody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';

        try {
            const query = new URLSearchParams();
            query.set('session_id', sessionId);
            query.set('term_id', termId);

            if (classSelect && classSelect.value) {
                query.set('school_class_id', classSelect.value);
            }

            if (classArmSelect && classArmSelect.value) {
                query.set('class_arm_id', classArmSelect.value);
            }
            if (studentSelect && studentSelect.value) {
                query.set('student_id', studentSelect.value);
            }

            const response = await fetch(`${backend_url}/api/v1/result-pins?${query.toString()}`, { headers });
            if (!response.ok) throw new Error('Failed to load result PINs');
            const payload = await response.json();
            const pins = payload?.data ?? [];

            if (pins.length === 0) {
                pinTableBody.innerHTML = '<tr><td colspan="8">No result PINs found for the selected filters.</td></tr>';
                return;
            }

            renderPinTable(pins);
        } catch (error) {
            console.error('Error loading pins:', error);
            showFeedback(error.message || 'Unable to load result PINs.', 'danger');
            pinTableBody.innerHTML = '<tr><td colspan="8">Unable to load result PINs.</td></tr>';
        }
    }

    function renderPinTable(pins) {
        if (!pinTableBody) return;

        pinTableBody.innerHTML = '';

        pins.forEach((pin) => {
            const row = document.createElement('tr');
            const studentName = pin.student?.name || pin.student_name || 'Student';
            const statusBadge = buildStatusBadge(pin.status);
            const expires = pin.expires_at ? formatDate(pin.expires_at) : '—';
            const updated = pin.updated_at ? formatDateTime(pin.updated_at) : '—';
            const maskedPin = maskPin(pin.pin_code || '');

            row.innerHTML = `
                <td>${escapeHtml(studentName)}</td>
                <td>${escapeHtml(pin.session?.name || pin.session_name || '')}</td>
                <td>${escapeHtml(pin.term?.name || pin.term_name || '')}</td>
                <td><code>${maskedPin}</code></td>
                <td>${statusBadge}</td>
                <td>${expires}</td>
                <td>${updated}</td>
                <td>
                    <button class="btn btn-link p-0 mr-3 text-primary pin-reveal" data-pin="${pin.pin_code}">Show</button>
                    <button class="btn btn-link p-0 mr-3 pin-regenerate" data-student="${pin.student_id}">Regenerate</button>
                    <button class="btn btn-link text-danger p-0 pin-invalidate" data-id="${pin.id}">Invalidate</button>
                </td>
            `;

            pinTableBody.appendChild(row);
        });

        pinTableBody.querySelectorAll('.pin-reveal').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const pinValue = event.currentTarget.getAttribute('data-pin');
                if (!pinValue) return;
                alert(`Result PIN: ${pinValue}`);
            });
        });

        pinTableBody.querySelectorAll('.pin-invalidate').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                const pinId = event.currentTarget.getAttribute('data-id');
                if (!pinId) return;

                if (!confirm('Invalidate this result PIN?')) {
                    return;
                }

                try {
                    const response = await fetch(`${backend_url}/api/v1/result-pins/${pinId}/invalidate`, {
                        method: 'PUT',
                        headers,
                    });

                    if (!response.ok) throw new Error('Unable to invalidate PIN');
                    await response.json();
                    showFeedback('Result PIN invalidated.', 'success');
                    await loadPins();
                } catch (error) {
                    console.error('Error invalidating pin:', error);
                    showFeedback(error.message || 'Unable to invalidate result PIN.', 'danger');
                }
            });
        });

        pinTableBody.querySelectorAll('.pin-regenerate').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                const studentId = event.currentTarget.getAttribute('data-student');
                if (!studentId) return;

                await generatePinForStudent(studentId, true);
            });
        });
    }

    async function generatePinForStudent(studentId, regenerate = false) {
        const sessionId = sessionSelect?.value;
        const termId = termSelect?.value;

        if (!sessionId || !termId) {
            showFeedback('Select session and term before generating PINs.', 'warning');
            return;
        }

        resetFeedback();

        try {
            const response = await fetch(`${backend_url}/api/v1/students/${studentId}/result-pins`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    session_id: sessionId,
                    term_id: termId,
                    regenerate,
                    expires_at: expiryInput?.value || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData?.message || 'Unable to generate result PIN.';
                throw new Error(message);
            }

            await response.json();
            showFeedback('Result PIN generated successfully.', 'success');
            await loadPins();
        } catch (error) {
            console.error('Error generating pin:', error);
            showFeedback(error.message || 'Unable to generate result PIN.', 'danger');
        }
    }

    async function handleSingleGenerate() {
        resetFeedback();
        const selectedStudent = studentSelect?.value;
        if (!selectedStudent) {
            showFeedback('Select a student from the list before generating a PIN.', 'warning');
            return;
        }

        await generatePinForStudent(selectedStudent, regenerateCheckbox?.checked || false);
    }

    async function handleBulkGenerate() {
        const sessionId = sessionSelect?.value;
        const termId = termSelect?.value;

        if (!sessionId || !termId) {
            showFeedback('Select session and term before generating PINs.', 'warning');
            return;
        }

        try {
            const payload = {
                session_id: sessionId,
                term_id: termId,
                school_class_id: classSelect?.value || null,
                class_arm_id: classArmSelect?.value || null,
                regenerate: regenerateCheckbox?.checked || false,
                expires_at: expiryInput?.value || null,
            };

            const response = await fetch(`${backend_url}/api/v1/result-pins/bulk`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData?.message || 'Unable to generate result PINs.');
            }

            await response.json();
            showFeedback('Result PINs generated successfully.', 'success');
            await loadPins();
        } catch (error) {
            console.error('Error bulk generating pins:', error);
            showFeedback(error.message || 'Unable to generate result PINs.', 'danger');
        }
    }

    function buildStatusBadge(status) {
        const normalized = (status || '').toLowerCase();
        let className = 'badge badge-secondary';
        if (normalized === 'active') className = 'badge badge-success';
        if (normalized === 'revoked') className = 'badge badge-danger';
        if (normalized === 'expired') className = 'badge badge-warning';

        return `<span class="${className}">${normalized || 'unknown'}</span>`;
    }

    function maskPin(pin) {
        if (!pin) return '**********';
        return `${pin.slice(0, 2)}****${pin.slice(-2)}`;
    }

    function clearSelect(selectElement) {
        if (selectElement) {
            selectElement.innerHTML = '';
        }
    }

    function showFeedback(message, type = 'success') {
        if (!feedbackAlert || !message) {
            return;
        }
        feedbackAlert.textContent = message;
        feedbackAlert.className = `alert alert-${type}`;
        feedbackAlert.style.display = 'block';
    }

    function resetFeedback() {
        if (!feedbackAlert) {
            return;
        }
        feedbackAlert.textContent = '';
        feedbackAlert.className = 'alert';
        feedbackAlert.style.display = 'none';
    }

    function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toISOString().slice(0, 10);
    }

    function formatDateTime(value) {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
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
