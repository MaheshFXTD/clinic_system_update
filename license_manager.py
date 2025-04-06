import os
import json
import time
import uuid
import hashlib
import datetime
from cryptography.fernet import Fernet

# Path to the license file
LICENSE_FILE = os.path.join('data', 'license.json')
LICENSE_KEYS_FILE = os.path.join('data', 'valid_keys.json')
TRIAL_PERIOD_DAYS = 7

# Generate a secret key for encryption/decryption
# In a real application, this would be stored securely
SECRET_KEY = b'pRmgMa8T0INjEAfksaq2aafzoZXEuwKI7wDe4c1F8AY='

def generate_machine_id():
    """Generate a unique machine ID based on hardware information."""
    # In a real application, you would use platform-specific methods to get hardware info
    # For this example, we'll use a simple approach
    try:
        import platform
        machine_info = platform.node() + platform.machine() + platform.processor()
        return hashlib.md5(machine_info.encode()).hexdigest()
    except:
        # Fallback to a random ID if we can't get system info
        return str(uuid.uuid4())

def encrypt_data(data):
    """Encrypt data using Fernet symmetric encryption."""
    cipher = Fernet(SECRET_KEY)
    return cipher.encrypt(json.dumps(data).encode()).decode()

def decrypt_data(encrypted_data):
    """Decrypt data using Fernet symmetric encryption."""
    try:
        cipher = Fernet(SECRET_KEY)
        return json.loads(cipher.decrypt(encrypted_data.encode()).decode())
    except:
        return None

def initialize_license_system():
    """Initialize the license system by creating necessary files."""
    # Ensure data directory exists
    if not os.path.exists('data'):
        os.makedirs('data')
    
    # Create license file if it doesn't exist
    if not os.path.exists(LICENSE_FILE):
        license_data = {
            'machine_id': generate_machine_id(),
            'installation_date': datetime.datetime.now().timestamp(),
            'is_activated': False,
            'license_key': '',
            'expiration_date': None
        }
        
        with open(LICENSE_FILE, 'w') as f:
            json.dump({'data': encrypt_data(license_data)}, f)
    
    # Create valid keys file if it doesn't exist
    if not os.path.exists(LICENSE_KEYS_FILE):
        # Generate 100 valid license keys
        valid_keys = []
        for _ in range(100):
            key = str(uuid.uuid4()).replace('-', '').upper()
            # Format the key in groups of 5 characters
            formatted_key = '-'.join([key[i:i+5] for i in range(0, len(key), 5)])
            valid_keys.append(formatted_key)
        
        with open(LICENSE_KEYS_FILE, 'w') as f:
            json.dump({'keys': encrypt_data(valid_keys)}, f)

def get_license_status():
    """Get the current license status."""
    try:
        with open(LICENSE_FILE, 'r') as f:
            license_data = json.load(f)
            decrypted_data = decrypt_data(license_data['data'])
            
            if not decrypted_data:
                return {'status': 'error', 'message': 'License file corrupted'}
            
            # Check if license is activated
            if decrypted_data['is_activated']:
                # Check if license has expired (if it has an expiration date)
                if decrypted_data['expiration_date'] and time.time() > decrypted_data['expiration_date']:
                    return {'status': 'expired', 'message': 'License has expired'}
                return {'status': 'activated', 'message': 'License is active'}
            
            # Check trial period
            installation_date = decrypted_data['installation_date']
            current_time = time.time()
            trial_end_date = installation_date + (TRIAL_PERIOD_DAYS * 24 * 60 * 60)
            
            if current_time > trial_end_date:
                return {'status': 'trial_expired', 'message': 'Trial period has expired'}
            
            days_left = max(0, int((trial_end_date - current_time) / (24 * 60 * 60)))
            return {'status': 'trial', 'message': f'Trial period active', 'days_left': days_left}
    
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        # If there's any error, initialize the license system
        initialize_license_system()
        return {'status': 'trial', 'message': 'Trial period started', 'days_left': TRIAL_PERIOD_DAYS}

def validate_license_key(key):
    """Validate a license key against the list of valid keys."""
    try:
        with open(LICENSE_KEYS_FILE, 'r') as f:
            keys_data = json.load(f)
            valid_keys = decrypt_data(keys_data['keys'])
            
            if not valid_keys:
                return False
            
            # Check if the key is in the list of valid keys
            return key in valid_keys
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return False

def activate_license(key):
    """Activate the license with the provided key."""
    # Validate the key
    if not validate_license_key(key):
        return {'success': False, 'message': 'Invalid license key'}
    
    try:
        # Read the current license data
        with open(LICENSE_FILE, 'r') as f:
            license_data = json.load(f)
            decrypted_data = decrypt_data(license_data['data'])
            
            if not decrypted_data:
                return {'success': False, 'message': 'License file corrupted'}
            
            # Update the license data
            decrypted_data['is_activated'] = True
            decrypted_data['license_key'] = key
            # Set expiration to 1 year from now (or never, depending on your business model)
            # For this example, we'll set it to 1 year
            decrypted_data['expiration_date'] = time.time() + (365 * 24 * 60 * 60)
            
            # Write the updated license data
            with open(LICENSE_FILE, 'w') as f:
                json.dump({'data': encrypt_data(decrypted_data)}, f)
            
            return {'success': True, 'message': 'License activated successfully'}
    
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        return {'success': False, 'message': 'Error activating license'}

def get_trial_days_left():
    """Get the number of days left in the trial period."""
    license_status = get_license_status()
    if license_status['status'] == 'trial':
        return license_status['days_left']
    return 0

# Initialize the license system when the module is imported
initialize_license_system() 