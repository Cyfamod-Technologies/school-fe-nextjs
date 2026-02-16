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
    const nameEQ = name + "=";
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let c = cookies[i];
        while (c.charAt(0) === ' ') c = c.substring(1);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function getHeaders() {
    const token = getCookie('token');
    return {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

const state = {
    page: 1,
    perPage: 10,
    sortBy: 'last_name',
    sortDirection: 'asc',
    search: '',
    filters: {
        session: '',
        class: '',
        classArm: '',
        classSection: ''
    }
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    bindEvents();
    loadInitialFilters();
    fetchStudents();
});

function cacheElements() {
    elements.tableBody = document.getElementById('student-table-body');
    elements.summary = document.getElementById('students-summary');
    elements.pagination = document.getElementById('students-pagination');

    elements.searchInput = document.getElementById('student-search');
    elements.sessionSelect = document.getElementById('filter-session');
    elements.classSelect = document.getElementById('filter-class');
    elements.classArmSelect = document.getElementById('filter-class-arm');
    elements.classSectionSelect = document.getElementById('filter-class-section');
    elements.searchButton = document.getElementById('search-button');
    elements.resetButton = document.getElementById('reset-filters');

    elements.sortableHeaders = document.querySelectorAll('th.sortable');
}

function bindEvents() {
    if (elements.searchButton) {
        elements.searchButton.addEventListener('click', () => {
            state.search = elements.searchInput.value.trim();
            state.page = 1;
            fetchStudents();
        });
    }

    if (elements.resetButton) {
        elements.resetButton.addEventListener('click', () => {
            elements.searchInput.value = '';
            state.search = '';
            state.filters = { session: '', class: '', classArm: '', classSection: '' };
            state.page = 1;
            resetSelect(elements.sessionSelect, 'All Sessions');
            resetSelect(elements.classSelect, 'All Classes');
            resetSelect(elements.classArmSelect, 'None', true);
            resetSelect(elements.classSectionSelect, 'All Sections', true);
            fetchStudents();
        });
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                state.search = elements.searchInput.value.trim();
                state.page = 1;
                fetchStudents();
            }
        });
    }

    if (elements.sessionSelect) {
        elements.sessionSelect.addEventListener('change', () => {
            state.filters.session = elements.sessionSelect.value;
            state.page = 1;
            fetchStudents();
        });
    }

    if (elements.classSelect) {
        elements.classSelect.addEventListener('change', async () => {
            state.filters.class = elements.classSelect.value;
            state.filters.classArm = '';
            state.filters.classSection = '';
            state.page = 1;

            resetSelect(elements.classArmSelect, 'None', !state.filters.class);
            resetSelect(elements.classSectionSelect, 'All Sections', true);

            if (state.filters.class) {
                await loadClassArmsIntoFilter(state.filters.class);
            }

            fetchStudents();
        });
    }

    if (elements.classArmSelect) {
        elements.classArmSelect.addEventListener('change', async () => {
            state.filters.classArm = elements.classArmSelect.value;
            state.filters.classSection = '';
            state.page = 1;

            resetSelect(elements.classSectionSelect, 'All Sections', !state.filters.classArm);

            if (state.filters.class && state.filters.classArm) {
                await loadClassSectionsIntoFilter(state.filters.class, state.filters.classArm);
            }

            fetchStudents();
        });
    }

    if (elements.classSectionSelect) {
        elements.classSectionSelect.addEventListener('change', () => {
            state.filters.classSection = elements.classSectionSelect.value;
            state.page = 1;
            fetchStudents();
        });
    }

    if (elements.sortableHeaders) {
        elements.sortableHeaders.forEach((header) => {
            header.addEventListener('click', () => handleSort(header.dataset.sort));
        });
    }
}

function handleSort(column) {
    if (!column) return;

    if (state.sortBy === column) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortBy = column;
        state.sortDirection = 'asc';
    }

    highlightActiveSort();
    fetchStudents();
}

function highlightActiveSort() {
    elements.sortableHeaders.forEach((header) => {
        header.classList.remove('sorting-asc', 'sorting-desc');
        if (header.dataset.sort === state.sortBy) {
            header.classList.add(state.sortDirection === 'asc' ? 'sorting-asc' : 'sorting-desc');
        }
    });
}

async function loadInitialFilters() {
    await Promise.all([
        loadSessionsIntoFilter(),
        loadClassesIntoFilter()
    ]);
}

async function loadSessionsIntoFilter() {
    if (!elements.sessionSelect) return;
    try {
        const response = await fetch(`${backend_url}/api/v1/sessions`, { headers: getHeaders() });
        const data = await response.json();
        const sessions = Array.isArray(data) ? data : (data.data || []);

        resetSelect(elements.sessionSelect, 'All Sessions');
        sessions.forEach((session) => {
            const option = new Option(session.name, session.id);
            elements.sessionSelect.add(option);
        });
    } catch (error) {
        console.error('Failed to load sessions', error);
    }
}

async function loadClassesIntoFilter() {
    if (!elements.classSelect) return;
    try {
        const response = await fetch(`${backend_url}/api/v1/classes`, { headers: getHeaders() });
        const data = await response.json();
        const classes = Array.isArray(data) ? data : (data.data || []);

        resetSelect(elements.classSelect, 'All Classes');
        classes.forEach((_class) => {
            const option = new Option(_class.name, _class.id);
            elements.classSelect.add(option);
        });
    } catch (error) {
        console.error('Failed to load classes', error);
    }
}

async function loadClassArmsIntoFilter(classId) {
    if (!elements.classArmSelect || !classId) return;

    try {
        elements.classArmSelect.disabled = true;
        const response = await fetch(`${backend_url}/api/v1/classes/${classId}/arms`, { headers: getHeaders() });
        const data = await response.json();
        const arms = Array.isArray(data) ? data : (data.data || []);

        resetSelect(elements.classArmSelect, 'None');
        arms.forEach((arm) => {
            const option = new Option(arm.name, arm.id);
            elements.classArmSelect.add(option);
        });

        elements.classArmSelect.disabled = false;
    } catch (error) {
        console.error('Failed to load class arms', error);
        resetSelect(elements.classArmSelect, 'None', true);
    }
}

async function loadClassSectionsIntoFilter(classId, armId) {
    if (!elements.classSectionSelect || !classId || !armId) return;

    try {
        elements.classSectionSelect.disabled = true;
        const response = await fetch(`${backend_url}/api/v1/classes/${classId}/arms/${armId}/sections`, { headers: getHeaders() });
        const data = await response.json();
        const sections = Array.isArray(data) ? data : (data.data || []);

        resetSelect(elements.classSectionSelect, 'All Sections');
        sections.forEach((section) => {
            const option = new Option(section.name, section.id);
            elements.classSectionSelect.add(option);
        });

        elements.classSectionSelect.disabled = false;
    } catch (error) {
        console.error('Failed to load class sections', error);
        resetSelect(elements.classSectionSelect, 'All Sections', true);
    }
}

function resetSelect(select, placeholder, disabled = false) {
    if (!select) return;
    select.innerHTML = '';
    select.add(new Option(placeholder, ''));
    select.disabled = disabled;
}

async function fetchStudents() {
    try {
        if (elements.tableBody) {
            elements.tableBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';
        }

        const params = new URLSearchParams();
        params.append('page', state.page);
        params.append('per_page', state.perPage);
        params.append('sortBy', state.sortBy);
        params.append('sortDirection', state.sortDirection);

        if (state.search) {
            params.append('search', state.search);
        }

        if (state.filters.session) {
            params.append('current_session_id', state.filters.session);
        }

        if (state.filters.class) {
            params.append('school_class_id', state.filters.class);
        }

        if (state.filters.classArm) {
            params.append('class_arm_id', state.filters.classArm);
        }

        if (state.filters.classSection) {
            params.append('class_section_id', state.filters.classSection);
        }

        const response = await fetch(`${backend_url}/api/v1/students?${params.toString()}`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to load students');
        }

        const payload = await response.json();
        renderStudents(payload);
    } catch (error) {
        console.error('Error fetching students:', error);
        if (elements.tableBody) {
            elements.tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">${error.message || 'Failed to load students'}</td></tr>`;
        }
        if (elements.summary) {
            elements.summary.textContent = '';
        }
        if (elements.pagination) {
            elements.pagination.innerHTML = '';
        }
    }
}

function renderStudents(payload) {
    const students = Array.isArray(payload.data) ? payload.data : [];

    if (!elements.tableBody) return;

    if (students.length === 0) {
        elements.tableBody.innerHTML = '<tr><td colspan="7" class="text-center">No students found.</td></tr>';
    } else {
        const rows = students.map((student) => {
            const admissionNo = student.admission_no || 'N/A';
            const fullName = [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(' ');
            const className = student.school_class ? student.school_class.name : 'N/A';
            const armName = student.class_arm ? ` - ${student.class_arm.name}` : '';
            const parentName = student.parent ? `${student.parent.first_name || ''} ${student.parent.last_name || ''}`.trim() : 'N/A';
            const sessionName = student.session ? student.session.name : 'N/A';
            const photoUrl = student.photo_url ? resolveUrl(student.photo_url) : '../assets/img/figure/student.png';

            return `<tr>
                <td>${admissionNo}</td>
                <td><img src="${photoUrl}" alt="${fullName}" class="img-fluid" style="width:40px;height:40px;border-radius:50%;object-fit:cover;"></td>
                <td>${fullName || 'N/A'}</td>
                <td>${className}${armName}</td>
                <td>${parentName || 'N/A'}</td>
                <td>${sessionName}</td>
                <td>
                    <a class="btn btn-sm btn-outline-primary" href="student-details.html?id=${student.id}">View</a>
                </td>
            </tr>`;
        }).join('');

        elements.tableBody.innerHTML = rows;
    }

    renderSummary(payload);
    renderPagination(payload);
}

function renderSummary(payload) {
    if (!elements.summary) return;
    const from = payload.from ?? 0;
    const to = payload.to ?? 0;
    const total = payload.total ?? 0;
    elements.summary.textContent = total > 0
        ? `Showing ${from}-${to} of ${total} students`
        : '';
}

function renderPagination(payload) {
    if (!elements.pagination) return;

    const currentPage = payload.current_page ?? 1;
    const lastPage = payload.last_page ?? 1;

    state.page = currentPage;

    const createPageItem = (page, label = page, disabled = false, active = false) => {
        const li = document.createElement('li');
        li.className = 'page-item' + (disabled ? ' disabled' : '') + (active ? ' active' : '');
        const link = document.createElement('a');
        link.className = 'page-link';
        link.href = '#';
        link.textContent = label;
        link.addEventListener('click', (event) => {
            event.preventDefault();
            if (disabled || active || page === state.page) return;
            state.page = page;
            fetchStudents();
        });
        li.appendChild(link);
        return li;
    };

    elements.pagination.innerHTML = '';

    elements.pagination.appendChild(createPageItem(currentPage - 1, '«', currentPage <= 1));

    const pageRange = buildPageRange(currentPage, lastPage);
    pageRange.forEach((page) => {
        if (page === '…') {
            elements.pagination.appendChild(createPageItem(currentPage, '…', true, false));
        } else {
            elements.pagination.appendChild(createPageItem(page, page, false, page === currentPage));
        }
    });

    elements.pagination.appendChild(createPageItem(currentPage + 1, '»', currentPage >= lastPage));
}

function buildPageRange(current, last) {
    const delta = 2;
    const range = [];
    const start = Math.max(1, current - delta);
    const end = Math.min(last, current + delta);

    for (let page = start; page <= end; page++) {
        range.push(page);
    }

    if (start > 1) {
        range.unshift(1);
        if (start > 2) {
            range.splice(1, 0, '…');
        }
    }

    if (end < last) {
        if (end < last - 1) {
            range.push('…');
        }
        range.push(last);
    }

    return range.filter((value, index, array) => {
        if (value === '…') {
            return array[index - 1] !== '…' && array[index + 1] !== '…';
        }
        return true;
    });
}
