@echo off
setlocal EnableExtensions

rem Starts the Pixel 4 emulator, installs the ScratchJr debug app, and opens it.
rem Emulator warnings are written to a log file instead of this window.

set "ROOT=%~dp0"
set "SDK=%LOCALAPPDATA%\Android\Sdk"
if defined ANDROID_SDK_ROOT set "SDK=%ANDROID_SDK_ROOT%"
if defined ANDROID_HOME set "SDK=%ANDROID_HOME%"

set "ADB=%SDK%\platform-tools\adb.exe"
set "EMULATOR=%SDK%\emulator\emulator.exe"
set "AVD=Pixel_4"
set "APK=%ROOT%android\ScratchJr\app\build\outputs\apk\free\debug\app-free-debug.apk"
set "ACTIVITY=org.scratchjr.androidfree/org.scratchjr.android.ScratchJrActivity"
set "DEVFILE=%TEMP%\scratchjr-devices.txt"
set "BOOTFILE=%TEMP%\scratchjr-boot.txt"
set "OUTFILE=%TEMP%\scratchjr-cmd.txt"
set "EMULOG=%TEMP%\scratchjr-emulator.log"
set "EMUPATH=%SDK%\platform-tools;%SDK%\emulator;%SystemRoot%\system32;%SystemRoot%"

if not exist "%ADB%" (
    echo adb was not found:
    echo   %ADB%
    echo Install Android SDK platform-tools, or set ANDROID_HOME.
    exit /b 1
)
if not exist "%EMULATOR%" (
    echo The Android emulator was not found:
    echo   %EMULATOR%
    exit /b 1
)

if not exist "%APK%" (
    echo Debug APK not found. Building it...
    pushd "%ROOT%android\ScratchJr"
    call gradlew.bat assembleFreeDebug
    if errorlevel 1 (
        echo Build failed.
        popd
        exit /b 1
    )
    popd
)

"%ADB%" start-server >nul 2>&1

call :refresh_device
if not defined SERIAL (
    echo Starting emulator %AVD%...
    del "%EMULOG%" >nul 2>&1
    rem Detach the emulator and keep its warnings in a log, not this window.
    start "ScratchJr Emulator" /MIN cmd.exe /c "set PATH=%EMUPATH%&& ""%EMULATOR%"" -avd %AVD% -netdelay none -netspeed full -no-boot-anim > ""%EMULOG%"" 2>&1"
)

echo Waiting for the emulator to finish booting...
set /a TRIES=0
:waitboot
set /a TRIES+=1
if %TRIES% GTR 120 (
    echo The emulator did not finish booting. See %EMULOG%
    exit /b 1
)
call :refresh_device
if not defined ONLINE (
    ping -n 3 127.0.0.1 >nul
    goto waitboot
)
"%ADB%" -s %SERIAL% shell getprop sys.boot_completed > "%BOOTFILE%" 2>nul
set "BOOT="
for /f "usebackq" %%B in ("%BOOTFILE%") do set "BOOT=%%B"
if not "%BOOT%"=="1" (
    ping -n 3 127.0.0.1 >nul
    goto waitboot
)
"%ADB%" -s %SERIAL% shell pm path android >nul 2>&1
if errorlevel 1 (
    ping -n 3 127.0.0.1 >nul
    goto waitboot
)

echo Installing ScratchJr...
set /a TRIES=0
:install
set /a TRIES+=1
if %TRIES% GTR 8 (
    echo Install failed.
    type "%OUTFILE%"
    exit /b 1
)
"%ADB%" -s %SERIAL% install -r "%APK%" > "%OUTFILE%" 2>&1
findstr /C:"Success" "%OUTFILE%" >nul
if errorlevel 1 (
    ping -n 3 127.0.0.1 >nul
    goto install
)

rem Skip the first-launch permission dialog, which can get the app killed on a 2GB emulator.
"%ADB%" -s %SERIAL% shell pm grant org.scratchjr.androidfree android.permission.CAMERA >nul 2>&1
"%ADB%" -s %SERIAL% shell pm grant org.scratchjr.androidfree android.permission.RECORD_AUDIO >nul 2>&1

echo Opening ScratchJr...
"%ADB%" -s %SERIAL% shell am start -n %ACTIVITY% > "%OUTFILE%" 2>&1
findstr /I /C:"Error" "%OUTFILE%" >nul
if not errorlevel 1 (
    type "%OUTFILE%"
    echo Could not open ScratchJr.
    exit /b 1
)

del "%DEVFILE%" "%BOOTFILE%" "%OUTFILE%" >nul 2>&1
echo ScratchJr is running.
exit /b 0

:refresh_device
set "SERIAL="
set "ONLINE="
"%ADB%" devices > "%DEVFILE%" 2>nul
for /f "usebackq skip=1 tokens=1,2" %%A in ("%DEVFILE%") do (
    echo %%A | findstr /B /C:"emulator-" >nul
    if not errorlevel 1 (
        set "SERIAL=%%A"
        if /I "%%B"=="device" set "ONLINE=1"
    )
)
exit /b 0
