document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const patientForm = document.getElementById('patient-form');
    const patientList = document.getElementById('patient-list');
    const patientDetailsContainer = document.getElementById('patient-details-container');
    const searchInput = document.getElementById('search-input');
    const suggestions = document.getElementById("suggestions");
    const searchButton = document.getElementById('search-button');
    const noPatientMessage = document.getElementById('no-patients-message');
    const visitPatientSelect = document.getElementById('visit-patient-id');
    const visitFormContainer = document.getElementById('visit-form-container');
    const visitForm = document.getElementById('visit-form');
    const visitPatientIdHidden = document.getElementById('visit-patient-id-hidden');

    // Check license status periodically
    function checkLicenseStatus() {
        fetch('/license/status')
            .then(response => response.json())
            .then(licenseStatus => {
                // If license has expired during the session, redirect to license page
                if (licenseStatus.status === 'trial_expired' || licenseStatus.status === 'expired') {
                    window.location.href = '/license';
                }
            })
            .catch(error => {
                console.error('Error checking license status:', error);
            });
    }

    // Check license status every 5 minutes
    setInterval(checkLicenseStatus, 5 * 60 * 1000);

    // Handle API errors related to license
    function handleApiResponse(response) {
        if (response.status === 403) {
            // License expired or invalid
            window.location.href = '/license';
            throw new Error('License expired or invalid');
        }
        return response.json();
    }

    //Auto-Complete function
    searchInput.addEventListener("input", async () => {
        const query = searchInput.value.trim();
        if (query.length === 0) {
        suggestions.innerHTML = "";
        return;
        }

        const res = await fetch(`/autocomplete?q=${query}`);
        const data = await res.json();

        suggestions.innerHTML = "";
        data.forEach(item => {
        const li = document.createElement("li");
        li.textContent = item;
        li.addEventListener("click", () => {
            searchInput.value = item;
            suggestions.innerHTML = "";
        });
        suggestions.appendChild(li);
        });
    });

    // Tab Switching
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons and panes
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked button and corresponding pane
            this.classList.add('active');
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
            
            // If patient list tab is selected, load patients
            if (tabId === 'patient-list') {
                loadPatients();
            }
            
            // If add visit tab is selected, load patient options
            if (tabId === 'add-visit') {
                loadPatientOptions();
            }
        });
    });

    // Form Submission
    patientForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Create FormData object
        const formData = new FormData(patientForm);
        
        // Send POST request to add patient
        fetch('/patients', {
            method: 'POST',
            body: formData
        })
        .then(handleApiResponse)
        .then(data => {
            alert('Patient registered successfully! Patient ID: ' + data.id);
            patientForm.reset();
            
            // Switch to patient details tab and show the new patient
            switchToTab('patient-details');
            displayPatientDetails(data);
        })
        .catch(error => {
            console.error('Error:', error);
            if (!error.message.includes('License expired')) {
                alert('An error occurred while registering the patient.');
            }
        });
    });

    // Visit Form Submission
    visitForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const patientId = visitPatientIdHidden.value;
        if (!patientId) {
            alert('Please select a patient first');
            return;
        }
        
        // Create FormData object
        const formData = new FormData(visitForm);
        
        // Send POST request to add visit
        fetch(`/patients/${patientId}/visits`, {
            method: 'POST',
            body: formData
        })
        .then(handleApiResponse)
        .then(data => {
            alert('Visit added successfully!');
            visitForm.reset();
            visitFormContainer.classList.add('hidden');
            visitPatientSelect.value = '';
            
            // Fetch and display updated patient details
            fetchPatientDetails(patientId);
        })
        .catch(error => {
            console.error('Error:', error);
            if (!error.message.includes('License expired')) {
                alert('An error occurred while adding the visit.');
            }
        });
    });

    // Patient Selection for Visit
    visitPatientSelect.addEventListener('change', function() {
        const patientId = this.value;
        
        if (patientId) {
            visitPatientIdHidden.value = patientId;
            visitFormContainer.classList.remove('hidden');
        } else {
            visitFormContainer.classList.add('hidden');
        }
    });

    // Search Functionality
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    function performSearch() {
        const query = searchInput.value.trim();
        
        if (query === '') {
            alert('Please enter a search term');
            return;
        }
        
        fetch(`/patients/search?query=${encodeURIComponent(query)}`)
            .then(handleApiResponse)
            .then(patients => {
                if (patients.length === 0) {
                    alert('No patients found matching your search.');
                    return;
                }
                
                // If only one patient found, show details directly
                if (patients.length === 1) {
                    switchToTab('patient-details');
                    displayPatientDetails(patients[0]);
                } else {
                    // If multiple patients found, show the list
                    switchToTab('patient-list');
                    renderPatientList(patients);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                if (!error.message.includes('License expired')) {
                    alert('An error occurred while searching for patients.');
                }
            });
    }

    // Load All Patients
    function loadPatients() {
        fetch('/patients')
            .then(handleApiResponse)
            .then(patients => {
                renderPatientList(patients);
            })
            .catch(error => {
                console.error('Error:', error);
                if (!error.message.includes('License expired')) {
                    alert('An error occurred while loading patients.');
                }
            });
    }

    // Load Patient Options for Visit Form
    function loadPatientOptions() {
        fetch('/patients')
            .then(handleApiResponse)
            .then(patients => {
                // Clear existing options except the default one
                while (visitPatientSelect.options.length > 1) {
                    visitPatientSelect.remove(1);
                }
                
                // Add patient options
                patients.forEach(patient => {
                    const option = document.createElement('option');
                    option.value = patient.id;
                    option.textContent = `${patient.name} (${patient.id})`;
                    visitPatientSelect.appendChild(option);
                });
                
                // Reset the form
                visitPatientSelect.value = '';
                visitFormContainer.classList.add('hidden');
            })
            .catch(error => {
                console.error('Error:', error);
                if (!error.message.includes('License expired')) {
                    alert('An error occurred while loading patients.');
                }
            });
    }

    // Render Patient List
    function renderPatientList(patients) {
        patientList.innerHTML = '';
        
        if (patients.length === 0) {
            noPatientMessage.classList.remove('hidden');
            return;
        }
        
        noPatientMessage.classList.add('hidden');
        
        patients.forEach(patient => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${patient.id}</td>
                <td>${patient.name}</td>
                <td>${patient.doctor}</td>
                <td>${patient.created_at}</td>
                <td>
                    <button class="action-btn view" data-id="${patient.id}" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn add-visit" data-id="${patient.id}" title="Add Visit">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                </td>
            `;
            
            patientList.appendChild(row);
            
            // Add event listener to view button
            row.querySelector('.view').addEventListener('click', function() {
                const patientId = this.getAttribute('data-id');
                fetchPatientDetails(patientId);
            });
            
            // Add event listener to add visit button
            row.querySelector('.add-visit').addEventListener('click', function() {
                const patientId = this.getAttribute('data-id');
                switchToTab('add-visit');
                // Set the selected patient in the dropdown
                visitPatientSelect.value = patientId;
                // Set the hidden input value
                visitPatientIdHidden.value = patientId;
                // Show the form container directly
                visitFormContainer.classList.remove('hidden');
                // Trigger a change event on the select to ensure any other listeners are notified
                const event = new Event('change');
                visitPatientSelect.dispatchEvent(event);
            });
        });
    }

    // Fetch Patient Details
    function fetchPatientDetails(patientId) {
        fetch(`/patients/${patientId}`)
            .then(handleApiResponse)
            .then(patient => {
                switchToTab('patient-details');
                displayPatientDetails(patient);
            })
            .catch(error => {
                console.error('Error:', error);
                if (!error.message.includes('License expired')) {
                    alert('An error occurred while fetching patient details.');
                }
            });
    }

    // Display Patient Details
    function displayPatientDetails(patient) {
        let visitsHtml = '';
        
        // Check if patient has visits
        if (patient.visits && patient.visits.length > 0) {
            visitsHtml = `
                <div class="visit-history">
                    <h3><i class="fas fa-history"></i> Visit History</h3>
                    ${patient.visits.map((visit, index) => `
                        <div class="visit-card">
                            <div class="visit-header">
                                <span>Visit #${index + 1}</span>
                                <span>${visit.visit_date}</span>
                            </div>
                            <div class="visit-content">
                                <div class="visit-section">
                                    <h5>Doctor:</h5>
                                    <p>${visit.doctor || 'Not specified'}</p>
                                </div>
                                <div class="visit-section">
                                    <h5>Medical Reports:</h5>
                                    <p>${visit.medical_reports || 'No medical reports available'}</p>
                                </div>
                                <div class="visit-section">
                                    <h5>Prescription:</h5>
                                    <p>${visit.prescription || 'No prescription available'}</p>
                                </div>
                                <div class="visit-section">
                                    <h5>Advice:</h5>
                                    <p>${visit.advice || 'No recommendations available'}</p>
                                </div>
                                <div class="visit-section">
                                    <h5>Tests:</h5>
                                    <p>${visit.tests || 'No tests recommended'}</p>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        patientDetailsContainer.innerHTML = `
            <div class="patient-detail-card">
                <div class="patient-detail-header">
                    <h3>${patient.name}</h3>
                    <span class="patient-id">ID: ${patient.id}</span>
                </div>

                <div class="patient-detail-section">
                    <h4><i class="fas fa-phone"></i> Phone</h4>
                    <p>${patient.phone || 'Not specified'}</p>
                </div>                

                <div class="patient-detail-section">
                    <h4><i class="fas fa-user-md"></i> Doctor</h4>
                    <p>${patient.doctor || 'Not specified'}</p>
                </div>
                
                <div class="patient-detail-section">
                    <h4><i class="fas fa-file-medical"></i> Medical Reports</h4>
                    <p>${patient.medical_reports || 'No medical reports available'}</p>
                </div>
                
                <div class="patient-detail-section">
                    <h4><i class="fas fa-prescription"></i> Prescription</h4>
                    <p>${patient.prescription || 'No prescription available'}</p>
                </div>
                
                <div class="patient-detail-section">
                    <h4><i class="fas fa-check-circle"></i> Advice</h4>
                    <p>${patient.advice || 'No recommendations available'}</p>
                </div>
                
                <div class="patient-detail-section">
                    <h4><i class="fas fa-vial"></i>Tests</h4>
                    <p>${patient.tests || 'No tests recommended'}</p>
                </div>
                
                <div class="patient-detail-section">
                    <h4><i class="fas fa-calendar"></i> Created Date</h4>
                    <p>${patient.created_at}</p>
                </div>
                
                <div class="patient-detail-actions">
                    <button class="btn-primary add-visit-btn" data-id="${patient.id}">
                        <i class="fas fa-plus-circle"></i> Add Visit
                    </button>
                </div>
            </div>
            
            ${visitsHtml}
        `;
        
        // Add event listener to add visit button
        const addVisitBtn = patientDetailsContainer.querySelector('.add-visit-btn');
        if (addVisitBtn) {
            addVisitBtn.addEventListener('click', function() {
                const patientId = this.getAttribute('data-id');
                switchToTab('add-visit');
                visitPatientSelect.value = patientId;
                visitPatientIdHidden.value = patientId;
                visitFormContainer.classList.remove('hidden');
            });
        }
    }

    // Helper function to switch tabs
    function switchToTab(tabId) {
        tabButtons.forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.click();
            }
        });
    }

    // Initial load
    loadPatients();
}); 