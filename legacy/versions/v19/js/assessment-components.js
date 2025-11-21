function getCookie(name) {
    const nameEQ = `${name}=`;
    const parts = document.cookie.split(';');
    for (let i = 0; i < parts.length; i++) {
        let value = parts[i];
        while (value.charAt(0) === ' ') value = value.substring(1);
        if (value.indexOf(nameEQ) === 0) return value.substring(nameEQ.length);
    }
    return null;
}

function authHeaders(extra = {}) {
    return {
        Accept: 'application/json',
        Authorization: `Bearer ${getCookie('token')}`,
        ...extra,
    };
}

function unpackCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload?.data?.data && Array.isArray(payload.data.data)) return payload.data.data;
    return [];
}

const componentState = {
    subjects: [],
    editingId: null,
    table: {
        page: 1,
        perPage: 10,
        search: '',
        subject_id: '',
    },
};

const componentEls = {};

document.addEventListener('DOMContentLoaded', async () => {
    cacheComponentElements();
    bindComponentEvents();

    await loadSubjects();
    populateSubjectOptions();

    refreshComponentTable();
});

function cacheComponentElements() {
    componentEls.form = document.getElementById('component-form');
    componentEls.formId = document.getElementById('component-id');
    componentEls.name = document.getElementById('component-name');
    componentEls.weight = document.getElementById('component-weight');
    componentEls.order = document.getElementById('component-order');
    componentEls.label = document.getElementById('component-label');
    componentEls.subjectsContainer = document.getElementById('component-subjects');
    componentEls.resetButton = document.getElementById('component-reset');

    componentEls.filterSearch = document.getElementById('component-filter-search');
    componentEls.filterSubject = document.getElementById('component-filter-subject');
    componentEls.filterApply = document.getElementById('component-filter-apply');
    componentEls.filterReset = document.getElementById('component-filter-reset');

    componentEls.tableBody = document.getElementById('component-table');
    componentEls.summary = document.getElementById('component-summary');
    componentEls.pagination = document.getElementById('component-pagination');
}

function bindComponentEvents() {
    if (componentEls.resetButton) {
        componentEls.resetButton.addEventListener('click', () => resetComponentForm());
    }

    if (componentEls.form) {
        componentEls.form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await submitComponent();
        });
    }

    if (componentEls.filterApply) {
        componentEls.filterApply.addEventListener('click', (event) => {
            event.preventDefault();
            componentState.table.search = componentEls.filterSearch?.value.trim() ?? '';
            componentState.table.subject_id = componentEls.filterSubject?.value ?? '';
            componentState.table.page = 1;
            refreshComponentTable();
        });
    }

    if (componentEls.filterReset) {
        componentEls.filterReset.addEventListener('click', (event) => {
            event.preventDefault();
            if (componentEls.filterSearch) componentEls.filterSearch.value = '';
            if (componentEls.filterSubject) componentEls.filterSubject.value = '';
            componentState.table = {
                page: 1,
                perPage: 10,
                search: '',
                subject_id: '',
            };
            refreshComponentTable();
        });
    }
}

async function loadSubjects() {
    try {
        const response = await fetch(`${backend_url}/api/v1/settings/subjects?per_page=200`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Unable to load subjects.');
        const payload = await response.json();
        componentState.subjects = unpackCollection(payload);
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

function populateSubjectOptions() {
    if (componentEls.subjectsContainer) {
        if (!componentState.subjects.length) {
            componentEls.subjectsContainer.innerHTML = '<p class="text-muted mb-0">No subjects available.</p>';
        } else {
            const selectAllCheckbox = `
                <div class="form-check mb-2 pb-2 border-bottom">
                    <input class="form-check-input" type="checkbox" id="select-all-subjects">
                    <label class="form-check-label fw-bold" for="select-all-subjects">Select All</label>
                </div>
            `;

            const subjectCheckboxes = componentState.subjects
                .map((subject) => {
                    const label = `${subject.name}${subject.code ? ` (${subject.code})` : ''}`;
                    return `
                        <div class="form-check">
                            <input class="form-check-input component-subject-checkbox" type="checkbox" value="${subject.id}" id="component-subject-${subject.id}">
                            <label class="form-check-label" for="component-subject-${subject.id}">${label}</label>
                        </div>
                    `;
                })
                .join('');

            componentEls.subjectsContainer.innerHTML = selectAllCheckbox + subjectCheckboxes;

            // Add event listener for select all checkbox
            const selectAllEl = document.getElementById('select-all-subjects');
            if (selectAllEl) {
                selectAllEl.addEventListener('change', function(e) {
                    const checkboxes = componentEls.subjectsContainer.querySelectorAll('.component-subject-checkbox');
                    checkboxes.forEach(checkbox => {
                        checkbox.checked = e.target.checked;
                    });
                });

                // Update select all checkbox when individual checkboxes change
                const subjectCheckboxes = componentEls.subjectsContainer.querySelectorAll('.component-subject-checkbox');
                subjectCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', function() {
                        const allCheckboxes = componentEls.subjectsContainer.querySelectorAll('.component-subject-checkbox');
                        const checkedCount = componentEls.subjectsContainer.querySelectorAll('.component-subject-checkbox:checked').length;
                        selectAllEl.checked = checkedCount === allCheckboxes.length;
                    });
                });
            }
        }
    }

    if (componentEls.filterSubject) {
        const options = componentState.subjects.map(
            (subject) => `<option value="${subject.id}">${subject.name}${subject.code ? ` (${subject.code})` : ''}</option>`
        );
        componentEls.filterSubject.innerHTML = ['<option value="">All subjects</option>', ...options].join('');
    }
}

function collectSelectedSubjectIds() {
    if (!componentEls.subjectsContainer) return [];
    return Array.from(componentEls.subjectsContainer.querySelectorAll('.component-subject-checkbox:checked')).map(
        (checkbox) => checkbox.value
    );
}

async function submitComponent() {
    const name = componentEls.name?.value.trim();
    const weight = componentEls.weight?.value;
    const order = componentEls.order?.value;
    const label = componentEls.label?.value.trim() || null;
    const subjectIds = collectSelectedSubjectIds();

    if (!name || weight === '' || order === '') {
        alert('Please complete all required fields.');
        return;
    }

    if (!subjectIds.length) {
        alert('Please select at least one subject.');
        return;
    }

    const payload = {
        name,
        weight,
        order,
        label,
        subject_ids: subjectIds,
    };

    const isEdit = Boolean(componentState.editingId);
    const url = isEdit
        ? `${backend_url}/api/v1/settings/assessment-components/${componentState.editingId}`
        : `${backend_url}/api/v1/settings/assessment-components`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Unable to save component.');
        alert(data.message || 'Component saved successfully.');
        resetComponentForm();
        refreshComponentTable();
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

function resetComponentForm() {
    componentState.editingId = null;
    if (componentEls.formId) componentEls.formId.value = '';
    if (componentEls.form) componentEls.form.reset();
    if (componentEls.subjectsContainer) {
        componentEls.subjectsContainer.querySelectorAll('.component-subject-checkbox').forEach((checkbox) => {
            checkbox.checked = false;
        });
    }
}

async function refreshComponentTable() {
    if (!componentEls.tableBody) return;
    componentEls.tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

    try {
        const params = new URLSearchParams({
            page: componentState.table.page,
            per_page: componentState.table.perPage,
        });

        if (componentState.table.search) params.append('search', componentState.table.search);
        if (componentState.table.subject_id) params.append('subject_id', componentState.table.subject_id);

        const response = await fetch(`${backend_url}/api/v1/settings/assessment-components?${params.toString()}`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Unable to load assessment components.');
        const payload = await response.json();
        renderComponentTable(payload);
    } catch (error) {
        console.error(error);
        componentEls.tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${error.message}</td></tr>`;
        if (componentEls.summary) componentEls.summary.textContent = '';
        if (componentEls.pagination) componentEls.pagination.innerHTML = '';
    }
}

function renderComponentTable(payload) {
    const data = unpackCollection(payload);
    if (!data.length) {
        componentEls.tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No components found.</td></tr>';
    } else {
        componentEls.tableBody.innerHTML = data
            .map((item) => {
                const subjectsHtml =
                    Array.isArray(item.subjects) && item.subjects.length
                        ? `<div class="d-flex flex-wrap">${item.subjects
                              .map((subject) => {
                                  const label = `${subject.name}${subject.code ? ` (${subject.code})` : ''}`;
                                  return `<span class="badge badge-light text-dark mr-1 mb-1">${label}</span>`;
                              })
                              .join('')}</div>`
                        : '—';
                const updatedAt = formatDateTime(item.updated_at);
                return `<tr>
                    <td>${item.name}</td>
                    <td>${Number(item.weight).toFixed(2)}</td>
                    <td>${item.order}</td>
                    <td>${item.label || '—'}</td>
                    <td>${subjectsHtml}</td>
                    <td>${updatedAt}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary mr-2" data-action="edit" data-id="${item.id}">Edit</button>
                        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}">Delete</button>
                    </td>
                </tr>`;
            })
            .join('');
    }

    componentEls.tableBody.querySelectorAll('button[data-action="edit"]').forEach((button) => {
        button.addEventListener('click', () => handleComponentEdit(button.dataset.id));
    });
    componentEls.tableBody.querySelectorAll('button[data-action="delete"]').forEach((button) => {
        button.addEventListener('click', () => handleComponentDelete(button.dataset.id));
    });

    const from = payload.from ?? 0;
    const to = payload.to ?? 0;
    const total = payload.total ?? 0;
    if (componentEls.summary) {
        componentEls.summary.textContent = total > 0 ? `Showing ${from}-${to} of ${total} components` : '';
    }

    renderComponentPagination(payload);
}

function renderComponentPagination(payload) {
    if (!componentEls.pagination) return;
    const current = payload.current_page ?? 1;
    const last = payload.last_page ?? 1;
    componentState.table.page = current;

    const createItem = (page, label = page, disabled = false, active = false) => {
        const li = document.createElement('li');
        li.className = `page-item${disabled ? ' disabled' : ''}${active ? ' active' : ''}`;
        const a = document.createElement('a');
        a.className = 'page-link';
        a.href = '#';
        a.textContent = label;
        if (!disabled) {
            a.addEventListener('click', (event) => {
                event.preventDefault();
                if (page !== componentState.table.page) {
                    componentState.table.page = page;
                    refreshComponentTable();
                }
            });
        }
        li.appendChild(a);
        return li;
    };

    const createEllipsis = () => {
        const li = document.createElement('li');
        li.className = 'page-item disabled';
        const span = document.createElement('span');
        span.className = 'page-link';
        span.textContent = '…';
        li.appendChild(span);
        return li;
    };

    componentEls.pagination.innerHTML = '';
    componentEls.pagination.appendChild(createItem(current - 1, '«', current <= 1));

    if (last <= 7) {
        for (let page = 1; page <= last; page++) {
            componentEls.pagination.appendChild(createItem(page, page, false, page === current));
        }
    } else {
        componentEls.pagination.appendChild(createItem(1, 1, false, current === 1));
        let start = Math.max(2, current - 2);
        let end = Math.min(last - 1, current + 2);
        if (start > 2) componentEls.pagination.appendChild(createEllipsis());
        for (let page = start; page <= end; page++) {
            componentEls.pagination.appendChild(createItem(page, page, false, page === current));
        }
        if (end < last - 1) componentEls.pagination.appendChild(createEllipsis());
        componentEls.pagination.appendChild(createItem(last, last, false, current === last));
    }

    componentEls.pagination.appendChild(createItem(current + 1, '»', current >= last));
}

async function handleComponentEdit(id) {
    try {
        const response = await fetch(`${backend_url}/api/v1/settings/assessment-components/${id}`, {
            headers: authHeaders(),
        });
        if (!response.ok) throw new Error('Unable to load component.');
        const payload = await response.json();
        const component = payload.data || payload;

        componentState.editingId = component.id;
        if (componentEls.formId) componentEls.formId.value = component.id;

        if (componentEls.name) componentEls.name.value = component.name || '';
        if (componentEls.weight) componentEls.weight.value = component.weight ?? '';
        if (componentEls.order) componentEls.order.value = component.order ?? '';
        if (componentEls.label) componentEls.label.value = component.label ?? '';

        if (componentEls.subjectsContainer) {
            const selectedIds = Array.isArray(component.subjects)
                ? component.subjects.map((subject) => String(subject.id))
                : [];
            componentEls.subjectsContainer.querySelectorAll('.component-subject-checkbox').forEach((checkbox) => {
                checkbox.checked = selectedIds.includes(checkbox.value);
            });
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

async function handleComponentDelete(id) {
    if (!confirm('Are you sure you want to remove this assessment component?')) {
        return;
    }

    try {
        const response = await fetch(`${backend_url}/api/v1/settings/assessment-components/${id}`, {
            method: 'DELETE',
            headers: authHeaders(),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || 'Unable to delete component.');
        alert(data.message || 'Component removed successfully.');
        if (componentState.editingId === id) {
            resetComponentForm();
        }
        refreshComponentTable();
    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}
