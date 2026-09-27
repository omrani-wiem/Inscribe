@echo off
echo Downloading handwritten sample images for OCR testing...
echo.

mkdir test-data 2>nul
cd test-data

echo [1/2] Handwritten text line sample (English cursive)...
powershell -Command "try { Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/githubharald/SimpleHTR/master/data/line.png' -OutFile 'handwritten_line.png' -ErrorAction Stop; Write-Host 'OK' } catch { Write-Host 'FAILED: ' $_.Exception.Message }"

echo [2/2] Handwritten word sample...
powershell -Command "try { Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/githubharald/SimpleHTR/master/data/word.png' -OutFile 'handwritten_word.png' -ErrorAction Stop; Write-Host 'OK' } catch { Write-Host 'FAILED: ' $_.Exception.Message }"

echo.
echo --- Results ---
dir /b *.png 2>nul
for %%I in (*.png) do echo %%~nI: %%~zI bytes

echo.
echo Done! Check the test-data folder.
pause
