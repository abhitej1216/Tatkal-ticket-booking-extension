#!/usr/bin/env python3
"""
Simple HTTP server to test the IRCTC Tatkal Booking Assistant extension.
Serves mock-irctc.html at http://localhost:8080/mock-irctc.html
"""

import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")

def main():
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/mock-irctc.html"
        print("=" * 65)
        print("🚆  IRCTC Tatkal Booking Assistant - Local Test Server")
        print("=" * 65)
        print(f" Serving test bench at : {url}")
        print(" Directory             :", DIRECTORY)
        print(" Extension location    :", DIRECTORY)
        print("=" * 65)
        print("\nPress Ctrl+C to stop the server.\n")

        # Open in default browser
        webbrowser.open(url)

        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down test server...")

if __name__ == "__main__":
    main()
