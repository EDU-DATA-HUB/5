# ScratchJr setup and running guide

## Web server

ScratchJr in a desktop browser, served from this computer. After setup it runs with no internet connection.

### Setup

1. Install [Node.js](https://nodejs.org/).
2. From the project folder, with a network connection, run:

```bat
npm install
```

### Run

Double-click `serve.bat`, or from the project folder run:

```bat
npm start
```

The site is at:

```text
http://127.0.0.1:8080/
```

On Windows the browser opens by itself. Leave the server window open. Closing it stops the site.

To use another port, or to skip opening the browser:

```bat
set PORT=8090
set SCRATCHJR_NO_OPEN=1
npm start
```

## Android

ScratchJr as an Android app on the Pixel 4 emulator.

### Setup

1. Install the Android SDK, including platform-tools and the emulator.
2. Create an Android Virtual Device named `Pixel_4`.
3. Install JDK 17 at `C:\Program Files\Java\jdk-17`.

The SDK is read from `ANDROID_HOME`, then `ANDROID_SDK_ROOT`, then `%LOCALAPPDATA%\Android\Sdk`.

If the debug APK is not already built, also install [Node.js](https://nodejs.org/) and run `npm install` in the project folder. The build uses those tools.

### Run

Double-click `run.bat`.

It starts the `Pixel_4` emulator if one is not already running, installs `android\ScratchJr\app\build\outputs\apk\free\debug\app-free-debug.apk`, and opens ScratchJr. If that APK is missing, `run.bat` builds it first. When it finishes, the window prints `ScratchJr is running.`
