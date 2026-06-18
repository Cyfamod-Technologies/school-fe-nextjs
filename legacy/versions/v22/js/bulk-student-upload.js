/* global backend_url, resolveBackendUrl, getCookie */
(function () {
    const token = getCookie('token');
    if (!token) {
        window.location.href = '../v10/login.html';
        return;
    }

    const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
    };

    const state = {
        file: null,
        batchId: null,
        previewRows: [],
        summary: null,
        errors: [],
        errorCsv: null,
    };

    const elements = {
        downloadButton: document.getElementById('download-template'),
        dropzone: document.getElementById('upload-dropzone'),
        chooseFile: document.getElementById('choose-file'),
        fileInput: document.getElementById('file-input'),
        selectedFile: document.getElementById('selected-file'),
        uploadButton: document.getElementById('upload-button'),
        resetButton: document.getElementById('reset-button'),
        feedback: document.getElementById('bulk-upload-feedback'),
        previewCard: document.getElementById('bulk-preview-card'),
        errorCard: document.getElementById('bulk-error-card'),
        previewTableBody: document.getElementById('preview-table-body'),
        summaryList: document.getElementById('upload-summary'),
        batchExpiry: document.getElementById('batch-expiry'),
        confirmButton: document.getElementById('confirm-upload'),
        errorTableBody: document.getElementById('error-table-body'),
        downloadErrorLog: document.getElementById('download-error-log'),
    };

    function init() {
        bindEvents();
        resetState();
    }

    function bindEvents() {
        if (elements.downloadButton) {
            elements.downloadButton.addEventListener('click', handleDownloadTemplate);
        }

        if (elements.chooseFile) {
            elements.chooseFile.addEventListener('click', () => elements.fileInput?.click());
        }

        if (elements.fileInput) {
            elements.fileInput.addEventListener('change', (event) => {
                const file = event.target.files?.[0];
                if (file) {
                    handleFileSelected(file);
                }
            });
        }

        if (elements.dropzone) {
            ['dragenter', 'dragover'].forEach((eventName) => {
                elements.dropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    elements.dropzone.classList.add('dragover');
                });
            });

            ['dragleave', 'drop'].forEach((eventName) => {
                elements.dropzone.addEventListener(eventName, (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    elements.dropzone.classList.remove('dragover');
                });
            });

            elements.dropzone.addEventListener('drop', (event) => {
                const file = event.dataTransfer?.files?.[0];
                if (file) {
                    handleFileSelected(file);
                }
            });
        }

        if (elements.uploadButton) {
            elements.uploadButton.addEventListener('click', handleUploadPreview);
        }

        if (elements.resetButton) {
            elements.resetButton.addEventListener('click', resetState);
        }

        if (elements.confirmButton) {
            elements.confirmButton.addEventListener('click', handleConfirm);
        }

        if (elements.downloadErrorLog) {
            elements.downloadErrorLog.addEventListener('click', downloadErrorLog);
        }
    }

    function handleDownloadTemplate() {
        toggleLoading(elements.downloadButton, true, 'Downloading...');

        fetch(resolveBackendUrl('/api/v1/students/bulk/template'), {
            method: 'GET',
            headers: authHeaders,
        })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(`Failed to download template (${response.status})`);
                }
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url;
                anchor.download = `student-bulk-template-${new Date().toISOString().slice(0, 10)}.csv`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
                URL.revokeObjectURL(url);
            })
            .catch((error) => {
                setFeedback('danger', error.message);
            })
            .finally(() => {
                toggleLoading(elements.downloadButton, false, 'Download Template');
            });
    }

    function handleFileSelected(file) {
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.csv') && !fileName.endsWith('.xlsx')) {
            setFeedback('warning', 'Only CSV and XLSX files are supported. Please choose a .csv or .xlsx file.');
            return;
        }

        state.file = file;
        elements.selectedFile.textContent = `Selected file: ${file.name} (${formatBytes(file.size)})`;
        setFeedback('info', 'File selected. Click "Upload & Preview" to validate.');
    }

    function handleUploadPreview() {
        if (!state.file) {
            setFeedback('warning', 'Please choose a CSV or XLSX file before uploading.');
            return;
        }

        const formData = new FormData();
        formData.append('file', state.file);

        toggleLoading(elements.uploadButton, true, 'Uploading...');
        setFeedback('info', 'Validating file. Please wait...');
        hideElement(elements.errorCard);
        hideElement(elements.previewCard);

        fetch(resolveBackendUrl('/api/v1/students/bulk/preview'), {
            method: 'POST',
            headers: authHeaders,
            body: formData,
        })
            .then(async (response) => {
                const payload = await response.json();

                if (!response.ok) {
                    const errors = payload?.errors ?? [];
                    const errorCsv = payload?.error_csv ?? null;
                    displayErrors(errors, errorCsv);
                    throw new Error(payload?.message ?? 'Validation failed.');
                }

                state.batchId = payload.batch_id;
                state.previewRows = payload.preview_rows ?? [];
                state.summary = payload.summary ?? null;
                state.errors = [];
                state.errorCsv = null;

                if (payload.expires_at) {
                    elements.batchExpiry.textContent = `Batch expires: ${new Date(payload.expires_at).toLocaleString()}`;
                } else {
                    elements.batchExpiry.textContent = '';
                }

                updatePreviewTable();
                updateSummary();
                setFeedback('success', 'Validation successful. Review the preview and confirm to import all students.');
                showElement(elements.previewCard);
            })
            .catch((error) => {
                setFeedback('danger', error.message);
            })
            .finally(() => {
                toggleLoading(elements.uploadButton, false, 'Upload & Preview');
            });
    }

    function handleConfirm() {
        if (!state.batchId) {
            setFeedback('warning', 'Upload a file and preview the data before confirming.');
            return;
        }

        toggleLoading(elements.confirmButton, true, 'Processing...');
        setFeedback('info', 'Creating students. This may take a moment...');

        fetch(resolveBackendUrl(`/api/v1/students/bulk/${state.batchId}/commit`), {
            method: 'POST',
            headers: {
                ...authHeaders,
                'Content-Type': 'application/json',
            },
        })
            .then(async (response) => {
                const payload = await response.json();
                if (!response.ok) {
                    throw new Error(payload?.message ?? 'Bulk upload failed. Please retry.');
                }

                setFeedback('success', `Upload complete! ${payload?.summary?.total_processed ?? 0} students were created.`);
                resetState();
            })
            .catch((error) => {
                setFeedback('danger', error.message);
            })
            .finally(() => {
                toggleLoading(elements.confirmButton, false, 'Confirm Upload');
            });
    }

    function displayErrors(errors, errorCsvBase64) {
        state.errors = Array.isArray(errors) ? errors : [];
        state.errorCsv = errorCsvBase64;

        if (state.errors.length === 0) {
            state.errors.push({
                row: '-',
                column: '-',
                message: 'No specific errors were provided by the server.',
            });
        }

        elements.errorTableBody.innerHTML = '';
        state.errors.forEach((error) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${error.row ?? '-'}</td>
                <td>${escapeHtml(error.column ?? '-')}</td>
                <td>${escapeHtml(error.message ?? '-')}</td>
            `;
            elements.errorTableBody.appendChild(row);
        });

        showElement(elements.errorCard);
        hideElement(elements.previewCard);
    }

    function downloadErrorLog() {
        if (!state.errorCsv) {
            setFeedback('info', 'No error log available. Upload a file to generate one.');
            return;
        }

        try {
            const byteCharacters = atob(state.errorCsv);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i += 1) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `bulk-upload-errors-${new Date().toISOString().slice(0, 19)}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        } catch (error) {
            setFeedback('danger', 'Unable to download the error log. Please try again.');
        }
    }

    function updatePreviewTable() {
        elements.previewTableBody.innerHTML = '';

        if (!state.previewRows || state.previewRows.length === 0) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = '<td colspan="6">All rows validated successfully. No preview rows to display.</td>';
            elements.previewTableBody.appendChild(emptyRow);
            return;
        }

        state.previewRows.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHtml(row.name ?? '')}</td>
                <td>${escapeHtml(row.admission_no ?? '')}</td>
                <td>${escapeHtml(row.session ?? '')}</td>
                <td>${escapeHtml([row.class, row.class_arm, row.class_section].filter(Boolean).join(' / '))}</td>
                <td>${escapeHtml(row.parent_email ?? '')}</td>
            `;
            elements.previewTableBody.appendChild(tr);
        });
    }

    function updateSummary() {
        elements.summaryList.innerHTML = '';
        if (!state.summary) {
            return;
        }

        const summaryItems = [
            ['Total Rows', state.summary.total_rows ?? 0],
            ['Unique Sessions', state.summary.sessions ?? 0],
            ['Unique Classes', state.summary.classes ?? 0],
        ];

        summaryItems.forEach(([label, value]) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${label}</span><span>${value}</span>`;
            elements.summaryList.appendChild(li);
        });
    }

    function resetState() {
        state.file = null;
        state.batchId = null;
        state.previewRows = [];
        state.summary = null;
        state.errors = [];
        state.errorCsv = null;

        if (elements.fileInput) {
            elements.fileInput.value = '';
        }

        if (elements.selectedFile) {
            elements.selectedFile.textContent = '';
        }

        hideElement(elements.previewCard);
        hideElement(elements.errorCard);
        elements.batchExpiry.textContent = '';
        elements.previewTableBody.innerHTML = '<tr><td colspan="6">Upload a file to see a preview of the first 10 rows.</td></tr>';
        elements.summaryList.innerHTML = '';
        setFeedback('info', 'Download the template to get started. When your CSV is ready, upload it to validate.');
    }

    function setFeedback(variant, message) {
        if (!elements.feedback) {
            return;
        }

        elements.feedback.className = `alert alert-${variant}`;
        elements.feedback.textContent = message;
        elements.feedback.classList.remove('d-none');
    }

    function hideElement(element) {
        if (element) {
            element.style.display = 'none';
        }
    }

    function showElement(element) {
        if (element) {
            element.style.display = '';
        }
    }

    function toggleLoading(button, isLoading, loadingText) {
        if (!button) {
            return;
        }

        if (isLoading) {
            button.disabled = true;
            button.dataset.originalText = button.dataset.originalText || button.innerHTML;
            button.innerHTML = `<span class="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true"></span>${loadingText}`;
        } else {
            button.disabled = false;
            if (button.dataset.originalText) {
                button.innerHTML = button.dataset.originalText;
                delete button.dataset.originalText;
            }
        }
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    init();
})();
