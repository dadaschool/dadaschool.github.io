@echo off
cd /d "%~dp0"
title 추상화와 알고리즘 - 로컬 서버

echo.
echo  ============================================================
echo    추상화와 알고리즘 : 로컬 서버
echo  ============================================================
echo.

rem 파이썬 실행 파일을 python - py 순서로 찾는다
where python >nul 2>nul
if not errorlevel 1 goto RUNPY

where py >nul 2>nul
if not errorlevel 1 goto RUNPY2

echo  [오류] 파이썬을 찾을 수 없습니다.
echo         index.html 파일을 더블클릭하면 서버 없이도 그대로 실행됩니다.
echo.
pause
exit /b 1

:RUNPY
python server.py
goto ENDED

:RUNPY2
py server.py
goto ENDED

:ENDED
echo.
echo  서버가 종료되었습니다. 아무 키나 누르면 창이 닫힙니다.
pause >nul
