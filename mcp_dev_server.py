import os
import sys
import subprocess
from fastmcp import FastMCP

# 1. Mount Django Context
sys.path.append(os.path.abspath(os.path.dirname(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myproject.settings") # Adjust to your actual project name

import django
django.setup()

from django.apps import apps

# 2. Initialize FastMCP
mcp = FastMCP("FullStack-Django-React-Assistant")

# --- DJANGO BACKEND TOOLS ---

@mcp.tool(description="List all installed Django apps and their models to map out database schemas.")
def introspect_models() -> str:
    summary = []
    for app in apps.get_app_configs():
        if not app.name.startswith('django.'): # Filter out core built-in apps
            models = [model.__name__ for model in app.get_models()]
            if models:
                summary.append(f"App: {app.name}\nModels: {', '.join(models)}")
    return "\n\n".join(summary) if summary else "No custom apps found."

# --- REACT FRONTEND TOOLS ---

@mcp.tool(description="Scan a React file or folder to inspect its architecture or locate components.")
def inspect_frontend_file(filepath: str) -> str:
    # Restrict path to prevent absolute path traversal vulnerabilities
    safe_path = os.path.join("frontend", filepath) # Adjust to your actual react folder name
    if not os.path.exists(safe_path):
        return f"File or path not found at: {safe_path}"
    
    with open(safe_path, 'r', encoding='utf-8') as f:
        return f.read()

@mcp.tool(description="Check for compiler/linter errors in the React app by running npm run build.")
def check_react_build() -> str:
    try:
        # Assumes frontend package.json lives inside a 'frontend' subdirectory
        result = subprocess.run(
            ["npm", "run", "build"], 
            cwd="./frontend", 
            capture_output=True, 
            text=True, 
            timeout=30
        )
        if result.returncode == 0:
            return "React build passed successfully."
        return f"React build failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    except Exception as e:
        return f"Failed to execute build check: {str(e)}"

if __name__ == "__main__":
    mcp.run()