# THE WATCHER

Imagine your computer/PC had an eye and it followed you around.

Computer vision project with interactive graphics that tracks and follows you around.

The project combines ASCII art, real-time body tracking, and interactive visual effects.

<img width="1915" height="962" alt="watcher-1" src="https://github.com/user-attachments/assets/0e463e50-23c7-4a1d-b6c1-a20c02d3cc17" />



## How It Works

The application creates an HTML Canvas and renders an eye using different ASCII characters.

MediaPipe Pose Landmarker processes webcam frames and identifies body landmarks.

The application tracks changes in body position to detect movement.

Detected movement influences the eye's gaze and opening animation.

When movement stops, the eye gradually closes.

<img width="1912" height="956" alt="watcher-2" src="https://github.com/user-attachments/assets/6175743e-0b50-41d9-b879-104ba7bac539" />


## Features

- **ASCII Eye Rendering:** Generates an animated eye using text characters.
- **ASCII Eye Rendering:** Generates an animated eye using text characters rather than conventional image graphics.
- **Real-Time Body Tracking:** Uses MediaPipe Pose Landmarker to detect body position and movement through the webcam.
- **Interactive Eye Movement:** The eye responds to detected body movement by adjusting its gaze.
- **Opening and Closing Animation:** The eye opens when movement is detected and gradually closes after a period of inactivity.
- **Camera Controls:** Allows users to initialize and deactivate webcam tracking.

## Technologies Used

- HTML
- CSS
- JavaScript
- MediaPipe Tasks Vision
- Vite
- npm

## Requirements

- Node.js
- npm
- VS Code
- Webcam

## How to run

```bash
#install dependencies
npm install
```

```bash
# run
npm run dev
```
