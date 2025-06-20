from flask import Flask, render_template, request, redirect, url_for, jsonify
import json
import os
import uuid
from datetime import datetime
import license_manager

app = Flask(__name__)

# Ensure data directory exists
if not os.path.exists('data'):
    os.makedirs('data')

# Path to the JSON database file
PATIENTS_DB = os.path.join('data', 'patients.json')

# Initialize the database if it doesn't exist
if not os.path.exists(PATIENTS_DB):
    with open(PATIENTS_DB, 'w') as f:
        json.dump([], f)

def load_patients():
    """Load patients from the JSON file."""
    try:
        with open(PATIENTS_DB, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def save_patients(patients):
    """Save patients to the JSON file."""
    with open(PATIENTS_DB, 'w') as f:
        json.dump(patients, f, indent=4)

def count_entry():
    try:
        with open("data/patients.json", "r") as file:
            data = json.load(file)
        return len(data)
    except (FileNotFoundError, json.JSONDecodeError):
        return 0

def generate_patient_id():
    """
    Generate a unique patient ID in the format:
    PT-0001:01-01-2025:1CFF
    """
    count = count_entry()
    count_part = f"{count:04d}"
    date_part = datetime.now().strftime("%d-%m-%Y")
    random_part = uuid.uuid4().hex[:4].upper()
    return f"PT-{count_part}:{date_part}:{random_part}"

@app.route('/')
def index():
    """Render the main page."""
    # Check license status
    license_status = license_manager.get_license_status()
    
    # If trial has expired or license has expired, redirect to license page
    if license_status['status'] in ['trial_expired', 'expired']:
        return redirect(url_for('license_page'))
    
    return render_template('index.html', license_status=license_status)

@app.route('/license')
def license_page():
    """Render the license page."""
    license_status = license_manager.get_license_status()
    return render_template('license.html', license_status=license_status)

@app.route('/license/activate', methods=['POST'])
def activate_license():
    """API endpoint to activate a license."""
    license_key = request.form.get('license_key', '')
    result = license_manager.activate_license(license_key)
    
    if result['success']:
        return redirect(url_for('index'))
    
    return redirect(url_for('license_page', error=result['message']))

@app.route('/license/status', methods=['GET'])
def license_status():
    """API endpoint to get the current license status."""
    return jsonify(license_manager.get_license_status())

@app.route('/patients', methods=['GET'])
def get_patients():
    """API endpoint to get all patients."""
    # Check license status first
    license_status = license_manager.get_license_status()
    if license_status['status'] in ['trial_expired', 'expired']:
        return jsonify({'error': 'License expired or invalid'}), 403
    
    patients = load_patients()
    return jsonify(patients)

@app.route('/patients/search', methods=['GET'])
def search_patients():
    """API endpoint to search for patients."""
    # Check license status first
    license_status = license_manager.get_license_status()
    if license_status['status'] in ['trial_expired', 'expired']:
        return jsonify({'error': 'License expired or invalid'}), 403
    
    query = request.args.get('query', '').lower()
    patients = load_patients()
    
    if not query:
        return jsonify([])
    
    results = []
    for patient in patients:
        # Search in patient ID, name, and other fields
        if (query in patient.get('id', '').lower() or 
            query in patient.get('name', '').lower() or
            query in patient.get('phone', '').lower()):
            results.append(patient)
    
    return jsonify(results)

@app.route('/autocomplete')
def autocomplete():
    query = request.args.get("q", "").lower()
    data = load_patients()
    results = set()

    for entry in data:
        for field in [entry["name"], entry["phone"]]:
            if field.lower().startswith(query):
                results.add(field)
    
    for entry in data:
        for field in [entry["name"], entry["phone"]]:
            if query in field.lower() and not field.lower().startswith(query):
                results.add(field)
    
    return jsonify(sorted(results))

@app.route('/patients', methods=['POST'])
def add_patient():
    """API endpoint to add a new patient."""
    # Check license status first
    license_status = license_manager.get_license_status()
    if license_status['status'] in ['trial_expired', 'expired']:
        return jsonify({'error': 'License expired or invalid'}), 403
    
    patients = load_patients()
    
    # Get form data
    new_patient = {
        'id': generate_patient_id(),
        'name': request.form.get('name', ''),
        'phone': request.form.get('phone', ''),
        'doctor': request.form.get('doctor', ''),
        'medical_reports': request.form.get('medical_reports', ''),
        'prescription': request.form.get('prescription', ''),
        'advice': request.form.get('advice', ''),
        'tests': request.form.get('tests', ''),
        'created_at': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        'visits': []  # Initialize visits array for new patients
    }
    
    patients.append(new_patient)
    save_patients(patients)
    
    return jsonify(new_patient)

@app.route('/patients/<patient_id>/visits', methods=['POST'])
def add_visit(patient_id):
    """API endpoint to add a new visit to an existing patient."""
    # Check license status first
    license_status = license_manager.get_license_status()
    if license_status['status'] in ['trial_expired', 'expired']:
        return jsonify({'error': 'License expired or invalid'}), 403
    
    patients = load_patients()
    
    # Find the patient
    patient_found = False
    for patient in patients:
        if patient.get('id') == patient_id:
            patient_found = True
            
            # Create new visit record
            new_visit = {
                'visit_date': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                'doctor': request.form.get('doctor', ''),
                'medical_reports': request.form.get('medical_reports', ''),
                'prescription': request.form.get('prescription', ''),
                'advice': request.form.get('recommended_consumption', ''),
                'tests': request.form.get('tests', '')
            }
            
            # Initialize visits array if it doesn't exist
            if 'visits' not in patient:
                patient['visits'] = []
                
            # Add the visit to the patient's record
            patient['visits'].append(new_visit)
            save_patients(patients)
            
            return jsonify(new_visit)
    
    if not patient_found:
        return jsonify({'error': 'Patient not found'}), 404

@app.route('/patients/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    """API endpoint to get a specific patient by ID."""
    # Check license status first
    license_status = license_manager.get_license_status()
    if license_status['status'] in ['trial_expired', 'expired']:
        return jsonify({'error': 'License expired or invalid'}), 403
    
    patients = load_patients()
    
    for patient in patients:
        if patient.get('id') == patient_id:
            return jsonify(patient)
    
    return jsonify({'error': 'Patient not found'}), 404

if __name__ == '__main__':
    app.run(debug=True) 