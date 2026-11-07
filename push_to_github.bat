@echo off
setlocal
echo ===================================================
echo   Push Kolkata Fatafat Portal to GitHub
echo ===================================================
set /p REPO_URL="Enter your GitHub Repository URL (e.g. https://github.com/username/repo.git): "

if "%REPO_URL%"=="" (
    echo Error: Repository URL cannot be empty.
    pause
    exit /b
)

echo Adding remote origin...
"C:\Users\lenovo\.gemini\antigravity\scratch\mingit\cmd\git.exe" remote remove origin 2>nul
"C:\Users\lenovo\.gemini\antigravity\scratch\mingit\cmd\git.exe" remote add origin %REPO_URL%

echo Pushing main branch...
"C:\Users\lenovo\.gemini\antigravity\scratch\mingit\cmd\git.exe" push -u origin main

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Code pushed to GitHub successfully!
) else (
    echo [ERROR] Push failed. Please check your GitHub permissions or URL.
)

pause
