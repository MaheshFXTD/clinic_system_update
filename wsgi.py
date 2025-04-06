from waitress import serve
from app import app

if __name__ == '__main__':
    print("Starting production server...")
    print("Access the application at http://localhost:8080")
    serve(app, host='127.0.0.1', port=8080, threads=4, connection_limit=1000, url_scheme='http') 