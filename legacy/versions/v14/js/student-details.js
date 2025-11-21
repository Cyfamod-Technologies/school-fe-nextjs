const resolveUrl = (typeof window !== 'undefined' && typeof window.resolveBackendUrl === 'function')
    ? window.resolveBackendUrl
    : (path) => {
        if (!path) return '';
        const base = typeof backend_url === 'string' ? backend_url.replace(/\/$/, '') : '';
        if (/^https?:\/\//i.test(path)) return path;
        if (path.startsWith('/')) return `${base}${path}`;
        return `${base}/${path}`;
    };

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

document.addEventListener('DOMContentLoaded', async () => {
    const token = getCookie('token');
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    const urlParams = new URLSearchParams(window.location.search);
    const studentId = urlParams.get('id');

    if (!studentId) {
        alert('No student ID provided!');
        window.location.href = 'all-students.html';
        return;
    }

    const editButton = document.getElementById('edit-button');
    const deleteButton = document.getElementById('delete-button');
    const printResultButton = document.getElementById('print-result-button');

    const skillForm = document.getElementById('skill-rating-form');
    const skillSectionEnabled = Boolean(skillForm);
    const skillTypeSelect = document.getElementById('skill-type');
    const skillRatingSelect = document.getElementById('skill-rating-value');
    const skillSessionSelect = document.getElementById('skill-session');
    const skillTermSelect = document.getElementById('skill-term');
    const skillFormSubmitButton = document.getElementById('skill-form-submit');
    const skillFormCancelButton = document.getElementById('skill-form-cancel');
    const skillFeedback = document.getElementById('skill-feedback');
    const skillTableBody = document.getElementById('skill-ratings-body');

    const commentsForm = document.getElementById('term-summary-comments-form');
    const commentsSectionEnabled = Boolean(commentsForm);
    const classTeacherCommentInput = document.getElementById('class-teacher-comment');
    const principalCommentInput = document.getElementById('principal-comment');
    const commentsSubmitButton = document.getElementById('term-summary-submit');
    const commentsFeedback = document.getElementById('term-summary-feedback');

    const studentPinTableBody = document.getElementById('student-pin-table-body');
    const studentPinFeedback = document.getElementById('student-pin-feedback');
    const studentPinGenerateButton = document.getElementById('student-pin-generate');
    const studentPinRegenerateButton = document.getElementById('student-pin-regenerate');

    let sessionIdForResult = '';
    let termIdForResult = '';
    let currentSkillSessionId = '';
    let currentSkillTermId = '';
    let editingSkillRatingId = null;

    let cachedSessions = [];
    const cachedTerms = new Map();
    let cachedSkillTypes = [];
    const cachedSkillRatings = new Map();

    if (editButton) {
        editButton.href = `edit-student.html?id=${studentId}`;
    }

    if (deleteButton) {
        deleteButton.addEventListener('click', handleDelete);
    }

    if (skillFormCancelButton) {
        skillFormCancelButton.addEventListener('click', (event) => {
            event.preventDefault();
            resetSkillForm(false);
        });
    }

    if (skillForm) {
        skillForm.addEventListener('submit', handleSkillFormSubmit);
    }

    if (commentsForm) {
        commentsForm.addEventListener('submit', handleCommentsSubmit);
    }

    if (studentPinGenerateButton) {
        studentPinGenerateButton.addEventListener('click', () => handleStudentPinGenerate(false));
    }

    if (studentPinRegenerateButton) {
        studentPinRegenerateButton.addEventListener('click', () => handleStudentPinGenerate(true));
    }

    if (skillSessionSelect) {
        skillSessionSelect.addEventListener('change', async (event) => {
            currentSkillSessionId = event.target.value || '';
            await populateTermsForSession(currentSkillSessionId);
            await loadSkillRatings();
            await loadTermSummaryComments();
            await loadStudentPins();
            resetSkillForm(false);
        });
    }

    if (skillTermSelect) {
        skillTermSelect.addEventListener('change', async (event) => {
            currentSkillTermId = event.target.value || '';
            await loadSkillRatings();
            await loadTermSummaryComments();
            await loadStudentPins();
            resetSkillForm(false);
        });
    }

    if (printResultButton) {
        const buildPrintUrl = () => {
            const params = new URLSearchParams();
            params.set('student_id', studentId);

            if (sessionIdForResult) params.set('session_id', sessionIdForResult);
            if (termIdForResult) params.set('term_id', termIdForResult);

            return `${backend_url}/api/v1/students/${studentId}/results/print?${params.toString()}`;
        };

        printResultButton.addEventListener('click', async (event) => {
            event.preventDefault();

            try {
                const response = await fetch(buildPrintUrl(), {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'text/html',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });

                if (!response.ok) {
                    // Try to parse as JSON first (for API error responses)
                    let errorMessage = 'Unable to load printable result.';
                    const contentType = response.headers.get('content-type') || '';
                    
                    if (contentType.includes('application/json')) {
                        try {
                            const errorData = await response.json();
                            errorMessage = errorData.message || errorData.error || errorMessage;
                        } catch {
                            // If JSON parsing fails, fall back to text
                            const text = await response.text().catch(() => '');
                            errorMessage = text.trim() || errorMessage;
                        }
                    } else {
                        // For HTML responses, extract a user-friendly message
                        if (response.status === 403) {
                            errorMessage = 'You do not have permission to print student results.';
                        } else if (response.status === 401) {
                            errorMessage = 'Your session has expired. Please log in again.';
                        } else {
                            const text = await response.text().catch(() => '');
                            errorMessage = text.trim() || `Unable to load printable result (${response.status}).`;
                        }
                    }
                    
                    throw new Error(errorMessage);
                }

                const html = await response.text();
                const printWindow = window.open('', '_blank');
                if (!printWindow) {
                    alert('Unable to open result window. Please allow pop-ups for this site.');
                    return;
                }
                printWindow.document.open();
                printWindow.document.write(html);
                printWindow.document.close();
            } catch (error) {
                console.error('Error fetching printable result:', error);
                alert(error.message || 'Could not load printable result.');
            }
        });
    }

    const student = await fetchStudentDetails();

    if (student && skillSectionEnabled) {
        currentSkillSessionId = sessionIdForResult || student.current_session_id || '';
        currentSkillTermId = termIdForResult || student.current_term_id || '';
        await initializeSkillSection();
    }

    async function handleDelete(event) {
        event.preventDefault();

        if (!confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${backend_url}/api/v1/students/${studentId}`, {
                method: 'DELETE',
                headers,
            });

            if (response.status === 409) {
                const data = await response.json().catch(() => ({}));
                alert(data.message || 'Cannot delete student with dependent records.');
                return;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to delete student');
            }

            alert('Student deleted successfully.');
            window.location.href = 'all-students.html';
        } catch (error) {
            console.error('Error deleting student:', error);
            alert(`Error: ${error.message}`);
        }
    }

    async function fetchStudentDetails() {
        try {
            const response = await fetch(`${backend_url}/api/v1/students/${studentId}`, { headers });
            if (!response.ok) {
                throw new Error('Failed to fetch student details');
            }

            const data = await response.json();
            const student = data.data;

            const fullName = `${student.first_name || ''} ${student.middle_name || ''} ${student.last_name || ''}`.trim();
            document.getElementById('student-name-heading').textContent = fullName;
            document.getElementById('student-name').textContent = fullName;

            document.getElementById('student-admission-no').textContent = student.admission_no || 'N/A';
            const statusText = student.status ? student.status.charAt(0).toUpperCase() + student.status.slice(1) : 'N/A';
            document.getElementById('student-status').textContent = statusText;
            document.getElementById('student-gender').textContent = student.gender || 'N/A';
            document.getElementById('student-dob').textContent = formatDate(student.date_of_birth) || 'N/A';
            document.getElementById('student-admission-date').textContent = formatDate(student.admission_date) || 'N/A';
            document.getElementById('student-nationality').textContent = student.nationality || 'N/A';
            document.getElementById('student-state-of-origin').textContent = student.state_of_origin || 'N/A';
            document.getElementById('student-lga-of-origin').textContent = student.lga_of_origin || 'N/A';
            document.getElementById('student-house').textContent = student.house || 'N/A';
            document.getElementById('student-club').textContent = student.club || 'N/A';
            document.getElementById('student-address').textContent = student.address || 'N/A';
            document.getElementById('student-medical').textContent = student.medical_information || 'N/A';

            const sessionCell = document.getElementById('student-session');
            if (sessionCell) {
                sessionCell.textContent = student.session ? student.session.name : 'N/A';
                if (student.session) {
                    sessionIdForResult = student.session.id || student.session.uuid || '';
                    sessionCell.dataset.id = sessionIdForResult;
                }
            }

            const termCell = document.getElementById('student-term');
            if (termCell) {
                termCell.textContent = student.term ? student.term.name : 'N/A';
                if (student.term) {
                    termIdForResult = student.term.id || student.term.uuid || '';
                    termCell.dataset.id = termIdForResult;
                }
            }

            document.getElementById('student-class').textContent = student.school_class ? student.school_class.name : 'N/A';
            document.getElementById('student-class-arm').textContent = student.class_arm ? student.class_arm.name : 'N/A';
            document.getElementById('student-class-section').textContent = student.class_section ? student.class_section.name : 'N/A';
            document.getElementById('student-parent').textContent = student.parent ? `${student.parent.first_name || ''} ${student.parent.last_name || ''}`.trim() || 'N/A' : 'N/A';

            if (student.photo_url) {
                document.getElementById('student-photo').src = resolveUrl(student.photo_url);
            } else {
                document.getElementById('student-photo').src = '../assets/img/figure/student.png';
            }

            return student;
        } catch (error) {
            console.error('Error fetching student details:', error);
            alert('Could not load student details.');
            return null;
        }
    }

    async function initializeSkillSection() {
        resetSkillFeedback();

        await Promise.all([
            loadSkillTypes(),
            loadSessionsForSkills(),
        ]);

        if (skillSessionSelect) {
            if (currentSkillSessionId) {
                skillSessionSelect.value = currentSkillSessionId;
            } else if (skillSessionSelect.options.length > 1) {
                currentSkillSessionId = skillSessionSelect.options[1].value;
                skillSessionSelect.value = currentSkillSessionId;
            }
        }

        await populateTermsForSession(currentSkillSessionId, currentSkillTermId);
        await loadSkillRatings();
        await loadTermSummaryComments();
        await loadStudentPins();
        resetSkillForm(false);
    }

    async function loadSessionsForSkills() {
        if (!skillSessionSelect) {
            return;
        }

        try {
            const response = await fetch(`${backend_url}/api/v1/sessions`, { headers });
            if (!response.ok) {
                throw new Error('Failed to fetch sessions');
            }

            cachedSessions = await response.json();
            skillSessionSelect.innerHTML = '<option value="">Select session</option>';

            cachedSessions.forEach((session) => {
                const option = document.createElement('option');
                option.value = session.id;
                option.textContent = session.name;
                skillSessionSelect.appendChild(option);
            });

            if (currentSkillSessionId && cachedSessions.some((session) => session.id === currentSkillSessionId)) {
                skillSessionSelect.value = currentSkillSessionId;
            } else if (!currentSkillSessionId && cachedSessions.length > 0) {
                currentSkillSessionId = cachedSessions[0].id;
                skillSessionSelect.value = currentSkillSessionId;
            }
        } catch (error) {
            console.error('Error loading sessions:', error);
            showSkillFeedback('Unable to load session list.', 'danger');
        }
    }

    async function populateTermsForSession(sessionId, preferredTermId = '') {
        if (!skillTermSelect) {
            return;
        }

        skillTermSelect.innerHTML = '<option value="">Select term</option>';

        if (!sessionId) {
            currentSkillTermId = '';
            return;
        }

        let terms = cachedTerms.get(sessionId);

        if (!terms) {
            try {
                const response = await fetch(`${backend_url}/api/v1/sessions/${sessionId}/terms`, { headers });
                if (!response.ok) {
                    throw new Error('Failed to fetch terms');
                }

                terms = await response.json();
                cachedTerms.set(sessionId, terms);
            } catch (error) {
                console.error('Error loading terms:', error);
                showSkillFeedback('Unable to load terms for the selected session.', 'danger');
                currentSkillTermId = '';
                return;
            }
        }

        terms.forEach((term) => {
            const option = document.createElement('option');
            option.value = term.id;
            option.textContent = term.name;
            skillTermSelect.appendChild(option);
        });

        if (preferredTermId && terms.some((term) => term.id === preferredTermId)) {
            skillTermSelect.value = preferredTermId;
        } else if (terms.length > 0) {
            skillTermSelect.value = terms[0].id;
        }

        currentSkillTermId = skillTermSelect.value || '';
    }

    async function loadSkillTypes() {
        if (!skillTypeSelect) {
            return;
        }

        try {
            const response = await fetch(`${backend_url}/api/v1/students/${studentId}/skill-types`, { headers });
            if (!response.ok) {
                throw new Error('Failed to fetch skill types');
            }

            const payload = await response.json();
            cachedSkillTypes = Array.isArray(payload.data) ? payload.data : [];

            skillTypeSelect.innerHTML = '<option value="">Select skill</option>';
            cachedSkillTypes.forEach((type) => {
                const option = document.createElement('option');
                option.value = type.id;
                option.textContent = type.category ? `${type.category} - ${type.name}` : type.name;
                skillTypeSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Error loading skill types:', error);
            showSkillFeedback('Unable to load skill list.', 'danger');
        }
    }

    async function loadSkillRatings() {
        if (!skillTableBody) {
            return;
        }

        const params = new URLSearchParams();
        if (currentSkillSessionId) params.append('session_id', currentSkillSessionId);
        if (currentSkillTermId) params.append('term_id', currentSkillTermId);

        try {
            const response = await fetch(`${backend_url}/api/v1/students/${studentId}/skill-ratings?${params.toString()}`, { headers });
            if (!response.ok) {
                throw new Error('Failed to fetch skill ratings');
            }

            const payload = await response.json();
            const ratings = Array.isArray(payload.data) ? payload.data : [];

            cachedSkillRatings.clear();
            ratings.forEach((rating) => cachedSkillRatings.set(rating.id, rating));

            renderSkillRatings(ratings);
        } catch (error) {
            console.error('Error loading skill ratings:', error);
            showSkillFeedback('Unable to load skill ratings for the selected term.', 'danger');
            renderSkillRatings([]);
        }
    }

    function renderSkillRatings(ratings) {
        if (!skillTableBody) {
            return;
        }

        if (!Array.isArray(ratings) || ratings.length === 0) {
            skillTableBody.innerHTML = '<tr><td colspan="4">No skill ratings recorded for this term.</td></tr>';
            return;
        }

        skillTableBody.innerHTML = '';

        ratings.forEach((rating) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${escapeHtml((rating.skill_type && rating.skill_type.name) || rating.skill_type_name || '—')}</td>
                <td>${rating.rating_value ?? '—'}</td>
                <td>${formatDateTime(rating.updated_at)}</td>
                <td>
                    <button class="btn btn-link p-0 mr-2 skill-edit" data-id="${rating.id}">Edit</button>
                    <button class="btn btn-link text-danger p-0 skill-delete" data-id="${rating.id}">Delete</button>
                </td>
            `;
            skillTableBody.appendChild(tr);
        });

        skillTableBody.querySelectorAll('.skill-edit').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                const ratingId = event.currentTarget.dataset.id;
                await beginEditSkillRating(ratingId);
            });
        });

        skillTableBody.querySelectorAll('.skill-delete').forEach((button) => {
            button.addEventListener('click', async (event) => {
                event.preventDefault();
                const ratingId = event.currentTarget.dataset.id;
                await handleDeleteSkillRating(ratingId);
            });
        });
    }

    async function beginEditSkillRating(ratingId) {
        const rating = cachedSkillRatings.get(ratingId);
        if (!rating || !skillForm) {
            return;
        }

        editingSkillRatingId = ratingId;

        if (skillTypeSelect) {
            skillTypeSelect.value = rating.skill_type_id || '';
        }

        if (skillRatingSelect) {
            skillRatingSelect.value = rating.rating_value != null ? String(rating.rating_value) : '';
        }


        if (skillSessionSelect && rating.session_id && skillSessionSelect.value !== rating.session_id) {
            currentSkillSessionId = rating.session_id;
            skillSessionSelect.value = currentSkillSessionId;
            await populateTermsForSession(currentSkillSessionId, rating.term_id);
        } else if (skillTermSelect && rating.term_id) {
            skillTermSelect.value = rating.term_id;
            currentSkillTermId = rating.term_id;
        }

        if (skillFormSubmitButton) {
            skillFormSubmitButton.textContent = 'Update Skill Rating';
        }

        if (skillFormCancelButton) {
            skillFormCancelButton.classList.remove('d-none');
        }

        resetSkillFeedback();
    }

    async function handleDeleteSkillRating(ratingId) {
        const rating = cachedSkillRatings.get(ratingId);
        if (!rating) {
            return;
        }

        if (!confirm('Remove this skill rating?')) {
            return;
        }

        try {
            const response = await fetch(`${backend_url}/api/v1/students/${studentId}/skill-ratings/${ratingId}`, {
                method: 'DELETE',
                headers,
            });

            if (response.status === 204) {
                showSkillFeedback('Skill rating removed.', 'success');
                if (editingSkillRatingId === ratingId) {
                    resetSkillForm(false);
                }
                await loadSkillRatings();
                return;
            }

            if (response.status === 422) {
                const data = await response.json().catch(() => ({}));
                showSkillFeedback(data.message || 'This skill rating can no longer be removed for the selected term.', 'warning');
                return;
            }

            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to delete skill rating.');
        } catch (error) {
            console.error('Error deleting skill rating:', error);
            showSkillFeedback(error.message || 'Unable to delete skill rating.', 'danger');
        }
    }

    async function handleSkillFormSubmit(event) {
        event.preventDefault();

        if (!skillSectionEnabled) {
            return;
        }

        const skillTypeId = skillTypeSelect ? skillTypeSelect.value.trim() : '';
        const ratingValueRaw = skillRatingSelect ? skillRatingSelect.value : '';
        const ratingValue = ratingValueRaw ? parseInt(ratingValueRaw, 10) : NaN;
        if (!skillTypeId) {
            showSkillFeedback('Select a skill before saving.', 'warning');
            return;
        }

        if (!Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
            showSkillFeedback('Choose a rating between 1 and 5.', 'warning');
            return;
        }

        if (!currentSkillSessionId || !currentSkillTermId) {
            showSkillFeedback('Select a session and term before saving.', 'warning');
            return;
        }

        const payload = {
            skill_type_id: skillTypeId,
            session_id: currentSkillSessionId,
            term_id: currentSkillTermId,
            rating_value: ratingValue,
        };

        const endpoint = editingSkillRatingId
            ? `${backend_url}/api/v1/students/${studentId}/skill-ratings/${editingSkillRatingId}`
            : `${backend_url}/api/v1/students/${studentId}/skill-ratings`;

        const method = editingSkillRatingId ? 'PUT' : 'POST';

        toggleSkillFormLoading(true);
        resetSkillFeedback();

        try {
            const response = await fetch(endpoint, {
                method,
                headers,
                body: JSON.stringify(payload),
            });

            if (response.status === 201 || response.status === 200) {
                await response.json().catch(() => ({}));
                showSkillFeedback(editingSkillRatingId ? 'Skill rating updated.' : 'Skill rating recorded.', 'success');
                resetSkillForm(false);
                await loadSkillRatings();
                return;
            }

            const errorData = await response.json().catch(() => ({}));
            let message = errorData?.message || 'Could not save skill rating.';

            if (errorData?.errors) {
                const firstError = Object.values(errorData.errors)[0];
                if (Array.isArray(firstError) && firstError.length > 0) {
                    message = firstError[0];
                }
            }

            showSkillFeedback(message, response.status === 409 ? 'warning' : 'danger');
        } catch (error) {
            console.error('Error saving skill rating:', error);
            showSkillFeedback(error.message || 'Unable to save skill rating.', 'danger');
        } finally {
            toggleSkillFormLoading(false);
        }
    }

    function resetSkillForm(resetSelections = true) {
        editingSkillRatingId = null;

        if (skillForm) {
            if (resetSelections) {
            if (skillSessionSelect) skillSessionSelect.value = currentSkillSessionId || '';
            if (skillTermSelect) skillTermSelect.value = currentSkillTermId || '';
        }
        if (skillTypeSelect) skillTypeSelect.value = '';
        if (skillRatingSelect) skillRatingSelect.value = '';
    }

    if (skillFormSubmitButton) {
        skillFormSubmitButton.disabled = false;
        skillFormSubmitButton.textContent = 'Save Skill Rating';
    }

    if (skillFormCancelButton) {
            skillFormCancelButton.disabled = false;
            skillFormCancelButton.classList.add('d-none');
        }
    }

    async function loadStudentPins() {
        if (!studentPinTableBody) {
            return;
        }

        resetStudentPinFeedback();

        if (!currentSkillSessionId || !currentSkillTermId) {
            studentPinTableBody.innerHTML = '<tr><td colspan="7">Select a session and term to view the PIN.</td></tr>';
            return;
        }

        studentPinTableBody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';

        try {
            const params = new URLSearchParams();
            params.set('session_id', currentSkillSessionId);
            params.set('term_id', currentSkillTermId);

            const response = await fetch(`${backend_url}/api/v1/students/${studentId}/result-pins?${params.toString()}`, { headers });

            if (!response.ok) {
                throw new Error('Unable to load result PINs for this student.');
            }

            const payload = await response.json();
            const pins = Array.isArray(payload.data) ? payload.data : [];

            renderStudentPins(pins);
        } catch (error) {
            console.error('Error loading student pins:', error);
            showStudentPinFeedback(error.message || 'Unable to load result PINs.', 'danger');
            studentPinTableBody.innerHTML = '<tr><td colspan="7">Unable to load result PINs.</td></tr>';
        }
    }

    function renderStudentPins(pins) {
        if (!studentPinTableBody) {
            return;
        }

        if (!Array.isArray(pins) || pins.length === 0) {
            studentPinTableBody.innerHTML = '<tr><td colspan="7">No result PIN generated for this student.</td></tr>';
            return;
        }

        studentPinTableBody.innerHTML = '';

        pins.forEach((pin) => {
            const row = document.createElement('tr');
            const statusBadge = buildStatusBadge(pin.status);
            const expires = pin.expires_at ? formatDate(pin.expires_at) : '—';
            const updated = pin.updated_at ? formatDateTime(pin.updated_at) : '—';
            const masked = maskPin(pin.pin_code || '');

            row.innerHTML = `
                <td>${escapeHtml(pin.session?.name || pin.session_name || '')}</td>
                <td>${escapeHtml(pin.term?.name || pin.term_name || '')}</td>
                <td><code>${masked}</code></td>
                <td>${statusBadge}</td>
                <td>${expires}</td>
                <td>${updated}</td>
                <td>
                    <button class="btn btn-link p-0 mr-3 student-pin-show" data-pin="${pin.pin_code}">Show</button>
                    ${pin.status === 'active' ? `<button class="btn btn-link text-danger p-0 student-pin-invalidate" data-id="${pin.id}">Invalidate</button>` : ''}
                </td>
            `;

            studentPinTableBody.appendChild(row);
        });

        studentPinTableBody.querySelectorAll('.student-pin-show').forEach((button) => {
            button.addEventListener('click', (event) => {
                event.preventDefault();
                const pinValue = event.currentTarget.getAttribute('data-pin');
                if (!pinValue) return;
                alert(`Result PIN: ${pinValue}`);
            });
        });

        studentPinTableBody.querySelectorAll('.student-pin-invalidate').forEach((button) => {
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

                    if (!response.ok) throw new Error('Unable to invalidate result PIN.');

                    await response.json();
                    showStudentPinFeedback('Result PIN invalidated.', 'success');
                    await loadStudentPins();
                } catch (error) {
                    console.error('Error invalidating result pin:', error);
                    showStudentPinFeedback(error.message || 'Unable to invalidate result PIN.', 'danger');
                }
            });
        });
    }

    async function handleStudentPinGenerate(regenerate) {
        if (!currentSkillSessionId || !currentSkillTermId) {
            showStudentPinFeedback('Select the session and term before generating a PIN.', 'warning');
            return;
        }

        resetStudentPinFeedback();

        try {
            const payload = {
                session_id: currentSkillSessionId,
                term_id: currentSkillTermId,
                regenerate,
            };

            const response = await fetch(`${backend_url}/api/v1/students/${studentId}/result-pins`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData?.message || 'Unable to generate result PIN.';
                throw new Error(message);
            }

            await response.json();
            showStudentPinFeedback('Result PIN generated successfully.', 'success');
            await loadStudentPins();
        } catch (error) {
            console.error('Error generating student result pin:', error);
            showStudentPinFeedback(error.message || 'Unable to generate result PIN.', 'danger');
        }
    }

    function showStudentPinFeedback(message, type = 'success') {
        if (!studentPinFeedback || !message) {
            return;
        }

        studentPinFeedback.textContent = message;
        studentPinFeedback.className = `alert alert-${type}`;
        studentPinFeedback.style.display = 'block';
    }

    function resetStudentPinFeedback() {
        if (!studentPinFeedback) {
            return;
        }

        studentPinFeedback.textContent = '';
        studentPinFeedback.className = 'alert';
        studentPinFeedback.style.display = 'none';
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
    async function loadTermSummaryComments() {
        if (!commentsSectionEnabled) {
            return;
        }

        resetCommentFeedback();

        if (!currentSkillSessionId || !currentSkillTermId) {
            if (classTeacherCommentInput) classTeacherCommentInput.value = '';
            if (principalCommentInput) principalCommentInput.value = '';
            return;
        }

        toggleCommentsLoading(true);

        const params = new URLSearchParams();
        params.set('session_id', currentSkillSessionId);
        params.set('term_id', currentSkillTermId);

        try {
            const response = await fetch(`${backend_url}/api/v1/students/${studentId}/term-summary?${params.toString()}`, {
                headers,
            });

            if (response.status === 404) {
                if (classTeacherCommentInput) classTeacherCommentInput.value = '';
                if (principalCommentInput) principalCommentInput.value = '';
                return;
            }

            if (!response.ok) {
                throw new Error('Unable to load term comments.');
            }

            const payload = await response.json();
            const data = payload?.data ?? {};

            if (classTeacherCommentInput) {
                classTeacherCommentInput.value = data.class_teacher_comment || '';
            }

            if (principalCommentInput) {
                principalCommentInput.value = data.principal_comment || '';
            }
        } catch (error) {
            console.error('Error loading term comments:', error);
            showCommentFeedback(error.message || 'Unable to load comments for the selected term.', 'danger');
        } finally {
            toggleCommentsLoading(false);
        }
    }

    async function handleCommentsSubmit(event) {
        event.preventDefault();

        if (!commentsSectionEnabled) {
            return;
        }

        if (!currentSkillSessionId || !currentSkillTermId) {
            showCommentFeedback('Select a session and term before saving comments.', 'warning');
            return;
        }

        const payload = {
            session_id: currentSkillSessionId,
            term_id: currentSkillTermId,
            class_teacher_comment: classTeacherCommentInput ? classTeacherCommentInput.value.trim() : null,
            principal_comment: principalCommentInput ? principalCommentInput.value.trim() : null,
        };

        if (payload.class_teacher_comment === '') {
            payload.class_teacher_comment = null;
        }

        if (payload.principal_comment === '') {
            payload.principal_comment = null;
        }

        resetCommentFeedback();
        toggleCommentsLoading(true, true);

        try {
            const response = await fetch(`${backend_url}/api/v1/students/${studentId}/term-summary`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload),
            });

            if (response.status === 404) {
                throw new Error('Term summary not found for the selected session and term.');
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const message = errorData?.message || 'Unable to save comments.';
                throw new Error(message);
            }

            await response.json().catch(() => ({}));
            showCommentFeedback('Comments saved successfully.', 'success');

            if (classTeacherCommentInput) {
                classTeacherCommentInput.value = payload.class_teacher_comment || '';
            }

            if (principalCommentInput) {
                principalCommentInput.value = payload.principal_comment || '';
            }
        } catch (error) {
            console.error('Error saving comments:', error);
            showCommentFeedback(error.message || 'Unable to save comments.', 'danger');
        } finally {
            toggleCommentsLoading(false, true);
        }
    }

    function toggleCommentsLoading(isLoading, submitting = false) {
        if (!commentsSectionEnabled) {
            return;
        }

        if (classTeacherCommentInput) classTeacherCommentInput.disabled = isLoading;
        if (principalCommentInput) principalCommentInput.disabled = isLoading;
        if (commentsSubmitButton) {
            commentsSubmitButton.disabled = isLoading;
            commentsSubmitButton.textContent = isLoading
                ? (submitting ? 'Saving...' : 'Loading...')
                : 'Save Comments';
        }
    }

    function resetCommentFeedback() {
        if (!commentsFeedback) {
            return;
        }

        commentsFeedback.style.display = 'none';
        commentsFeedback.textContent = '';
        commentsFeedback.className = 'alert';
    }

    function showCommentFeedback(message, type = 'success') {
        if (!commentsFeedback || !message) {
            return;
        }

        commentsFeedback.textContent = message;
        commentsFeedback.className = `alert alert-${type}`;
        commentsFeedback.style.display = 'block';
    }

    function toggleSkillFormLoading(isLoading) {
        if (skillFormSubmitButton) {
            skillFormSubmitButton.disabled = isLoading;
            skillFormSubmitButton.textContent = editingSkillRatingId
                ? (isLoading ? 'Updating...' : 'Update Skill Rating')
                : (isLoading ? 'Saving...' : 'Save Skill Rating');
        }

        [skillTypeSelect, skillRatingSelect, skillSessionSelect, skillTermSelect].forEach((element) => {
            if (element) {
                element.disabled = isLoading;
            }
        });

        if (skillFormCancelButton) {
            skillFormCancelButton.disabled = isLoading;
        }
    }

    function resetSkillFeedback() {
        if (!skillFeedback) {
            return;
        }

        skillFeedback.style.display = 'none';
        skillFeedback.className = 'alert';
        skillFeedback.textContent = '';
    }

    function showSkillFeedback(message, type = 'success') {
        if (!skillFeedback || !message) {
            return;
        }

        skillFeedback.className = `alert alert-${type}`;
        skillFeedback.textContent = message;
        skillFeedback.style.display = 'block';
    }

    function formatDate(value) {
        if (!value) return '';
        if (value.length >= 10) {
            return value.slice(0, 10);
        }
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    }

    function formatDateTime(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
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
});
